import express from "express";
import { getAllProjects , getProjectById , createProject , updateProject , deleteProject} from "../controllers/project.controller.js";
import { uploadProjectImage, handleMulterError } from "../middleware/upload.middleware.js";

const router = express.Router();

router.get("/", getAllProjects);

router.get("/:id", getProjectById);

router.post("/", createProject); 

router.put(
  "/:id",
  uploadProjectImage, // Handle multipart/form-data file uploads (optional)
  handleMulterError, // Handle multer errors
  updateProject
);

router.delete("/:id" , deleteProject);

export default router;
