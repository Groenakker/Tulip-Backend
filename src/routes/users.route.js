import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUserRoles,
  addRoleToUser,
  removeRoleFromUser,
  getUserPermissions,
} from "../controllers/users.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get all users (requires Users module read permission)
router.get(
  "/",
  checkPermission("Users", "read"),
  getAllUsers
);

// Get user by ID (requires Users module read permission)
router.get(
  "/:id",
  checkPermission("Users", "read"),
  getUserById
);

// Get user permissions (requires Users module read permission)
router.get(
  "/:id/permissions",
  checkPermission("Users", "read"),
  getUserPermissions
);

// Update user roles (replace all roles) (requires Users module update permission)
router.put(
  "/:id/roles",
  checkPermission("Users", "update"),
  updateUserRoles
);

// Add role to user (requires Users module update permission)
router.post(
  "/:id/roles",
  checkPermission("Users", "update"),
  addRoleToUser
);

// Remove role from user (requires Users module update permission)
router.delete(
  "/:id/roles",
  checkPermission("Users", "update"),
  removeRoleFromUser
);

export default router;

