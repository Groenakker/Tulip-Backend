import express from "express";
import {
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,
} from "../controllers/permissions.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get all permissions (requires Permissions module read permission)
router.get(
  "/",
  checkPermission("Permissions", "read"),
  getAllPermissions
);

// Get permission by ID (requires Permissions module read permission)
router.get(
  "/:id",
  checkPermission("Permissions", "read"),
  getPermissionById
);

// Create permission (requires Permissions module write permission)
router.post(
  "/",
  checkPermission("Permissions", "write"),
  createPermission
);

// Update permission (requires Permissions module update permission)
router.put(
  "/:id",
  checkPermission("Permissions", "update"),
  updatePermission
);

// Delete permission (requires Permissions module delete permission)
router.delete(
  "/:id",
  checkPermission("Permissions", "delete"),
  deletePermission
);

export default router;

