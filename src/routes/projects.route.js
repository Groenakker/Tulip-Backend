import express from "express";
import { getAllProjects, getProjectById, createProject, updateProject, deleteProject } from "../controllers/project.controller.js";
import { uploadProjectImage, handleMulterError } from "../middleware/upload.middleware.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Projects", "read"), getAllProjects);

router.get("/:id", checkPermission("Projects", "read"), getProjectById);

router.post("/", checkPermission("Projects", "write"), createProject);

router.put(
  "/:id",
  checkPermission("Projects", "update"),
  uploadProjectImage, // Handle multipart/form-data file uploads (optional)
  handleMulterError, // Handle multer errors
  updateProject
);

router.delete("/:id", checkPermission("Projects", "delete"), deleteProject);

export default router;
