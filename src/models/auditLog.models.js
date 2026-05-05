import mongoose from "mongoose";

/**
 * AuditLog
 *
 * Tracks every meaningful change that happens in the app. The record is
 * deliberately self-contained — it stores the user's display info, the
 * entity label, and the "before" / "after" snapshots so the UI can render
 * a full history even if the underlying user or entity is later deleted.
 *
 * Fields:
 *   - user_id / user_email / user_name  — who made the change
 *   - company_id                        — tenant scope
 *   - action                            — create | update | delete | other
 *   - module                            — high-level UI module (e.g. "Shipping")
 *   - entity_type                       — DB collection / resource (e.g. "shipping")
 *   - entity_id                         — the record's id
 *   - entity_label                      — human-friendly name/code
 *   - description                       — optional free-form summary
 *   - before / after                    — document snapshots (plain objects)
 *   - changes                           — array of {field, before, after}
 *   - method / path / ip / user_agent   — request metadata
 *
 * Notes:
 *   - `before` / `after` are stored as Mixed so we can accept any shape.
 *   - `changes` is the diff between before and after (top-level fields only
 *     for brevity; arrays/objects are shown as JSON strings by the UI).
 */
const auditLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    user_email: { type: String, trim: true },
    user_name: { type: String, trim: true },

    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: ["create", "update", "delete", "login", "logout", "other"],
      required: true,
      index: true,
    },
    module: { type: String, trim: true, index: true },
    entity_type: { type: String, trim: true, index: true },
    entity_id: { type: String, trim: true, index: true },
    entity_label: { type: String, trim: true },

    description: { type: String, trim: true },

    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    changes: [
      {
        _id: false,
        field: String,
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed,
      },
    ],

    method: String,
    path: String,
    status_code: Number,
    ip: String,
    user_agent: String,
  },
  { timestamps: true }
);

// Newest-first index for fast listing by tenant.
auditLogSchema.index({ company_id: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
