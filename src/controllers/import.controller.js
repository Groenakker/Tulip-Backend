/**
 * Excel / CSV import controller
 *
 * Endpoints:
 *   POST /api/bpartners/import   — BP Master Data.xlsx
 *   POST /api/projects/import    — Projects List.xlsx
 *   POST /api/testcodes/import   — Items Master Data.xlsx
 *
 * SECURITY / TENANT SCOPING:
 *   Every imported document is stamped with the requesting user's
 *   `company_id` and `createdBy`. There is no way for a user to import
 *   data into another company.
 *
 * MODES:
 *   ?mode=upsert (default) — update existing rows by their natural key
 *                            (partnerNumber / projectID / code) within
 *                            the company, otherwise insert.
 *   ?mode=insert            — only create new rows; skip duplicates.
 *
 * The endpoints accept either:
 *   - multipart/form-data with field "file" (an .xlsx / .csv), OR
 *   - JSON body { rows: [...] } when the client has already parsed the
 *     workbook in the browser (kept as an option for very large files).
 */

import xlsx from "xlsx";
import Bpartner from "../models/bPartners.models.js";
import Project from "../models/projects.models.js";
import Testcode from "../models/testCodes.models.js";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const requireCompany = (req, res) => {
  const companyId = req.user?.company_id;
  if (!companyId) {
    res.status(403).json({ message: "Invalid tenant context" });
    return null;
  }
  return companyId;
};

const parseWorkbookFromRequest = (req) => {
  // Prefer JSON rows (client-parsed) when present so we don't re-parse.
  if (Array.isArray(req.body?.rows)) {
    return req.body.rows;
  }

  if (!req.file || !req.file.buffer) {
    const err = new Error(
      'No file uploaded. Attach the spreadsheet under the "file" form field.'
    );
    err.status = 400;
    throw err;
  }

  let workbook;
  try {
    workbook = xlsx.read(req.file.buffer, { type: "buffer", cellDates: true });
  } catch (e) {
    const err = new Error(
      "Could not read the file. Please upload a valid .xlsx, .xls, or .csv file."
    );
    err.status = 400;
    throw err;
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    const err = new Error("The uploaded file has no sheets.");
    err.status = 400;
    throw err;
  }

  const sheet = workbook.Sheets[sheetName];
  // defval: "" keeps blank cells as empty strings rather than undefined,
  // which makes downstream `String(...).trim()` safe everywhere.
  return xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });
};

const cleanString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const cleanNumber = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const cleanDate = (value) => {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  // xlsx may return ISO strings or "MM/DD/YYYY" — Date can parse both.
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? undefined : d;
};

// Match a header by trying several common spellings (case-insensitive,
// trims whitespace, ignores extra spaces). Useful because the demo files
// have inconsistent headers ("BP Code" vs "Bp Code", trailing spaces).
const pickField = (row, candidates) => {
  if (!row || typeof row !== "object") return "";
  const lookup = {};
  for (const key of Object.keys(row)) {
    lookup[String(key).trim().toLowerCase().replace(/\s+/g, " ")] = key;
  }
  for (const candidate of candidates) {
    const k = candidate.trim().toLowerCase().replace(/\s+/g, " ");
    if (lookup[k] !== undefined) return row[lookup[k]];
  }
  return "";
};

const summarizeImport = (results) => ({
  total: results.length,
  created: results.filter((r) => r.action === "created").length,
  updated: results.filter((r) => r.action === "updated").length,
  skipped: results.filter((r) => r.action === "skipped").length,
  failed: results.filter((r) => r.action === "failed").length,
  results,
});

// ----------------------------------------------------------------------------
// POST /api/bpartners/import
// ----------------------------------------------------------------------------
// Expected columns (BP Master Data , Contact , Address, Phone.xlsx):
//   BP Code            -> partnerNumber  (required)
//   BP Name            -> name           (required)
//   BP Type            -> category       ("C" = Client, "S" / "V" = Vendor)
//   Bill-to Street     -> address1
//   Bill-to Zip Code   -> zip
//   Ship-to Street     -> address2       (only kept when different from bill-to)
//   Ship-to Zip Code   -> appended to address2 if shipping differs
//   Telephone 1        -> phone          (primary partner phone)
//   Telephone 2        -> contact phone  (falls back to partner phone if 1 empty)
//   Fax Number         -> ignored
//   Contact Person     -> contacts[]     (added as a single contact entry)
//
// Older "BP Master Data.xlsx" exports without the extra columns continue to
// work — every column above is optional except BP Code and BP Name.
// ----------------------------------------------------------------------------

// Strip out anything that isn't a valid phone character so we don't trigger
// the model's phone regex with stray punctuation from spreadsheet exports.
const cleanPhone = (value) => {
  const raw = cleanString(value);
  if (!raw) return "";
  const filtered = raw.replace(/[^\d\s\-+()]/g, "").trim();
  return filtered;
};

// Map the explicit "BP Type" column to a partner category. Falls back to the
// BP Code prefix (C... -> Client, V/S... -> Vendor) when the column is blank.
const resolvePartnerCategory = (bpType, code) => {
  const t = cleanString(bpType).toUpperCase();
  if (t === "C") return "Client";
  if (t === "S" || t === "V") return "Vendor";
  // Some exports use full words.
  if (t === "CLIENT" || t === "CUSTOMER") return "Client";
  if (t === "VENDOR" || t === "SUPPLIER") return "Vendor";

  const c = cleanString(code).toUpperCase();
  if (c.startsWith("V") || c.startsWith("S")) return "Vendor";
  return "Client";
};

// Combine ship-to street + zip into a single address2 line, only when it
// actually differs from the bill-to address (otherwise it's pointless noise).
const buildShipToAddress = (shipStreet, shipZip, billStreet, billZip) => {
  const ss = cleanString(shipStreet);
  const sz = cleanString(shipZip);
  if (!ss && !sz) return "";

  const sameStreet = ss && billStreet && ss.toLowerCase() === cleanString(billStreet).toLowerCase();
  const sameZip = sz && billZip && sz === cleanString(billZip);
  if (sameStreet && sameZip) return "";

  return [ss, sz].filter(Boolean).join(", ");
};

// Merge the imported contact into the existing contacts list without
// creating duplicates. We match on (case-insensitive) name + phone so
// re-importing the same file is idempotent.
const mergeContact = (existingContacts, newContact) => {
  if (!newContact || !newContact.name) return existingContacts || [];
  const list = Array.isArray(existingContacts) ? [...existingContacts] : [];
  const exists = list.some((c) => {
    const sameName = (c.name || "").trim().toLowerCase() === newContact.name.trim().toLowerCase();
    const samePhone = (c.phone || "") === (newContact.phone || "");
    return sameName && samePhone;
  });
  if (!exists) list.push(newContact);
  return list;
};

export const importBusinessPartners = async (req, res) => {
  const companyId = requireCompany(req, res);
  if (!companyId) return;

  const mode = req.query?.mode === "insert" ? "insert" : "upsert";
  const userId = req.user?._id;

  let rows;
  try {
    rows = parseWorkbookFromRequest(req);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: "The file has no data rows." });
  }

  const results = [];

  // De-duplicate within the file itself (last value wins) so we don't
  // hit unique-index errors on partnerNumber.
  const seen = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const partnerNumber = cleanString(pickField(row, ["BP Code", "Bp Code", "Partner Code", "Code"]));
    const name = cleanString(pickField(row, ["BP Name", "Bp Name", "Partner Name", "Name"]));

    if (!partnerNumber || !name) {
      results.push({
        row: i + 2,
        partnerNumber,
        name,
        action: "failed",
        message: !partnerNumber
          ? "Missing required column \"BP Code\""
          : "Missing required column \"BP Name\"",
      });
      continue;
    }

    const bpType = pickField(row, ["BP Type", "Bp Type", "Type", "Category"]);
    const billStreet = cleanString(
      pickField(row, ["Bill-to Street", "Bill To Street", "Billing Street", "Billing Address", "Address 1", "Address1"])
    );
    const billZip = cleanString(
      pickField(row, ["Bill-to Zip Code", "Bill To Zip Code", "Bill-to Zip", "Bill To Zip", "Billing Zip", "Zip", "Zip Code", "Postal Code"])
    );
    const shipStreet = cleanString(
      pickField(row, ["Ship-to Street", "Ship To Street", "Shipping Street", "Shipping Address", "Address 2", "Address2"])
    );
    const shipZip = cleanString(
      pickField(row, ["Ship-to Zip Code", "Ship To Zip Code", "Ship-to Zip", "Ship To Zip", "Shipping Zip"])
    );
    const tel1 = cleanPhone(pickField(row, ["Telephone 1", "Telephone1", "Phone 1", "Phone", "Telephone"]));
    const tel2 = cleanPhone(pickField(row, ["Telephone 2", "Telephone2", "Phone 2", "Mobile", "Cell"]));
    const contactPerson = cleanString(
      pickField(row, ["Contact Person", "Contact Name", "Contact", "Primary Contact"])
    );

    const category = resolvePartnerCategory(bpType, partnerNumber);
    const address1 = billStreet;
    const address2 = buildShipToAddress(shipStreet, shipZip, billStreet, billZip);
    const zip = billZip;
    // Primary phone goes on the partner; secondary phone (if any) goes on the
    // contact entry so we don't lose information.
    const partnerPhone = tel1 || tel2;
    const contactPhone = tel1 && tel2 ? tel2 : "";
    const contact = contactPerson
      ? {
          name: contactPerson,
          phone: contactPhone || partnerPhone || undefined,
        }
      : null;

    const payload = {
      partnerNumber,
      name,
      category,
      status: "Active",
      address1: address1 || undefined,
      address2: address2 || undefined,
      zip: zip || undefined,
      phone: partnerPhone || undefined,
      contact, // singular new contact (may be null); applied during create/update
      company_id: companyId,
      createdBy: userId,
      updatedBy: userId,
    };

    seen.set(partnerNumber, { rowIndex: i + 2, payload });
  }

  for (const [partnerNumber, entry] of seen) {
    const { rowIndex, payload } = entry;
    try {
      const existing = await Bpartner.findOne({
        company_id: companyId,
        partnerNumber,
      });

      if (existing) {
        if (mode === "insert") {
          results.push({
            row: rowIndex,
            partnerNumber,
            name: payload.name,
            action: "skipped",
            message: "Already exists (insert-only mode).",
          });
          continue;
        }

        existing.name = payload.name;
        existing.category = payload.category;
        // Only overwrite address / phone fields when the import actually
        // provides a value — never wipe out manually-entered data.
        if (payload.address1) existing.address1 = payload.address1;
        if (payload.address2) existing.address2 = payload.address2;
        if (payload.zip) existing.zip = payload.zip;
        if (payload.phone) existing.phone = payload.phone;
        if (payload.contact) {
          existing.contacts = mergeContact(existing.contacts, payload.contact);
        }
        existing.updatedBy = userId;
        // validateModifiedOnly so legacy data on the document (e.g. an old
        // contact with a malformed email saved before the validators were
        // added) can't block the fields the import is actually trying to
        // write. Without this, a single stale field would mark the entire
        // row as "failed" and the imported phone / address would be lost.
        await existing.save({ validateModifiedOnly: true });
        results.push({
          row: rowIndex,
          partnerNumber,
          name: payload.name,
          action: "updated",
        });
      } else {
        // Pull the singular "contact" out of the payload and store it as the
        // initial entry in the contacts array, matching the schema shape.
        const { contact, ...rest } = payload;
        const createPayload = {
          ...rest,
          contacts: contact ? [contact] : [],
        };
        await Bpartner.create(createPayload);
        results.push({
          row: rowIndex,
          partnerNumber,
          name: payload.name,
          action: "created",
        });
      }
    } catch (e) {
      results.push({
        row: rowIndex,
        partnerNumber,
        name: payload.name,
        action: "failed",
        message: e.message || "Unknown error",
      });
    }
  }

  return res.json(summarizeImport(results));
};

// ----------------------------------------------------------------------------
// POST /api/projects/import
// ----------------------------------------------------------------------------
// Expected columns (Projects List.xlsx):
//   Project Code   -> projectID    (required)
//   Project Name   -> name + description (required)
//   Client Code    -> bPartnerCode (required, looked up to bPartnerID)
//   Client Name    -> only used for messaging
//   Julian Date    -> ignored
//   Valid From     -> startDate
//   Valid To       -> endDate
//   Active         -> status ("Yes" -> Active, otherwise -> Cancelled)
// ----------------------------------------------------------------------------
export const importProjects = async (req, res) => {
  const companyId = requireCompany(req, res);
  if (!companyId) return;

  const mode = req.query?.mode === "insert" ? "insert" : "upsert";
  const userId = req.user?._id;

  let rows;
  try {
    rows = parseWorkbookFromRequest(req);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: "The file has no data rows." });
  }

  // Pre-load all partners for this company so we can resolve bPartnerCode
  // -> bPartnerID without N+1 queries.
  const partners = await Bpartner.find({ company_id: companyId }).select(
    "_id partnerNumber"
  );
  const partnerByCode = new Map(
    partners.map((p) => [String(p.partnerNumber).toUpperCase(), p._id])
  );

  const results = [];
  const seen = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const projectID = cleanString(
      pickField(row, ["Project Code", "ProjectCode", "Project ID", "Code"])
    );
    const projectName = cleanString(
      pickField(row, ["Project Name", "Name", "Description"])
    );
    const clientCode = cleanString(
      pickField(row, ["Client Code", "BP Code", "Customer Code", "Partner Code"])
    );
    const clientName = cleanString(
      pickField(row, ["Client Name", "Customer Name", "Partner Name"])
    );
    const validFrom = cleanDate(pickField(row, ["Valid From", "Start Date", "Start"]));
    const validTo = cleanDate(pickField(row, ["Valid To", "End Date", "End"]));
    const activeFlag = cleanString(pickField(row, ["Active", "Status"]));

    if (!projectID || !projectName) {
      results.push({
        row: i + 2,
        projectID,
        action: "failed",
        message: !projectID
          ? "Missing required column \"Project Code\""
          : "Missing required column \"Project Name\"",
      });
      continue;
    }

    if (!clientCode) {
      results.push({
        row: i + 2,
        projectID,
        action: "failed",
        message:
          "Missing \"Client Code\" — required to link the project to a Business Partner.",
      });
      continue;
    }

    const bPartnerID = partnerByCode.get(clientCode.toUpperCase());
    if (!bPartnerID) {
      results.push({
        row: i + 2,
        projectID,
        action: "failed",
        message: `No Business Partner with code "${clientCode}"${
          clientName ? ` (${clientName})` : ""
        } exists for this company. Import Business Partners first.`,
      });
      continue;
    }

    const status =
      cleanString(activeFlag).toLowerCase() === "no" ? "Cancelled" : "Active";

    const payload = {
      projectID,
      name: projectName,
      description: projectName,
      bPartnerCode: clientCode,
      bPartnerID,
      startDate: validFrom,
      endDate: validTo,
      status,
      company_id: companyId,
      createdBy: userId,
      updatedBy: userId,
    };

    seen.set(projectID, { rowIndex: i + 2, payload });
  }

  for (const [projectID, entry] of seen) {
    const { rowIndex, payload } = entry;
    try {
      const existing = await Project.findOne({
        company_id: companyId,
        projectID,
      });

      if (existing) {
        if (mode === "insert") {
          results.push({
            row: rowIndex,
            projectID,
            name: payload.name,
            action: "skipped",
            message: "Already exists (insert-only mode).",
          });
          continue;
        }

        existing.name = payload.name;
        existing.description = payload.description;
        existing.bPartnerCode = payload.bPartnerCode;
        existing.bPartnerID = payload.bPartnerID;
        if (payload.startDate) existing.startDate = payload.startDate;
        if (payload.endDate) existing.endDate = payload.endDate;
        existing.status = payload.status;
        existing.updatedBy = userId;
        await existing.save({ validateModifiedOnly: true });
        results.push({
          row: rowIndex,
          projectID,
          name: payload.name,
          action: "updated",
        });
      } else {
        await Project.create(payload);
        results.push({
          row: rowIndex,
          projectID,
          name: payload.name,
          action: "created",
        });
      }
    } catch (e) {
      results.push({
        row: rowIndex,
        projectID,
        name: payload.name,
        action: "failed",
        message: e.message || "Unknown error",
      });
    }
  }

  return res.json(summarizeImport(results));
};

// ----------------------------------------------------------------------------
// POST /api/testcodes/import
// ----------------------------------------------------------------------------
// Expected columns (Items Master Data.xlsx):
//   Item No.        -> code             (required)
//   Item Description-> descriptionShort + descriptionLong (required)
//   Group           -> category
//   Lead Time       -> turnAroundTime
//   Standard Cost / In stock / Item Cost / Sales Item -> ignored
//
// `standard` is required by the schema but missing from the file —
// defaults to "—" so existing schema validation passes.
// ----------------------------------------------------------------------------
export const importTestCodes = async (req, res) => {
  const companyId = requireCompany(req, res);
  if (!companyId) return;

  const mode = req.query?.mode === "insert" ? "insert" : "upsert";
  const userId = req.user?._id;

  let rows;
  try {
    rows = parseWorkbookFromRequest(req);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: "The file has no data rows." });
  }

  const results = [];
  const seen = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const code = cleanString(
      pickField(row, ["Item No.", "Item No", "Item Number", "Code", "Test Code"])
    );
    const description = cleanString(
      pickField(row, ["Item Description", "Description", "Test Description"])
    );
    const category = cleanString(pickField(row, ["Group", "Category", "Test Category"]));
    const leadTime = cleanNumber(pickField(row, ["Lead Time", "Turnaround", "TAT"]));

    if (!code) {
      results.push({
        row: i + 2,
        code,
        action: "failed",
        message: "Missing required column \"Item No.\"",
      });
      continue;
    }

    if (!description) {
      results.push({
        row: i + 2,
        code,
        action: "failed",
        message: "Missing required column \"Item Description\"",
      });
      continue;
    }

    const payload = {
      code,
      standard: "—", // not present in import file; required by schema
      descriptionShort: description.slice(0, 200),
      descriptionLong: description,
      category: category || undefined,
      turnAroundTime: leadTime,
      company_id: companyId,
      createdBy: userId,
      updatedBy: userId,
    };

    seen.set(code, { rowIndex: i + 2, payload });
  }

  for (const [code, entry] of seen) {
    const { rowIndex, payload } = entry;
    try {
      const existing = await Testcode.findOne({
        company_id: companyId,
        code,
      });

      if (existing) {
        if (mode === "insert") {
          results.push({
            row: rowIndex,
            code,
            action: "skipped",
            message: "Already exists (insert-only mode).",
          });
          continue;
        }

        existing.descriptionShort = payload.descriptionShort;
        existing.descriptionLong = payload.descriptionLong;
        if (payload.category) existing.category = payload.category;
        if (payload.turnAroundTime != null) {
          existing.turnAroundTime = payload.turnAroundTime;
        }
        existing.updatedBy = userId;
        await existing.save({ validateModifiedOnly: true });
        results.push({
          row: rowIndex,
          code,
          action: "updated",
        });
      } else {
        await Testcode.create(payload);
        results.push({
          row: rowIndex,
          code,
          action: "created",
        });
      }
    } catch (e) {
      results.push({
        row: rowIndex,
        code,
        action: "failed",
        message: e.message || "Unknown error",
      });
    }
  }

  return res.json(summarizeImport(results));
};

export default {
  importBusinessPartners,
  importProjects,
  importTestCodes,
};
