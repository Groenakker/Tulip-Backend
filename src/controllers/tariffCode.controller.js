/**
 * Tariff (Schedule B / HS) code controller.
 *
 * Powers the autocomplete picker on the Sample submission form. The
 * collection is global reference data (US Census Schedule B) so these
 * endpoints are NOT tenant-scoped, but they still require an authenticated
 * user — the route is mounted behind `verifyToken`.
 */

import TariffCode from "../models/tariffCode.models.js";
import Sample from "../models/samples.models.js";

const MAX_LIMIT = 50;

const sanitizeQuery = (q = "") =>
  String(q)
    .trim()
    // Replace dots so that searching for "9018.90" still matches the
    // stored 10-digit code (which has no dots).
    .replace(/\./g, "");

const isCodePrefix = (q) => /^\d{2,10}$/.test(q);

/**
 * GET /api/tariff-codes/search
 *
 * Query params:
 *   q        keyword(s) or numeric code prefix
 *   chapter  optional 2-digit chapter filter ("90")
 *   limit    1..50 (default 20)
 *
 * Matching strategy:
 *   - If `q` looks like a numeric code (2–10 digits), match on a code
 *     prefix — this is what you want when the user is typing "9018"
 *     or pasting a partial code from a commercial invoice.
 *   - Otherwise, use the Mongo text index over description fields.
 */
export const searchTariffCodes = async (req, res) => {
  try {
    const q = sanitizeQuery(req.query.q || "");
    const chapter = req.query.chapter ? String(req.query.chapter).slice(0, 2) : "";
    const limit = Math.min(Number(req.query.limit) || 20, MAX_LIMIT);

    const filter = { obsolete: false };
    if (chapter) filter.chapter = chapter;

    let docs;
    if (!q) {
      // No query — return a stable alphabetical slice, useful when the
      // user wants to browse a chapter.
      docs = await TariffCode.find(filter).sort({ code: 1 }).limit(limit).lean();
    } else if (isCodePrefix(q)) {
      docs = await TariffCode.find({
        ...filter,
        code: { $regex: `^${q}` },
      })
        .sort({ code: 1 })
        .limit(limit)
        .lean();
    } else {
      docs = await TariffCode.find(
        { ...filter, $text: { $search: q } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(limit)
        .lean();
    }

    res.json({
      query: q,
      chapter,
      count: docs.length,
      results: docs.map((d) => ({
        code: d.code,
        code6: d.code6,
        chapter: d.chapter,
        heading: d.heading,
        description: d.description,
        descriptionLong: d.descriptionLong,
        quantityUnit1: d.quantityUnit1,
        year: d.year,
      })),
    });
  } catch (error) {
    console.error("searchTariffCodes failed:", error);
    res.status(500).json({ message: "Failed to search tariff codes", error: error.message });
  }
};

/**
 * GET /api/tariff-codes/:code
 *
 * Fetch a single Schedule B record. Used by the picker when re-hydrating
 * the description for a code stored on a sample, and as a sanity check
 * before sending the code to Shippo.
 */
export const getTariffCode = async (req, res) => {
  try {
    const code = String(req.params.code || "").replace(/\./g, "").trim();
    if (!code) return res.status(400).json({ message: "code is required" });

    const doc = await TariffCode.findOne({ code }).lean();
    if (!doc) return res.status(404).json({ message: `Tariff code ${code} not found` });
    res.json(doc);
  } catch (error) {
    console.error("getTariffCode failed:", error);
    res.status(500).json({ message: "Failed to fetch tariff code", error: error.message });
  }
};

/**
 * GET /api/tariff-codes/recent
 *
 * Returns the tariff codes most frequently used by samples in the
 * caller's company. Drives the "Recently used in your company" section
 * at the top of the picker so the common cases are one click away.
 */
export const getRecentTariffCodes = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ message: "Invalid tenant context" });

    const limit = Math.min(Number(req.query.limit) || 8, 20);

    const usage = await Sample.aggregate([
      { $match: { company_id: companyId, tariffCode: { $ne: null, $ne: "" } } },
      { $group: { _id: "$tariffCode", count: { $sum: 1 }, lastUsed: { $max: "$updatedAt" } } },
      { $sort: { count: -1, lastUsed: -1 } },
      { $limit: limit },
    ]);

    if (usage.length === 0) return res.json({ results: [] });

    const codes = usage.map((u) => u._id);
    const docs = await TariffCode.find({ code: { $in: codes } }).lean();
    const byCode = new Map(docs.map((d) => [d.code, d]));

    res.json({
      results: usage
        .map((u) => {
          const d = byCode.get(u._id);
          if (!d) return null;
          return {
            code: d.code,
            description: d.description,
            descriptionLong: d.descriptionLong,
            chapter: d.chapter,
            quantityUnit1: d.quantityUnit1,
            usageCount: u.count,
          };
        })
        .filter(Boolean),
    });
  } catch (error) {
    console.error("getRecentTariffCodes failed:", error);
    res.status(500).json({ message: "Failed to fetch recent codes", error: error.message });
  }
};

export default {
  searchTariffCodes,
  getTariffCode,
  getRecentTariffCodes,
};
