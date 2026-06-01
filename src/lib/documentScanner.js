// ============================================================
// Document scanner
// ------------------------------------------------------------
// Extracts plain text from PDF / DOC / DOCX / XLS / XLSX
// buffers and mines labelled fields ("Label: value") so the
// Sample Submission form can suggest known/custom fields based
// on whatever template the customer attached to their Business
// Partner record.
//
// Pure helpers — no DB, no req/res, no file I/O. Pass a buffer
// in, get text + detectedFields out. Errors are swallowed and
// reported as `extractionError` so a malformed upload never
// breaks the upload flow.
// ============================================================

import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import XLSX from "xlsx";

// ------------------------------------------------------------
// Master dictionary of Sample Submission schema fields the
// scanner knows about. Keys are the schema attribute names;
// values are the aliases / printable labels we expect to see
// in customer-supplied TRF / TIDS / PCF forms. Normalized
// matching is case- and punctuation-insensitive (see
// `normalizeKey`).
//
// Keep this in sync with samples.models.js when new fields are
// added so the scanner reports them as "schema" (already
// supported) rather than as candidate custom fields.
// ------------------------------------------------------------
export const SAMPLE_FIELD_ALIASES = {
  sampleDescription: ["sample description", "description of device", "description", "test article name", "test article name for report", "test article name for reports", "name of test item", "name of test item / (sponsor's id for test)"],
  intendedUse: ["intended use", "intended use of the device", "indication for use", "intended use and indication for use", "intended clinical use", "intended clinical use of test article"],
  partNumber: ["part number", "part no", "product number", "product id", "product code"],
  lotNumber: ["lot number", "lot no", "lot #", "batch no", "lot / batch number"],
  batchNumber: ["batch number", "batch no", "batch #"],
  serialNumber: ["serial number", "serial no", "serial #"],
  devicesUsed: ["devices used", "devices clinically used", "devices clinically used (dc)", "number of test articles", "number of test articles provided for testing", "quantity of test item"],
  countryOrigin: ["country of origin", "country origin"],
  sampleMass: ["sample mass", "sample mass [g]", "net weight", "net weight of test item", "total net weight"],
  surfaceArea: ["surface area", "sample surface", "sample surface [cm²]", "total surface area", "total surface area of medical device", "surface area of test item"],
  surfaceAreaDirect: ["surface area of direct blood contact parts", "surface area direct blood contact"],
  surfaceAreaIndirect: ["surface area of indirect blood contact parts", "surface area indirect blood contact"],
  netWeightDirect: ["net weight of direct blood contact parts", "net weight direct blood contact"],
  netWeightIndirect: ["net weight of indirect blood contact parts", "net weight indirect blood contact"],
  contactType: ["type of contact", "nature of body contact", "contact type"],
  contactDuration: ["duration of contact", "contact duration", "nature of body contact duration"],
  manufacturer: ["manufacturer", "manufacturer name", "manufacturer name and address", "test item manufactured by"],
  manufactureDate: ["manufacture date", "manufacturing date", "date of manufacture"],
  expirationDate: ["expiration date", "date of expiry", "expiry date"],
  sterilizationDate: ["sterilization date", "date of sterilization"],
  sterilizedBy: ["sterilized by", "sterilization performed by"],
  wallThickness: ["wall thickness", "thickness of test item", "thickness of medical device"],
  extractionRatios: ["extraction ratio", "extraction ratios", "surface area or mass / volume ratio", "surface area and weight"],
  sampleSterile: ["sterile", "sterility", "sterility condition", "sample sterile"],
  sterilizationMethod: ["sterilization", "sterilization type", "sterilization method", "sterilize by", "sterilized by method"],
  appearance: ["appearance", "physical appearance", "physical description", "colour", "color", "colour of the product", "color of the product"],
  productColor: ["color", "colour", "color of the product", "colour of the product"],
  deviceType: ["device type", "physical state", "type of product"],
  productType: ["type of product", "product type"],
  materialsOfConstruction: ["materials of construction", "type of material construction", "composition", "material composition", "materials"],
  composition: ["composition", "material composition"],
  shippingCondition: ["shipping condition", "ship via"],
  sampleStorage: ["storage condition", "storage conditions", "sample storage", "sample storage condition"],
  sampleDisposition: ["disposition", "sample disposition", "disposal", "disposal details", "sample disposal", "fate of remaining test/reference item", "sample return/disposal"],
  safetyPrecautions: ["safety precautions", "handling precautions", "handling precaution", "test item handling requirement"],
  bPartnerName: ["sponsor name", "sponsor", "company", "applicant", "applicant name", "applicant details", "name and complete address of sponsor", "name of sponsor", "sponsor name and address"],
  address: ["address", "sponsor address", "company address", "shipping address"],
  contactName: ["contact", "contact person", "study coordinator", "sponsor's representative", "name of sponsor's representative", "name of the sponsor's representative"],
  email: ["email", "email address", "e-mail", "e-mail id"],
  phone: ["phone", "telephone", "telephone number", "contact number"],
  poNumber: ["p.o. no", "po number", "purchase order"],
  quoteNumber: ["quote no", "quote number", "request for test quotation"],
  studyCompliance: ["study compliance", "compliance", "regulatory status", "scope of testing"],
  pH: ["ph", "ph of device"],
  purityConcentration: ["purity", "purity / concentration", "concentration"],
  density: ["density"],
  solubility: ["solubility", "solubility of test item"],
  casNumber: ["cas number", "cas no", "cas #"],
  molecularFormula: ["molecular formula"],
  molecularWeight: ["molecular weight"],
  chemicalName: ["chemical name", "chemical name (iupac)", "iupac name"],
  methodOfManufacturing: ["method of manufacturing", "primary method of manufacturing", "manufacturing method", "method of manufacturing and/or synthesis"],
  extractionMethod: ["extraction method", "test article extraction method"],
  polarVehicle: ["polar extraction vehicle", "polar vehicle"],
  nonPolarVehicle: ["non-polar extraction vehicle", "non polar extraction vehicle", "non-polar vehicle"],
  extractionTemperature: ["extraction temperature", "temperature [°c]", "temperature stability", "temperature stability of medical device"],
  samplesPooled: ["samples pooled", "samples pooled for extraction", "will there be multiple components or samples that need to be pooled"],
  canBeCut: ["can the test article be cut", "can product be cut", "can samples be cut", "can be cut prior to extraction"],
  biohazard: ["biohazard", "is sample a biohazard"],
  predicateDevice: ["predicate device"],
  absorptionCheck: ["absorption check"],
  msdsAttached: ["msds attached", "material safety data sheet attached", "sds attached", "sds available"],
  coaAttached: ["coa attached", "certificate of analysis", "certificate of analysis attached"],
  cadDrawingsAttached: ["cad drawings", "submit cad drawings"],
  mdrClassification: ["classification as per european guideline", "mdr classification", "mdr2017/745"],
  mdrRule: ["mdr rule", "rule"],
  indianMdrClass: ["classification as per indian mdr", "indian mdr class"],
  fdaClassification: ["classification as per the us food and drug administration", "fda classification", "us fda classification"],
  bodyContactNature: ["nature of body contact", "classification as per iso 10993-1"],
  sponsorRepresentative: ["sponsor representative", "sponsor's representative", "name of sponsor's representative", "study coordinator"],
  productStable: ["is the product expected to be stable", "product stable", "stability of test item"],
  packagingDetails: ["pack size", "packaging details", "pack size / packaging details"],
  totalQuantitySupplied: ["total quantity supplied", "quantity supplied", "no. of samples shipped", "number of samples shipped"],
  supplierName: ["test item supplied by", "supplier name", "supplied by"],
  doseFormulationAnalysisRequired: ["dose formulation analysis", "requirement of dose formulation analysis"],
  transportationDetails: ["test item transportation details", "transportation details", "shipping condition"],
  handlingRequirements: ["test item handling requirement", "handling requirement", "handling precaution"],
  numberOfSamplesShipped: ["no. of samples shipped", "number of samples shipped"],
  testArticleNameForReport: ["test article name", "test article name for report", "test article name for reports"],
  vatNumber: ["vat", "vat no", "vat-no", "vat number"],
  mailingList: ["mailing list"],
  controlArticle: ["control article", "control article characterization"],
  specialInstructions: ["special instructions", "additional special instructions", "additional information", "additional notes", "comments", "remarks"],
  solventForMoistening: ["moistening with water", "solvent for moistening", "moistening"],
  sampleStability: ["sample stability", "stability"],
  sponsorSignatureDate: ["sponsor signature", "authorized signature", "sign & date", "sponsor sign & date"],
};

// Inverse lookup: normalizedKey -> schemaField name. Built once
// at module load so each detected label costs O(1) to classify.
const ALIAS_TO_FIELD = (() => {
  const m = new Map();
  for (const [field, aliases] of Object.entries(SAMPLE_FIELD_ALIASES)) {
    m.set(normalizeKey(field), field);
    for (const alias of aliases) {
      m.set(normalizeKey(alias), field);
    }
  }
  return m;
})();

// Strip punctuation, collapse whitespace, lowercase. Used both
// when building the lookup table and when classifying extracted
// labels — both sides need the exact same normalization for
// matches to land.
export function normalizeKey(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[\u00a0]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Strip leading list/section numbering and bullet glyphs from a
// candidate label/line. Customer TRF forms ship with prefixes like
// "1.", "1)", "(2)", "2.1", "* ", "- ", "•" baked into the label
// text — without stripping these the same field "Sponsor Name"
// shows up multiple times (numbered vs not) AND the normalized key
// fails to match its schema alias because the leading digit
// survives normalization. Trim them all in one place so the colon /
// whitespace / next-line patterns below work uniformly.
function stripLabelPrefix(s) {
  if (!s) return "";
  let t = String(s);
  // Bullet glyphs and dashes followed by space.
  t = t.replace(/^[\s\u00a0]*[*•·●○\-–—]\s+/, "");
  // "(1)", "(12)" parens-numbered.
  t = t.replace(/^\(\d+\)\s+/, "");
  // "1.", "1.1", "1.1.1", "1)" optionally followed by a space.
  t = t.replace(/^\d+(?:\.\d+)*[.)]?\s+/, "");
  return t.trim();
}

// True if `s` is a plausible value (has visible non-noise content
// that isn't itself a stand-alone label). Used to drop candidate
// label/value pairs where the "value" is actually the next field's
// header — common in PDF text dumps where labels and values can
// land on consecutive lines.
function looksLikeValue(s) {
  if (!s) return false;
  const t = String(s).trim();
  if (t.length === 0) return false;
  // A trailing colon is a strong signal that this is another label,
  // not a value.
  if (/[:：]$/.test(t)) return false;
  return true;
}

// Lowercase, strip-noise variant of the line-level filter we apply
// after parsing — used to catch boilerplate that the colon /
// whitespace patterns would otherwise turn into "fields".
const BOILERPLATE_LABELS = new Set(
  [
    "page",
    "page of",
    "page x of y",
    "section",
    "notes",
    "note",
    "tel",
    "fax",
    "yes",
    "no",
    "date",
    "end",
    "place",
    "form",
    "test request form",
    "trf",
    "sponsor",
    "subject",
    "to",
    "from",
    "re",
    "ref",
    "rev",
    "revision",
    "version",
    "confidential",
    "draft",
    "internal use only",
    "for office use only",
    "office use only",
    "questionnaire",
    "checklist",
    "yes no",
    "yes / no",
  ].map((s) => normalizeKey(s)),
);

// `line.split(",")` collapses quoted values that legitimately
// contain commas. xlsx sheet_to_csv emits CSV per RFC4180, so we
// parse it the same way here. Returns an array of cell strings.
function splitCsvRow(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

// ============================================================
// Buffer -> text. Each branch is wrapped so a single bad file
// doesn't bring down a batch upload.
// ============================================================
async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result?.text || "";
}

async function extractTextFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result?.value || "";
}

function extractTextFromXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  let out = "";
  for (const sheetName of wb.SheetNames) {
    out += `\n===== SHEET: ${sheetName} =====\n`;
    out += XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { blankrows: false });
  }
  return out;
}

// `extension` is preferred over mimeType because customer-supplied
// files often arrive with `application/octet-stream`.
async function extractText({ buffer, filename = "", mimeType = "" }) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (ext === "pdf" || mime === "application/pdf") {
    return extractTextFromPdf(buffer);
  }
  if (ext === "docx" || ext === "doc" || mime.includes("word")) {
    return extractTextFromDocx(buffer);
  }
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm" || mime.includes("sheet") || mime.includes("excel")) {
    return extractTextFromXlsx(buffer);
  }
  // Unknown — try a heuristic: PDFs always start with "%PDF-"
  if (buffer && buffer.slice(0, 5).toString() === "%PDF-") {
    return extractTextFromPdf(buffer);
  }
  throw new Error(`Unsupported file extension/mime: ${ext} / ${mime}`);
}

// ============================================================
// Label / field detection.
// ------------------------------------------------------------
// Customer TRF / TIDS / PCF forms come in three flavours and the
// extractor below has to handle all of them off a single text
// dump:
//
//   1) "Label: value"                inline, same line.
//   2) "Label    Value"              column-aligned (PDF tables
//                                     and tab-separated docs).
//   3) "Label,Value,Label2,Value2"   xlsx sheet_to_csv output —
//                                     possibly multiple pairs per
//                                     row when the form uses
//                                     side-by-side columns.
//   4) Bare "Label:" on its own line followed by the value on the
//      next non-empty line — common in PDFs where the renderer
//      puts every cell on its own line. We also accept bare
//      labels without a trailing colon when they exactly match a
//      known schema alias (so e.g. "Sponsor Name" still resolves
//      to bPartnerName even when the PDF strips the colon).
//
// Output is a deduplicated array of { label, normalizedKey,
// sampleValue, matchStatus, schemaField } records.
//
// Compared with the original implementation this version:
//   - strips list / bullet prefixes ("1.", "(2)", "- ") from
//     labels before normalizing so numbered TRF sections collapse
//     onto the right schema field;
//   - drops candidate values that themselves end with ":" (those
//     are the next field's header, not the current field's
//     value — a frequent failure mode in PDF text dumps);
//   - parses xlsx CSV rows column-aware (so "Label,,,,Value" still
//     resolves to the right pair) and walks every adjacent pair on
//     the row instead of stopping at the first comma;
//   - allows the bare-label fallback for any label ending in ":",
//     not just labels matching the alias dictionary, so customer-
//     specific custom fields get suggested too;
//   - filters out boilerplate ("Page x of y", "Confidential", a
//     bare "Section:", "Form:", etc.) that would otherwise pollute
//     the detected-fields list.
// ============================================================
export function detectFields(text) {
  if (!text || typeof text !== "string") return [];

  const seen = new Map(); // normalizedKey -> field record

  const rawLines = text.split(/\r?\n/);
  const lines = rawLines
    .map((l) => l.replace(/[\u00a0]/g, " ").replace(/\t/g, "    ").trim())
    .filter((l) => l.length > 0);

  // Helper closes around `seen` and applies the same
  // dedup / noise-filter / longest-value-wins logic the old
  // implementation had. Kept inline so the per-pattern blocks
  // below stay declarative.
  const recordPair = (rawLabel, rawValue) => {
    const cleanLabel = stripLabelPrefix(String(rawLabel || ""))
      .replace(/\s+/g, " ")
      .trim();
    if (cleanLabel.length < 2 || cleanLabel.length > 120) return;

    const norm = normalizeKey(cleanLabel);
    if (!norm) return;
    if (BOILERPLATE_LABELS.has(norm)) return;

    const valueRaw = String(rawValue || "").trim();
    // Drop candidate values that look like another label header.
    // Empty values are still allowed (so the field gets surfaced
    // as a candidate even when the form was uploaded blank).
    const valueClean = looksLikeValue(valueRaw)
      ? valueRaw.replace(/^[,;\s]+|[,;\s]+$/g, "").slice(0, 200)
      : "";

    if (seen.has(norm)) {
      const prev = seen.get(norm);
      if (valueClean.length > (prev.sampleValue || "").length) {
        prev.sampleValue = valueClean;
      }
      return;
    }

    const schemaField = ALIAS_TO_FIELD.get(norm);
    seen.set(norm, {
      label: cleanLabel,
      normalizedKey: norm,
      sampleValue: valueClean,
      matchStatus: schemaField ? "schema" : "custom",
      schemaField: schemaField || undefined,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1) "Label: value" — inline, same line.
    const colonMatch = line.match(/^(.{2,120}?)\s*[:：]\s*(.*)$/);
    if (colonMatch && /[a-z]/i.test(colonMatch[1])) {
      recordPair(colonMatch[1], colonMatch[2]);
      continue;
    }

    // 2) "Label,Value[,Label2,Value2,...]" — xlsx CSV row.
    if (line.includes(",")) {
      const cells = splitCsvRow(line).filter((c) => c.length > 0);
      // Only treat this as a label/value row when there's at
      // least one (label, value) pair AND the first cell looks
      // labelly (has letters, not just digits / punctuation).
      if (cells.length >= 2 && /[a-z]/i.test(cells[0])) {
        for (let j = 0; j + 1 < cells.length; j += 2) {
          const lbl = cells[j];
          const val = cells[j + 1];
          if (lbl && /[a-z]/i.test(lbl) && lbl.length < 120) {
            recordPair(lbl, val);
          }
        }
        continue;
      }
    }

    // 3) "Label    Value" — column-aligned (2+ spaces between).
    //    Only when both halves have visible characters and the
    //    label half isn't suspiciously long.
    const colMatch = line.match(/^([^\s][^\t]{0,80}?[^\s])\s{2,}(\S.*)$/);
    if (colMatch && /[a-z]/i.test(colMatch[1]) && colMatch[1].length < 80) {
      recordPair(colMatch[1], colMatch[2]);
      continue;
    }

    // 4) Bare label, value on the next non-empty line.
    //    Two acceptance paths:
    //      a) Line ends with ":" — strong intent signal.
    //      b) Normalized line matches a known schema alias
    //         (covers PDFs that strip colons from form labels).
    if (line.length < 120 && /[a-z]/i.test(line)) {
      const cleaned = stripLabelPrefix(line);
      const trimmed = cleaned.replace(/[:：]\s*$/, "").trim();
      const norm = normalizeKey(trimmed);
      const endsWithColon = /[:：]\s*$/.test(cleaned);
      const isKnownAlias = norm && ALIAS_TO_FIELD.has(norm);
      if (endsWithColon || isKnownAlias) {
        // Find the next non-empty line that isn't itself another
        // label header. We look ahead at most 2 lines so we don't
        // pull values from far down the document.
        let value = "";
        for (let k = 1; k <= 2; k++) {
          const peek = lines[i + k];
          if (!peek) break;
          if (/[:：]\s*$/.test(peek.trim())) break; // next label
          value = peek.slice(0, 200);
          break;
        }
        recordPair(trimmed, value);
        continue;
      }
    }
  }

  return Array.from(seen.values()).filter((f) => f.label.length >= 3);
}

// ============================================================
// Top-level: scan a buffer, return both text and detected fields
// (plus an extractionError sentinel so the caller can still save
// the document record even when parsing fails).
// ============================================================
export async function scanDocument({ buffer, filename, mimeType }) {
  try {
    const text = await extractText({ buffer, filename, mimeType });
    const detectedFields = detectFields(text);
    return {
      extractedText: (text || "").slice(0, 50000), // cap to keep doc size sane
      detectedFields,
      extractionError: null,
    };
  } catch (err) {
    return {
      extractedText: "",
      detectedFields: [],
      extractionError: err.message || String(err),
    };
  }
}

export default scanDocument;
