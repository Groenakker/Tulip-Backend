import express from "express";
import {
  listAuditLogs,
  getAuditLogFacets,
  getAuditLogById,
} from "../controllers/auditLog.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// Audit logs are sensitive — require authentication and a permission. We
// piggyback on the "Settings" module so the same roles that can manage
// org-level config can also view the activity log. Admins with system
// roles pass automatically via checkPermission.
router.use(verifyToken);

router.get("/", checkPermission("Settings", "read"), listAuditLogs);
router.get("/facets", checkPermission("Settings", "read"), getAuditLogFacets);
router.get("/:id", checkPermission("Settings", "read"), getAuditLogById);

export default router;
