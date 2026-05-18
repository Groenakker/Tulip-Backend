// Standalone sanity check for the BP import field mapping.
// Loads the sample workbook and prints the resulting payload for the first
// few rows without writing to the database. Run with:
//   node scripts/verify-bp-import.js "C:/path/to/file.xlsx"
import xlsx from "xlsx";
import path from "path";

const FILE = process.argv[2] || "C:/Users/pc/Downloads/BP Master Data , Contact , Address, Phone.xlsx";

const cleanString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};
const cleanPhone = (value) => {
  const raw = cleanString(value);
  if (!raw) return "";
  return raw.replace(/[^\d\s\-+()]/g, "").trim();
};
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
const resolvePartnerCategory = (bpType, code) => {
  const t = cleanString(bpType).toUpperCase();
  if (t === "C") return "Client";
  if (t === "S" || t === "V") return "Vendor";
  if (t === "CLIENT" || t === "CUSTOMER") return "Client";
  if (t === "VENDOR" || t === "SUPPLIER") return "Vendor";
  const c = cleanString(code).toUpperCase();
  if (c.startsWith("V") || c.startsWith("S")) return "Vendor";
  return "Client";
};
const buildShipToAddress = (shipStreet, shipZip, billStreet, billZip) => {
  const ss = cleanString(shipStreet);
  const sz = cleanString(shipZip);
  if (!ss && !sz) return "";
  const sameStreet = ss && billStreet && ss.toLowerCase() === cleanString(billStreet).toLowerCase();
  const sameZip = sz && billZip && sz === cleanString(billZip);
  if (sameStreet && sameZip) return "";
  return [ss, sz].filter(Boolean).join(", ");
};

const wb = xlsx.readFile(FILE, { cellDates: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });
console.log(`Loaded ${rows.length} rows from ${path.basename(FILE)}\n`);

const sample = rows.slice(0, 5);
for (const row of sample) {
  const partnerNumber = cleanString(pickField(row, ["BP Code"]));
  const name = cleanString(pickField(row, ["BP Name"]));
  const bpType = pickField(row, ["BP Type"]);
  const billStreet = cleanString(pickField(row, ["Bill-to Street"]));
  const billZip = cleanString(pickField(row, ["Bill-to Zip Code"]));
  const shipStreet = cleanString(pickField(row, ["Ship-to Street"]));
  const shipZip = cleanString(pickField(row, ["Ship-to Zip Code"]));
  const tel1 = cleanPhone(pickField(row, ["Telephone 1"]));
  const tel2 = cleanPhone(pickField(row, ["Telephone 2"]));
  const contactPerson = cleanString(pickField(row, ["Contact Person"]));

  const partnerPhone = tel1 || tel2;
  const contactPhone = tel1 && tel2 ? tel2 : "";

  const payload = {
    partnerNumber,
    name,
    category: resolvePartnerCategory(bpType, partnerNumber),
    address1: billStreet || undefined,
    address2: buildShipToAddress(shipStreet, shipZip, billStreet, billZip) || undefined,
    zip: billZip || undefined,
    phone: partnerPhone || undefined,
    contact: contactPerson
      ? { name: contactPerson, phone: contactPhone || partnerPhone || undefined }
      : null,
  };
  console.log(JSON.stringify(payload, null, 2));
  console.log("---");
}
