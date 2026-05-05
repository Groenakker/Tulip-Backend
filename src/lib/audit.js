/**
 * Audit log helper + automatic middleware.
 *
 * Two ways to log a change:
 *
 *  1. Call `logAudit({ req, action, module, entityType, entityId,
 *       entityLabel, before, after, description })` explicitly from a
 *       controller when you want a clean, hand-curated record.
 *
 *  2. Register `auditMutations` globally and every successful mutation on
 *       a known REST endpoint (POST/PUT/PATCH/DELETE /api/:module/...)
 *       will be logged automatically, including a real before/after diff
 *       when the model is registered in MODEL_REGISTRY below.
 */

import AuditLog from "../models/auditLog.models.js";

// Models used by the automatic middleware to pre-fetch the "before"
// snapshot on update/delete requests. Keeping this registry in one file
// (rather than importing Mongoose models dynamically) keeps startup fast
// and the bundling story simple.
import Shipping from "../models/shipping.models.js";
import Bpartner from "../models/bPartners.models.js";
import Project from "../models/projects.models.js";
import TestCode from "../models/testCodes.models.js";
import Receiving from "../models/receivings.models.js";
import Sample from "../models/samples.models.js";
import Instance from "../models/instances.models.js";
import InstanceMovement from "../models/instanceMovements.models.js";
import Warehouse from "../models/warehouses.models.js";
import User from "../models/user.models.js";
import Role from "../models/roles.models.js";
import Company from "../models/company.models.js";
import Document from "../models/documents.models.js";

/**
 * URL prefix => { model, module, entityType, labelFields[] }
 *
 * The first matching prefix wins. `labelFields` is the list of fields we
 * try (in order) to produce a human-friendly label for the entity.
 */
const MODEL_REGISTRY = [
  { prefix: "/api/shipping", model: Shipping, module: "Shipping", entityType: "shipping", labelFields: ["shippingCode", "shipmentDestination"] },
  { prefix: "/api/shippo/shipping", model: Shipping, module: "Shipping", entityType: "shipping", labelFields: ["shippingCode"] },
  { prefix: "/api/bpartners", model: Bpartner, module: "Business Partners", entityType: "bPartner", labelFields: ["name", "email"] },
  { prefix: "/api/projects", model: Project, module: "Projects", entityType: "project", labelFields: ["projectID", "description", "name"] },
  { prefix: "/api/testcodes", model: TestCode, module: "Test Codes", entityType: "testCode", labelFields: ["code", "name"] },
  { prefix: "/api/receivings", model: Receiving, module: "Receiving", entityType: "receiving", labelFields: ["receivingCode"] },
  { prefix: "/api/samples", model: Sample, module: "Sample Submission", entityType: "sample", labelFields: ["sampleCode", "name"] },
  { prefix: "/api/instance-movements", model: InstanceMovement, module: "Instances", entityType: "instanceMovement", labelFields: ["_id"] },
  { prefix: "/api/instances", model: Instance, module: "Instances", entityType: "instance", labelFields: ["instanceCode", "name"] },
  { prefix: "/api/warehouses", model: Warehouse, module: "Warehouse", entityType: "warehouse", labelFields: ["name", "code"] },
  { prefix: "/api/users", model: User, module: "Users", entityType: "user", labelFields: ["name", "email"] },
  { prefix: "/api/roles", model: Role, module: "Roles", entityType: "role", labelFields: ["name"] },
  { prefix: "/api/companies", model: Company, module: "Companies", entityType: "company", labelFields: ["name"] },
  { prefix: "/api/documents", model: Document, module: "Document Management", entityType: "document", labelFields: ["name", "fileName"] },
];

const findRegistryEntry = (path) => {
  if (!path) return null;
  return MODEL_REGISTRY.find((entry) => path.startsWith(entry.prefix)) || null;
};

const ACTION_BY_METHOD = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

// Fields we never want stored in an audit log (security + noise).
const REDACT_FIELDS = new Set([
  "password",
  "passwordHash",
  "token",
  "refreshToken",
  "api_key",
  "apiKey",
  "secret",
]);

const redact = (value) => {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (REDACT_FIELDS.has(k)) {
      out[k] = "***";
    } else {
      out[k] = redact(v);
    }
  }
  return out;
};

// Convert Mongoose docs to plain objects. Safe on plain objects too.
const toPlain = (doc) => {
  if (!doc) return null;
  if (typeof doc.toObject === "function") {
    return redact(doc.toObject({ depopulate: true, getters: false, virtuals: false }));
  }
  return redact(JSON.parse(JSON.stringify(doc)));
};

// Shallow, value-level equality good enough for diffing stored documents.
const isEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
};

// Fields that change on every save and make diffs noisy.
const IGNORE_FIELDS = new Set([
  "_id",
  "__v",
  "updatedAt",
  "createdAt",
  "company_id",
]);

export const diffObjects = (before, after) => {
  const changes = [];
  const a = before && typeof before === "object" ? before : {};
  const b = after && typeof after === "object" ? after : {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (IGNORE_FIELDS.has(key)) continue;
    if (!isEqual(a[key], b[key])) {
      changes.push({ field: key, before: a[key] ?? null, after: b[key] ?? null });
    }
  }
  return changes;
};

const pickLabel = (doc, labelFields = []) => {
  if (!doc) return "";
  for (const f of labelFields) {
    const v = doc[f];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
};

/**
 * Persist an audit log entry. Never throws — audit failures must not
 * block the user's action.
 */
export const logAudit = async ({
  req,
  action,
  module,
  entityType,
  entityId,
  entityLabel,
  description,
  before = null,
  after = null,
  changes,
  statusCode,
}) => {
  try {
    const user = req?.user || null;
    const companyId = user?.company_id || req?.user?.company_id;
    if (!companyId) return; // no tenant context, skip silently

    const beforePlain = toPlain(before);
    const afterPlain = toPlain(after);

    const computedChanges = Array.isArray(changes)
      ? changes
      : diffObjects(beforePlain, afterPlain);

    // If nothing actually changed on an update, skip the log entry.
    if (action === "update" && computedChanges.length === 0) return;

    const entry = new AuditLog({
      user_id: user?._id || req?.userId || undefined,
      user_email: user?.email || "",
      user_name: user?.name || "",
      company_id: companyId,
      action: action || "other",
      module: module || "",
      entity_type: entityType || "",
      entity_id: entityId ? String(entityId) : "",
      entity_label: entityLabel || "",
      description: description || "",
      before: beforePlain,
      after: afterPlain,
      changes: computedChanges,
      method: req?.method,
      path: req?.originalUrl || req?.url,
      status_code: statusCode,
      ip:
        req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req?.ip ||
        req?.connection?.remoteAddress,
      user_agent: req?.headers?.["user-agent"] || "",
    });

    await entry.save();
  } catch (err) {
    console.error("[audit] Failed to persist log:", err.message);
  }
};

/**
 * Express middleware: automatically audit every successful mutation on
 * known REST endpoints.
 *
 * Behavior:
 *   - Only runs on POST / PUT / PATCH / DELETE where the URL matches one
 *     of the MODEL_REGISTRY prefixes.
 *   - For PUT/PATCH/DELETE with an `:id` path param, pre-fetches the
 *     current document so we have an accurate "before" snapshot.
 *   - After the controller responds with 2xx, saves an AuditLog entry
 *     with the diff.
 *   - Controllers can opt out of auto-logging by setting
 *     `req._skipAudit = true` (useful if a controller already calls
 *     `logAudit` explicitly with richer data).
 */
export const auditMutations = async (req, res, next) => {
  const method = req.method?.toUpperCase();
  const action = ACTION_BY_METHOD[method];
  if (!action) return next();

  const entry = findRegistryEntry(req.originalUrl || req.url);
  if (!entry) return next();

  // Try to resolve the record id from the path. We look for the first
  // segment AFTER the prefix that looks like a Mongo id (24 hex chars)
  // or a plain string id.
  const afterPrefix = (req.originalUrl || req.url)
    .replace(entry.prefix, "")
    .split("?")[0]
    .split("/")
    .filter(Boolean);
  const possibleId = afterPrefix.find((s) => /^[a-f0-9]{24}$/i.test(s)) || afterPrefix[0];

  // Pre-fetch "before" snapshot for update/delete where we have an id.
  if ((action === "update" || action === "delete") && possibleId && entry.model) {
    try {
      const doc = await entry.model.findById(possibleId);
      if (doc) req._auditBefore = doc;
    } catch {
      // Ignore — best-effort only.
    }
  }

  // Stash registry entry for use after the response is sent.
  req._auditEntry = entry;
  req._auditAction = action;
  req._auditEntityId = possibleId || "";

  // Hook res.json so we can capture the response body (our "after" state).
  const origJson = res.json.bind(res);
  res.json = (body) => {
    // Fire-and-forget after the response leaves.
    queueMicrotask(() => finalizeAudit(req, res, body).catch(() => {}));
    return origJson(body);
  };

  next();
};

const finalizeAudit = async (req, res, body) => {
  if (req._skipAudit) return;
  const entry = req._auditEntry;
  const action = req._auditAction;
  if (!entry || !action) return;
  if (res.statusCode >= 400) return; // only log successes

  // "after" snapshot priority: explicit controller response, then registry
  // refetch (for the current state after the mutation).
  let after = body;
  if (action === "delete") after = null;

  // The response body might be wrapped (e.g. { shipping, transaction }).
  // Heuristic: if body contains the entity type as a key, use that slice.
  if (after && typeof after === "object" && after[entry.entityType]) {
    after = after[entry.entityType];
  }

  const before = req._auditBefore || null;
  const entityId =
    (after && after._id) ||
    (before && before._id) ||
    req._auditEntityId;

  const entityLabel =
    pickLabel(after, entry.labelFields) || pickLabel(before, entry.labelFields);

  await logAudit({
    req,
    action,
    module: entry.module,
    entityType: entry.entityType,
    entityId,
    entityLabel,
    before,
    after,
    statusCode: res.statusCode,
  });
};

export default {
  logAudit,
  diffObjects,
  auditMutations,
};
