import mongoose from "mongoose";

/**
 * Build a reusable Express controller that performs a bulk delete on a
 * Mongoose model, scoped to the caller's company (tenant isolation).
 *
 * Usage:
 *   import { createBulkDelete } from "../lib/bulkDelete.js";
 *   import Project from "../models/projects.models.js";
 *   export const bulkDeleteProjects = createBulkDelete(Project, { entityName: "project" });
 *
 *   // routes
 *   router.post(
 *     "/bulk-delete",
 *     checkPermission("Projects", "delete"),
 *     bulkDeleteProjects,
 *   );
 *
 * Request body: { ids: [<ObjectId>, ...] }
 * Response:     { message, requested, deleted, notFound, invalidIds }
 *
 * Guarantees:
 *   • Requires req.user.company_id (set by the auth middleware). 403 if missing.
 *   • Caps batches at MAX_BULK_DELETE to limit accidental destruction.
 *   • Splits valid vs invalid ObjectIds so the caller gets actionable errors.
 *   • Filters by company_id so a tenant can never touch another tenant's data.
 *   • Returns counts the UI needs to render an accurate toast.
 *
 * Options:
 *   entityName   — singular noun used in response messages ("project")
 *   maxPerCall   — override the default cap (500)
 *   preDelete    — optional async hook(validIds, { companyId, req }) → either
 *                  returns nothing (continue), an array of "allowedIds" to
 *                  actually delete, or throws to abort. Useful when an entity
 *                  needs extra checks (e.g. documents must check ownership).
 *   afterDelete  — optional async hook(deletedIds, { companyId, req }) for
 *                  cascading cleanup (delete related records, etc.).
 */
export const DEFAULT_MAX_BULK_DELETE = 500;

export const createBulkDelete = (Model, options = {}) => {
  const {
    entityName = "record",
    maxPerCall = DEFAULT_MAX_BULK_DELETE,
    preDelete,
    afterDelete,
  } = options;

  return async (req, res) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(403).json({ message: "Invalid tenant context" });
      }

      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : null;
      if (!rawIds || rawIds.length === 0) {
        return res.status(400).json({
          message: `Provide a non-empty 'ids' array of ${entityName} IDs to delete.`,
        });
      }

      if (rawIds.length > maxPerCall) {
        return res.status(400).json({
          message: `You can delete at most ${maxPerCall} ${entityName}s at a time.`,
        });
      }

      // De-duplicate, separate valid vs invalid ObjectIds.
      const uniqueIds = [...new Set(rawIds.map((id) => String(id).trim()).filter(Boolean))];
      const validIds = [];
      const invalidIds = [];
      for (const id of uniqueIds) {
        if (mongoose.Types.ObjectId.isValid(id)) {
          validIds.push(id);
        } else {
          invalidIds.push(id);
        }
      }

      if (validIds.length === 0) {
        return res.status(400).json({
          message: `No valid ${entityName} IDs were supplied.`,
          invalidIds,
        });
      }

      // Optional caller-supplied gating (e.g. "only let owners delete X").
      let idsToDelete = validIds;
      if (typeof preDelete === "function") {
        const hookResult = await preDelete(validIds, { companyId, req });
        if (Array.isArray(hookResult)) {
          idsToDelete = hookResult;
        }
      }

      if (idsToDelete.length === 0) {
        return res.status(403).json({
          message: `You are not allowed to delete any of the supplied ${entityName}s.`,
          invalidIds,
        });
      }

      const { deletedCount } = await Model.deleteMany({
        _id: { $in: idsToDelete },
        company_id: companyId,
      });

      const notFound = idsToDelete.length - deletedCount;

      if (typeof afterDelete === "function" && deletedCount > 0) {
        try {
          await afterDelete(idsToDelete, { companyId, req });
        } catch (cleanupErr) {
          // Don't fail the whole request just because cascade cleanup hit a
          // hiccup — log and let the client know the main delete succeeded.
          console.error(`afterDelete hook failed for ${entityName}s:`, cleanupErr);
        }
      }

      return res.json({
        message:
          deletedCount === 0
            ? `No matching ${entityName}s were deleted.`
            : `${deletedCount} ${entityName}${deletedCount === 1 ? "" : "s"} deleted successfully.`,
        requested: rawIds.length,
        deleted: deletedCount,
        notFound,
        invalidIds,
      });
    } catch (error) {
      return res.status(500).json({
        message: `Failed to delete ${entityName}s`,
        error: error.message,
      });
    }
  };
};

export default createBulkDelete;
