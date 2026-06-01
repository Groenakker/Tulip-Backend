// ============================================================
// Document filler
// ------------------------------------------------------------
// The Shipping Log "Print BP document" feature always returns a
// brand-new PDF, regardless of whether the partner uploaded a
// PDF, DOCX, or XLSX template. We don't try to mutate the
// original file in-place anymore — that approach was unreliable
// (PDFs almost never have AcroForms, Word splits labels across
// <w:r> runs, XLSX cells often share labels via a string table)
// and produced a "filled" file that visually still looked
// identical to the empty template.
//
// Instead, at upload time the scanner already pulled plain text
// out of every supported file type and cached it on
// `sampleDocument.extractedText`. We use that as the source of
// truth for the printed copy: render the text into a clean PDF
// using pdf-lib's standard Helvetica font, and on every line
// where the scanner detected a known label, substitute the
// shipping log's value next to that label. Plus a header
// section that always carries the shipment summary (customer,
// addresses, parcel, items shipped) so the printout is useful
// for shipping/customs paperwork on its own.
//
// `buildShippingValueMap` walks the shipping doc + every linked
// Sample (which is the Sample Submission record — schema is
// shared) + project + partner and produces a flat
// `{ schemaField: "value" }` map. Multi-line shipments collapse
// values across all lines (e.g. lot numbers print as
// "L-001, L-002, L-003").
// ============================================================

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { normalizeKey, SAMPLE_FIELD_ALIASES } from "./documentScanner.js";

// ------------------------------------------------------------
// Value map construction
// ------------------------------------------------------------

const fmt = (v) => {
  if (v === undefined || v === null) return "";
  if (v instanceof Date) return v.toLocaleDateString();
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.filter(Boolean).map(fmt).join(", ");
  if (typeof v === "object") {
    if (v.street1 || v.city || v.state || v.zip || v.country) {
      return [v.name || v.company, v.street1, v.street2, v.city, v.state, v.zip, v.country]
        .filter(Boolean).join(", ");
    }
    return Object.values(v).filter(Boolean).map(fmt).join(", ");
  }
  return String(v);
};

const join = (...parts) => parts.map(fmt).filter(Boolean).join(", ");

// Build a flat schemaField -> value map for a shipping record.
// Pulls from the shipping doc itself, every linked Sample row,
// the project, and the partner. Multi-sample shipments get
// joined values across lines.
//
// Returns an object: { schemaField: "value", ... }. Empty values
// are NOT included.
export function buildShippingValueMap({ shipping, lines = [], samples = [], project, partner }) {
  const out = {};
  const set = (key, val) => {
    if (!key) return;
    const v = fmt(val);
    if (!v) return;
    if (out[key]) return;
    out[key] = v;
  };

  if (shipping) {
    set("shippingCode", shipping.shippingCode);
    set("shipmentOrigin", shipping.shipmentOrigin);
    set("shipmentDestination", shipping.shipmentDestination);
    set("shippingCondition", shipping.note);
    set("shipmentDate", shipping.shipmentDate);
    set("estimatedArrivalDate", shipping.estimatedArrivalDate || shipping.estDate);
    set("trackingNumber", shipping.trackingNumber);
    set("transportationDetails", join(shipping.carrier, shipping.serviceLevelName, shipping.trackingNumber));
    if (shipping.parcel) {
      const p = shipping.parcel;
      set("packagingDetails",
        [p.length && p.width && p.height ? `${p.length}x${p.width}x${p.height} ${p.distance_unit || ""}`.trim() : "",
         p.weight ? `${p.weight} ${p.mass_unit || ""}`.trim() : ""]
          .filter(Boolean).join(", "));
      set("netWeightTotal", p.weight ? `${p.weight} ${p.mass_unit || ""}`.trim() : "");
    }
    if (shipping.customerSnapshot) {
      const s = shipping.customerSnapshot;
      set("address", join(s.street1, s.street2, s.city, s.state, s.zip, s.country));
      set("email", s.email);
      set("phone", s.phone);
      set("contactName", s.name);
    }
  }

  if (project) {
    set("projectName", project.name || project.projectCode);
    set("poNumber", project.poNumber);
    set("quoteNumber", project.quoteNumber);
  }

  if (partner) {
    set("bPartnerName", partner.name);
    set("vatNumber", partner.vatNumber);
    set("mailingList", partner.mailingList);
    set("manufacturer", partner.name);
    set("supplierName", partner.name);
  }

  // Collect across all linked samples; the shipping context cares
  // about most of the schema fields a TRF would typically print.
  const collect = {};
  const push = (key, v) => {
    const s = fmt(v);
    if (!s) return;
    (collect[key] = collect[key] || []).push(s);
  };

  const SAMPLE_FIELDS = [
    "sampleDescription", "intendedUse", "partNumber", "lotNumber",
    "batchNumber", "serialNumber", "devicesUsed", "countryOrigin",
    "sampleMass", "surfaceArea", "contactType", "contactDuration",
    "manufacturer", "manufactureDate", "expirationDate",
    "wallThickness", "extractionRatios", "sampleSterile",
    "sterilizationMethod", "sterilizationDate", "sterilizedBy",
    "appearance", "deviceType", "productType", "productColor",
    "materialsOfConstruction", "composition", "sampleStorage",
    "sampleDisposition", "safetyPrecautions", "studyCompliance",
    "chemicalName", "casNumber", "molecularFormula", "molecularWeight",
    "pH", "purityConcentration", "density", "solubility",
    "methodOfManufacturing", "extractionMethod", "polarVehicle",
    "nonPolarVehicle", "extractionTemperature", "samplesPooled",
    "canBeCut", "biohazard", "predicateDevice", "absorptionCheck",
    "msdsAttached", "coaAttached", "cadDrawingsAttached",
    "productStable", "doseFormulationAnalysisRequired",
    "mdrClassification", "mdrRule", "indianMdrClass",
    "fdaClassification", "bodyContactNature", "packagingDetails",
    "totalQuantitySupplied", "numberOfSamplesShipped", "supplierName",
    "transportationDetails", "handlingRequirements",
    "testArticleNameForReport", "controlArticle", "specialInstructions",
    "solventForMoistening", "sampleStability", "sponsorRepresentative",
    "sponsorSignatureDate", "surfaceAreaDirect", "surfaceAreaIndirect",
    "netWeightDirect", "netWeightIndirect", "address", "email", "phone",
    "contactName", "bPartnerName", "poNumber", "quoteNumber",
  ];

  for (const sample of samples) {
    if (!sample) continue;
    for (const f of SAMPLE_FIELDS) {
      if (sample[f] !== undefined && sample[f] !== null && String(sample[f]).trim() !== "") {
        push(f, sample[f]);
      }
    }
    if (Array.isArray(sample.customFields)) {
      for (const cf of sample.customFields) {
        if (cf?.label && cf?.value) {
          push(`__custom:${normalizeKey(cf.label)}`, cf.value);
        }
      }
    }
  }

  const totalQty = lines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0);
  if (totalQty > 0) {
    push("totalQuantitySupplied", totalQty);
    push("numberOfSamplesShipped", totalQty);
  }
  for (const l of lines) {
    if (l.lot) push("lotNumber", l.lot);
    if (l.description && !samples.length) push("sampleDescription", l.description);
  }

  for (const [k, vals] of Object.entries(collect)) {
    const uniq = Array.from(new Set(vals.map((v) => v.trim()))).filter(Boolean);
    if (!out[k] && uniq.length) {
      out[k] = uniq.join(", ");
    }
  }

  return out;
}

// Build a label-to-value lookup keyed by normalized label string.
// Expands a schemaField -> value map across all aliases for that
// field so the renderer can match any label the BP doc uses
// (e.g. the value for `bPartnerName` resolves whether the doc
// says "Sponsor Name", "Company", or "Applicant").
function expandValueMapByLabel(valueMap) {
  const byLabel = new Map();
  for (const [field, value] of Object.entries(valueMap || {})) {
    if (!value) continue;
    if (field.startsWith("__custom:")) {
      byLabel.set(field.slice("__custom:".length), value);
      continue;
    }
    byLabel.set(normalizeKey(field), value);
    const aliases = SAMPLE_FIELD_ALIASES[field] || [];
    for (const a of aliases) {
      byLabel.set(normalizeKey(a), value);
    }
  }
  return byLabel;
}

// ------------------------------------------------------------
// PDF rendering helpers
// ------------------------------------------------------------

// pdf-lib's standard fonts (Helvetica) only encode WinAnsi
// (CP1252). Customer documents often contain characters outside
// that range (em-dashes, smart quotes, fractions, °, ²) — those
// would crash drawText with WinAnsi.encodeUnicodeCodePoint
// errors. Pre-replace common offenders, drop everything else
// outside the WinAnsi-encodable range so the renderer never
// throws on a malformed scrap of text.
function sanitizeText(text) {
  if (!text) return "";
  let s = String(text)
    .replace(/[\u00a0]/g, " ")
    .replace(/[\u2010-\u2015]/g, "-")    // various dashes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2022\u2023\u25E6]/g, "*") // bullets
    .replace(/[\u2026]/g, "...")
    .replace(/[\u00b2]/g, "^2")
    .replace(/[\u00b3]/g, "^3")
    .replace(/[\u2032]/g, "'")
    .replace(/[\u2033]/g, '"');
  // Drop anything that won't WinAnsi-encode. Keep printable ASCII
  // (0x20-0x7E) plus the Latin-1 supplement range (0xA0-0xFF) plus
  // newlines so wrapping logic works.
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code === 0x0a || code === 0x0d) {
      out += ch;
    } else if (code >= 0x20 && code <= 0x7e) {
      out += ch;
    } else if (code >= 0xa0 && code <= 0xff) {
      out += ch;
    }
    // Else drop silently.
  }
  return out;
}

// Greedy word-wrap to fit a max width in PDF points.
function wrapText(text, font, size, maxWidth) {
  if (!text) return [""];
  const out = [];
  for (const line of String(text).split(/\n/)) {
    if (!line.trim()) {
      out.push("");
      continue;
    }
    const words = line.split(/\s+/);
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      let w;
      try {
        w = font.widthOfTextAtSize(test, size);
      } catch {
        w = test.length * size * 0.5;
      }
      if (w > maxWidth && current) {
        out.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) out.push(current);
  }
  return out.length > 0 ? out : [""];
}

// ------------------------------------------------------------
// Main renderer
// ------------------------------------------------------------
// Always returns a Buffer of a PDF, even when the source template
// is a DOCX or XLSX. The PDF has three sections:
//   1. Header  - BP name, original template filename, generated
//                date, shipping code.
//   2. Shipment Information - origin/destination/dates/parcel/
//                ship-from / ship-to / contact + Items Shipped.
//   3. Test Request Form (filled) - the original document's
//                extractedText, with values substituted on every
//                line where the scanner had detected a label
//                that maps to one of our schemaFields.
//
// Falls back gracefully when extractedText is missing (no
// section 3) or when the template was uploaded before the
// scanner shipped (we still emit a valid PDF with section 1+2).
async function renderFilledPdf({
  shipping,
  partner,
  currentDoc,
  valueMap,
  lines = [],
  samples = [],
}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 595.28; // A4 width  in points
  const PAGE_H = 841.89; // A4 height in points
  const MARGIN = 50;
  const CONTENT_W = PAGE_W - 2 * MARGIN;

  const VALUE_COLOR = rgb(0.04, 0.36, 0.7); // matches app accent
  const RULE_COLOR = rgb(0.78, 0.83, 0.89);
  const MUTED_COLOR = rgb(0.4, 0.42, 0.45);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const ensureSpace = (h) => {
    if (y - h < MARGIN) newPage();
  };

  // Draw a single visual line (no wrapping). `chunks` lets us
  // paint the label part black and the value part in the accent
  // colour so filled fields are easy to spot.
  const drawChunkRow = (chunks, opts = {}) => {
    const size = opts.size || 10;
    ensureSpace(size + 4);
    let x = MARGIN;
    for (const c of chunks) {
      const f = c.bold ? fontBold : font;
      const text = sanitizeText(c.text || "");
      if (!text) continue;
      try {
        page.drawText(text, {
          x,
          y: y - size,
          size,
          font: f,
          color: c.color || rgb(0, 0, 0),
        });
        x += f.widthOfTextAtSize(text, size);
      } catch {
        // Skip text we can't render rather than aborting the whole PDF.
      }
    }
    y -= size + 4;
  };

  const drawText = (text, opts = {}) => {
    const size = opts.size || 10;
    const f = opts.bold ? fontBold : font;
    const wrapped = wrapText(sanitizeText(text || ""), f, size, CONTENT_W);
    for (const wl of wrapped) {
      ensureSpace(size + 4);
      try {
        page.drawText(wl, {
          x: MARGIN,
          y: y - size,
          size,
          font: f,
          color: opts.color || rgb(0, 0, 0),
        });
      } catch {
        /* skip undrawable line */
      }
      y -= size + 4;
    }
  };

  const drawHr = () => {
    ensureSpace(8);
    page.drawLine({
      start: { x: MARGIN, y: y - 2 },
      end: { x: MARGIN + CONTENT_W, y: y - 2 },
      thickness: 0.6,
      color: RULE_COLOR,
    });
    y -= 10;
  };

  const drawSection = (title) => {
    y -= 6;
    drawText(title, { bold: true, size: 12 });
    drawHr();
  };

  const drawKv = (label, value) => {
    const v = sanitizeText(fmt(value));
    if (!v) return;
    drawChunkRow([
      { text: `${label}: `, bold: true },
      { text: v, color: VALUE_COLOR },
    ]);
  };

  // -- Header ------------------------------------------------
  const titleName = partner?.name ? `${partner.name} - Sample Submission` : "Sample Submission";
  drawText(titleName, { bold: true, size: 16 });
  drawText(`Original template: ${currentDoc?.filename || "-"}`, { size: 9, color: MUTED_COLOR });
  drawText(
    `Generated: ${new Date().toLocaleString()}    Shipping: ${shipping?.shippingCode || "(unsaved)"}`,
    { size: 9, color: MUTED_COLOR }
  );
  drawHr();

  // -- Shipment Information ---------------------------------
  drawSection("Shipment Information");
  drawKv("Shipping Code", shipping?.shippingCode);
  drawKv("Customer", partner?.name);
  drawKv("Origin", shipping?.shipmentOrigin);
  drawKv("Destination", shipping?.shipmentDestination);
  if (shipping?.shipmentDate) drawKv("Shipment Date", new Date(shipping.shipmentDate).toLocaleDateString());
  if (shipping?.estimatedArrivalDate) drawKv("Estimated Arrival", new Date(shipping.estimatedArrivalDate).toLocaleDateString());
  if (shipping?.trackingNumber) drawKv("Tracking", `${shipping.carrier || ""} ${shipping.trackingNumber}`.trim());
  if (shipping?.parcel) {
    const p = shipping.parcel;
    if (p.length || p.width || p.height) {
      drawKv("Parcel size", `${p.length || "?"} x ${p.width || "?"} x ${p.height || "?"} ${p.distance_unit || ""}`.trim());
    }
    if (p.weight) drawKv("Parcel weight", `${p.weight} ${p.mass_unit || ""}`.trim());
  }
  if (shipping?.shipFrom) {
    const sf = shipping.shipFrom;
    drawKv("Ship From", [sf.name || sf.company, sf.street1, sf.city, sf.state, sf.zip, sf.country].filter(Boolean).join(", "));
  }
  if (shipping?.customerSnapshot) {
    const s = shipping.customerSnapshot;
    drawKv("Ship To", [s.name || s.company, s.street1, s.city, s.state, s.zip, s.country].filter(Boolean).join(", "));
    if (s.email) drawKv("Contact email", s.email);
    if (s.phone) drawKv("Contact phone", s.phone);
  }

  // -- Items Shipped ----------------------------------------
  if (Array.isArray(lines) && lines.length > 0) {
    drawSection("Items Shipped");
    drawChunkRow([
      { text: "Sample".padEnd(20), bold: true },
      { text: "Description".padEnd(40), bold: true },
      { text: "Lot".padEnd(15), bold: true },
      { text: "Qty", bold: true },
    ], { size: 9 });
    for (const line of lines) {
      const sample = (samples || []).find((s) => String(s._id) === String(line.sampleId));
      drawChunkRow([
        { text: String(line.sampleCode || sample?.sampleCode || "-").padEnd(20) },
        { text: String(line.description || sample?.sampleDescription || "-").padEnd(40) },
        { text: String(line.lot || sample?.lotNumber || "-").padEnd(15) },
        { text: String(line.quantity ?? 0) },
      ], { size: 9 });
    }
  }

  // -- Filled Test Request Form -----------------------------
  // Only useful when we have the cached extractedText. Empty
  // for very old uploads / scan failures — in which case we
  // simply skip this section instead of producing a blank one.
  const extractedText = currentDoc?.extractedText || "";
  if (extractedText && extractedText.trim().length > 0) {
    drawSection("Test Request Form (filled)");
    const byLabel = expandValueMapByLabel(valueMap);

    // Walk extractedText line by line, fold values into matched
    // labels. We try (in order):
    //   "Label: existing"   -> "Label: <value>"   when matched
    //   "Label:"            -> "Label: <value>"
    //   bare "Label"        -> "Label: <value>"
    // Lines that don't match any label render unchanged so the
    // section / heading structure of the original template is
    // preserved.
    const rawLines = extractedText.split(/\r?\n/);
    let prevBlank = false;
    for (const raw of rawLines) {
      const t = raw.replace(/[\u00a0]/g, " ").trim();
      if (!t) {
        if (!prevBlank) {
          y -= 4;
          prevBlank = true;
        }
        continue;
      }
      prevBlank = false;

      // Try inline "Label: value" pattern
      const colonMatch = t.match(/^(.{2,120}?)[:：]\s*(.*)$/);
      if (colonMatch && /[a-z]/i.test(colonMatch[1])) {
        const labelText = colonMatch[1].trim();
        const existingValue = colonMatch[2].trim();
        const norm = normalizeKey(labelText);
        const value = byLabel.get(norm);
        if (value) {
          drawChunkRow([
            { text: `${labelText}: `, bold: true },
            { text: value, color: VALUE_COLOR },
            ...(existingValue ? [{ text: `   (was: ${existingValue})`, color: MUTED_COLOR }] : []),
          ], { size: 9 });
          continue;
        }
        // No value match — print as-is.
        drawText(t, { size: 9 });
        continue;
      }

      // Bare label match (no colon)
      const norm = normalizeKey(t);
      const value = byLabel.get(norm);
      if (value) {
        drawChunkRow([
          { text: `${t}: `, bold: true },
          { text: value, color: VALUE_COLOR },
        ], { size: 9 });
        continue;
      }

      // Unmatched body text — render plain.
      drawText(t, { size: 9 });
    }
  }

  // -- Footer note ------------------------------------------
  ensureSpace(20);
  y -= 8;
  drawText(
    "Auto-generated from the customer's current sample document. Values are pulled from the linked shipping log, samples, and business partner records. The original uploaded template is retained on the partner's Sample Documents tab.",
    { size: 7, color: MUTED_COLOR }
  );

  return Buffer.from(await pdfDoc.save());
}

// ------------------------------------------------------------
// Top-level entry point
// ------------------------------------------------------------
// Always returns a PDF, regardless of the input file format.
// Returns { buffer, mimeType, filename }.
export async function fillDocument({ shipping, partner, currentDoc, valueMap, lines, samples }) {
  const buffer = await renderFilledPdf({
    shipping,
    partner,
    currentDoc,
    valueMap: valueMap || {},
    lines: lines || [],
    samples: samples || [],
  });
  const baseName = (currentDoc?.filename || "sample-document")
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9_.\-]+/g, "_") || "sample-document";
  return {
    buffer,
    mimeType: "application/pdf",
    filename: `${baseName}-filled.pdf`,
  };
}

export default fillDocument;
