import express from "express";
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  addComment,
  deleteTask,
  bulkDeleteTasks,
  getWorkload,
  getAvailability,
} from "../controllers/task.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

router.use(verifyToken);

// "Projects" permission covers the new task surface so we don't
// need a separate permission seed for v1. A user that can read
// Projects can read tasks; write covers create/edit/delete.

router.get("/", checkPermission("Projects", "read"), listTasks);
router.post("/", checkPermission("Projects", "write"), createTask);
router.post("/bulk-delete", checkPermission("Projects", "delete"), bulkDeleteTasks);

router.get("/workload", checkPermission("Projects", "read"), getWorkload);
router.get("/availability", checkPermission("Projects", "read"), getAvailability);

router.get("/:id", checkPermission("Projects", "read"), getTask);
router.put("/:id", checkPermission("Projects", "update"), updateTask);
router.patch("/:id/status", checkPermission("Projects", "update"), updateTaskStatus);
router.post("/:id/comments", checkPermission("Projects", "update"), addComment);
router.delete("/:id", checkPermission("Projects", "delete"), deleteTask);

export default router;
