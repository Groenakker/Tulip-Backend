import AuditLog from "../models/auditLog.models.js";

/**
 * GET /api/audit-logs
 *
 * Query params (all optional):
 *   - page           : page number (default 1)
 *   - limit          : page size (default 25, max 200)
 *   - user_id        : filter by user id
 *   - module         : filter by module (e.g. "Shipping")
 *   - entity_type    : filter by entity type
 *   - entity_id      : filter by entity id (exact match)
 *   - action         : filter by action (create|update|delete|...)
 *   - from           : ISO date string — include logs >= this timestamp
 *   - to             : ISO date string — include logs <= this timestamp
 *   - q              : case-insensitive substring search over
 *                      entity_label, user_name, user_email, description
 *
 * Tenant-scoped: a user can only see their own company's logs.
 */
export const listAuditLogs = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const {
      page = 1,
      limit = 25,
      user_id,
      module,
      entity_type,
      entity_id,
      action,
      from,
      to,
      q,
    } = req.query;

    const query = { company_id: companyId };
    if (user_id) query.user_id = user_id;
    if (module) query.module = module;
    if (entity_type) query.entity_type = entity_type;
    if (entity_id) query.entity_id = entity_id;
    if (action) query.action = action;

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    if (q) {
      const needle = String(q).trim();
      if (needle) {
        const safe = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = new RegExp(safe, "i");
        query.$or = [
          { entity_label: rx },
          { user_name: rx },
          { user_email: rx },
          { description: rx },
          { module: rx },
          { entity_type: rx },
        ];
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * pageSize;

    const [items, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      items,
      total,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch audit logs", error: error.message });
  }
};

/**
 * GET /api/audit-logs/facets
 *
 * Returns distinct modules, entity types, actions, and the list of users
 * that appear in the current tenant's logs. Powers the filter dropdowns.
 */
export const getAuditLogFacets = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }

    const match = { company_id: companyId };
    const [modules, entityTypes, actions, users] = await Promise.all([
      AuditLog.distinct("module", match),
      AuditLog.distinct("entity_type", match),
      AuditLog.distinct("action", match),
      AuditLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$user_id",
            user_name: { $last: "$user_name" },
            user_email: { $last: "$user_email" },
            count: { $sum: 1 },
          },
        },
        { $sort: { user_name: 1 } },
      ]),
    ]);

    res.json({
      modules: modules.filter(Boolean).sort(),
      entityTypes: entityTypes.filter(Boolean).sort(),
      actions: actions.filter(Boolean).sort(),
      users: users
        .filter((u) => u._id)
        .map((u) => ({
          user_id: u._id,
          user_name: u.user_name || "Unknown",
          user_email: u.user_email || "",
          count: u.count,
        })),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch audit log facets", error: error.message });
  }
};

/**
 * GET /api/audit-logs/:id
 * Return a single entry with full before/after/changes payload.
 */
export const getAuditLogById = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(403).json({ message: "Invalid tenant context" });
    }
    const entry = await AuditLog.findOne({
      _id: req.params.id,
      company_id: companyId,
    }).lean();
    if (!entry) return res.status(404).json({ message: "Audit log not found" });
    res.json(entry);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch audit log", error: error.message });
  }
};

export default {
  listAuditLogs,
  getAuditLogFacets,
  getAuditLogById,
};
