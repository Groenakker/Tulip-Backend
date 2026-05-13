import mongoose from "mongoose";
import dotenv from "dotenv";
import TariffCode from "../src/models/tariffCode.models.js";

dotenv.config();

const main = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const total = await TariffCode.countDocuments();
  const first = await TariffCode.find().sort({ code: 1 }).limit(3).lean();

  const queries = ["tissue", "plastic tubing", "medical instrument", "blood", "diagnostic reagent"];
  console.log(`Total codes in DB: ${total}\n`);
  console.log("First 3 codes by code asc:");
  first.forEach((d) => console.log(`  ${d.code}  ${d.description}`));

  for (const q of queries) {
    const rows = await TariffCode.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(3)
      .lean();
    console.log(`\nText search "${q}":`);
    rows.forEach((d) => console.log(`  ${d.code}  ${d.description}`));
  }

  await mongoose.disconnect();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
