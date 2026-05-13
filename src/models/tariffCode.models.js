import mongoose from "mongoose";

/**
 * Schedule B / HS Tariff Code reference data.
 *
 * Loaded from the U.S. Census Bureau export concordance file (econcord.txt)
 * by `scripts/loadScheduleB.js`. This collection is global — Schedule B is
 * the same for every U.S. exporter, so it is intentionally NOT scoped by
 * company_id.
 *
 * The 10-digit `code` is what eventually goes into Shippo's customs item
 * `tariff_number` field. `description` and `descriptionLong` feed the
 * autocomplete UI on the Sample submission form.
 *
 * Census layout (1-indexed, fixed-width):
 *   1-10    Schedule B 10-digit code
 *   15-65   Short description (51 chars)
 *   70-219  Long description  (150 chars)
 *   225-227 Quantity 1 unit (e.g. NO, KG, X)
 *   233-235 Quantity 2 unit
 *   241-245 SITC code
 *   251-255 End-use code
 *   261     USDA flag
 *   266-271 NAICS code
 *   277-278 HiTech classification
 */
const tariffCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      // Stored without dots, exactly as Census ships it (10 digits).
    },
    // 6-digit international HS prefix — handy if a freight forwarder asks
    // for the harmonized portion only.
    code6: { type: String, index: true },
    // 4-digit heading and 2-digit chapter — used for filtering ("show me
    // only Chapter 90 / medical instruments") and breadcrumbs in the UI.
    heading: { type: String, index: true },
    chapter: { type: String, index: true },

    description: { type: String, required: true },
    descriptionLong: { type: String },

    // Unit of quantity that Census expects on the EEI filing. Most lab
    // samples are reported as "NO" (number) or "KG" (kilograms).
    quantityUnit1: { type: String },
    quantityUnit2: { type: String },

    // Optional cross-reference codes — kept around for completeness so we
    // can surface them in the picker / commercial invoice if needed.
    sitc: { type: String },
    endUse: { type: String },
    naics: { type: String },
    hitech: { type: String },
    usda: { type: String },

    // Year of the Schedule B revision this row was sourced from (e.g.
    // 2026). The Census publishes annual concordance files; older rows
    // may be flagged obsolete after a re-load.
    year: { type: Number, index: true },
    obsolete: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Text index powers the keyword search (`/api/tariff-codes/search?q=...`).
// Weighting `description` higher than `descriptionLong` keeps short, more
// specific matches at the top of the results.
tariffCodeSchema.index(
  { description: "text", descriptionLong: "text" },
  { weights: { description: 5, descriptionLong: 1 }, name: "tariffCodeTextIndex" }
);

// Compound index for filtered, alphabetical browsing within a chapter.
tariffCodeSchema.index({ chapter: 1, code: 1 });

const TariffCode = mongoose.model("TariffCode", tariffCodeSchema);

export default TariffCode;
