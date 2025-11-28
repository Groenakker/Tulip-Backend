import express from "express";
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getRoleUsers,
} from "../controllers/roles.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get all roles (requires Roles module read permission)
router.get(
  "/",
  checkPermission("Roles", "read"),
  getAllRoles
);

// Get role by ID (requires Roles module read permission)
router.get(
  "/:id",
  checkPermission("Roles", "read"),
  getRoleById
);

// Get users with a specific role (requires Roles module read permission)
router.get(
  "/:id/users",
  checkPermission("Roles", "read"),
  getRoleUsers
);

// Create role (requires Roles module write permission)
router.post(
  "/",
  checkPermission("Roles", "write"),
  createRole
);

// Update role (requires Roles module update permission)
router.put(
  "/:id",
  checkPermission("Roles", "update"),
  updateRole
);

// Delete role (requires Roles module delete permission)
router.delete(
  "/:id",
  checkPermission("Roles", "delete"),
  deleteRole
);

export default router;

