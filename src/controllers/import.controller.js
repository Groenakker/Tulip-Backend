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
// Expected columns (BP Master Data.xlsx):
//   BP Code              -> partnerNumber  (required)
//   BP Name              -> name           (required)
//   Account Balance      -> ignored
//   Payment Terms Code   -> ignored
//   BP Currency          -> ignored
//
// Category is inferred from the BP Code prefix:
//   "C..." -> Client, "V..." -> Vendor, anything else -> Client (default).
// ----------------------------------------------------------------------------
const inferPartnerCategory = (code) => {
  const c = cleanString(code).toUpperCase();
  if (c.startsWith("V")) return "Vendor";
  if (c.startsWith("S")) return "Vendor"; // some files use S = Supplier
  return "Client";
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

    const category = inferPartnerCategory(partnerNumber);
    const payload = {
      partnerNumber,
      name,
      category,
      status: "Active",
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
        existing.updatedBy = userId;
        await existing.save();
        results.push({
          row: rowIndex,
          partnerNumber,
          name: payload.name,
          action: "updated",
        });
      } else {
        await Bpartner.create(payload);
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
        await existing.save();
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
        await existing.save();
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
