import express from "express";
import { getAllProjects, getProjectById, createProject, updateProject, deleteProject, bulkDeleteProjects } from "../controllers/project.controller.js";
import { importProjects } from "../controllers/import.controller.js";
import {
  addProjectMember,
  updateProjectMember,
  removeProjectMember,
  setProjectTags,
  getTeamSummary,
  getProjectInsights,
} from "../controllers/task.controller.js";
import { uploadProjectImage, uploadImportFile, handleMulterError } from "../middleware/upload.middleware.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Projects", "read"), getAllProjects);

router.post(
  "/import",
  checkPermission("Projects", "write"),
  uploadImportFile,
  handleMulterError,
  importProjects
);

router.get("/:id", checkPermission("Projects", "read"), getProjectById);

router.post("/", checkPermission("Projects", "write"), createProject);

// Bulk delete (declared before "/:id" to avoid being captured as an id param).
router.post("/bulk-delete", checkPermission("Projects", "delete"), bulkDeleteProjects);

router.put(
  "/:id",
  checkPermission("Projects", "update"),
  uploadProjectImage, // Handle multipart/form-data file uploads (optional)
  handleMulterError, // Handle multer errors
  updateProject
);

router.delete("/:id", checkPermission("Projects", "delete"), deleteProject);

// ---------- Project Management extensions ----------
// Team members on the project (separate from tenant-wide roles).
router.get("/:id/team-summary", checkPermission("Projects", "read"), getTeamSummary);
router.post("/:id/members", checkPermission("Projects", "update"), addProjectMember);
router.put("/:id/members/:memberId", checkPermission("Projects", "update"), updateProjectMember);
router.delete("/:id/members/:memberId", checkPermission("Projects", "update"), removeProjectMember);

// Tag palette for tasks on this project.
router.put("/:id/tags", checkPermission("Projects", "update"), setProjectTags);

// Aggregated insights for the Insights tab.
router.get("/:id/insights", checkPermission("Projects", "read"), getProjectInsights);

export default router;
