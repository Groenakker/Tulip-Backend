/**
 * Load (or refresh) the U.S. Census Schedule B export concordance into
 * the local MongoDB.
 *
 * Usage:
 *   node scripts/loadScheduleB.js [--file <path>] [--year <yyyy>]
 *
 * Defaults:
 *   --file   $SCHEDULE_B_FILE or ./data/schedule_b/econcord.txt
 *   --year   current calendar year
 *
 * Source data: Schedule B Export Concordance (econcord.txt) from
 *   https://www.census.gov/foreign-trade/schedules/b/index.html#download
 *
 * The file is fixed-width per Census's "exp-stru.txt" layout:
 *   chars  1-10  Schedule B code (10 digits)
 *   chars 15-65  short description
 *   chars 70-219 long description
 *   chars 225-227 quantity unit 1
 *   chars 233-235 quantity unit 2
 *   chars 241-245 SITC
 *   chars 251-255 end-use code
 *   char  261     USDA flag
 *   chars 266-271 NAICS
 *   chars 277-278 HiTech
 *
 * The script streams the file line by line so it stays memory-light even
 * if Census ever ships a larger dataset, and bulk-upserts in batches of
 * 1000 so reloads are fast and idempotent. Codes that exist in the DB
 * but not in the new file are marked `obsolete: true`.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import dotenv from "dotenv";

import TariffCode from "../src/models/tariffCode.models.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--file") out.file = args[++i];
    else if (a === "--year") out.year = Number(args[++i]);
  }
  return out;
};

const safeSlice = (line, start, end) => {
  // Census uses 1-indexed inclusive ranges; JS string slice is 0-indexed
  // half-open. Subtract 1 from `start` and pass `end` directly.
  if (!line || line.length < start) return "";
  return line.substring(start - 1, end).trim();
};

const parseLine = (line) => {
  const code = safeSlice(line, 1, 10);
  if (!code || code.length !== 10 || !/^\d{10}$/.test(code)) return null;
  return {
    code,
    code6: code.slice(0, 6),
    heading: code.slice(0, 4),
    chapter: code.slice(0, 2),
    description: safeSlice(line, 15, 65),
    descriptionLong: safeSlice(line, 70, 219),
    quantityUnit1: safeSlice(line, 225, 227),
    quantityUnit2: safeSlice(line, 233, 235),
    sitc: safeSlice(line, 241, 245),
    endUse: safeSlice(line, 251, 255),
    usda: safeSlice(line, 261, 261),
    naics: safeSlice(line, 266, 271),
    hitech: safeSlice(line, 277, 278),
  };
};

const main = async () => {
  const { file, year } = parseArgs();
  const resolvedFile =
    file ||
    process.env.SCHEDULE_B_FILE ||
    path.join(__dirname, "..", "data", "schedule_b", "econcord.txt");
  const resolvedYear = year || new Date().getFullYear();

  if (!fs.existsSync(resolvedFile)) {
    console.error(`File not found: ${resolvedFile}`);
    console.error(
      "Download the Schedule B export concordance ZIP from " +
        "https://www.census.gov/foreign-trade/schedules/b/index.html#download " +
        "and place econcord.txt at the path above, or pass --file <path>."
    );
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is not set. Aborting.");
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);
  console.log(`Loading Schedule B ${resolvedYear} from ${resolvedFile}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(resolvedFile, "utf8"),
    crlfDelay: Infinity,
  });

  const seenCodes = new Set();
  let bulk = [];
  let inserted = 0;
  let skipped = 0;
  const BATCH_SIZE = 1000;

  const flush = async () => {
    if (bulk.length === 0) return;
    await TariffCode.bulkWrite(bulk, { ordered: false });
    inserted += bulk.length;
    bulk = [];
    if (inserted % 5000 === 0 || inserted < BATCH_SIZE) {
      console.log(`  ...${inserted} codes processed`);
    }
  };

  for await (const raw of rl) {
    const parsed = parseLine(raw);
    if (!parsed) {
      skipped++;
      continue;
    }
    seenCodes.add(parsed.code);
    bulk.push({
      updateOne: {
        filter: { code: parsed.code },
        update: {
          $set: {
            ...parsed,
            year: resolvedYear,
            obsolete: false,
          },
        },
        upsert: true,
      },
    });
    if (bulk.length >= BATCH_SIZE) await flush();
  }
  await flush();

  // Mark codes that are in our DB from a prior load but missing from the
  // new file as obsolete. We never delete — historical shipments still
  // reference them on commercial invoices.
  const obsoleteResult = await TariffCode.updateMany(
    { code: { $nin: Array.from(seenCodes) }, obsolete: { $ne: true } },
    { $set: { obsolete: true } }
  );

  const total = await TariffCode.countDocuments();
  console.log(`\nDone.`);
  console.log(`  loaded:        ${inserted}`);
  console.log(`  skipped lines: ${skipped}`);
  console.log(`  marked obsolete (no longer in source file): ${obsoleteResult.modifiedCount}`);
  console.log(`  total tariff codes in DB: ${total}`);

  await mongoose.disconnect();
  process.exit(0);
};

main().catch((err) => {
  console.error("Loader failed:", err);
  process.exit(1);
});
