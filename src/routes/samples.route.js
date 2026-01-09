import express from "express";
import { getAllSamples, getSampleById, createSample, updateSample, deleteSample } from "../controllers/samples.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Samples", "read"), getAllSamples);
router.get("/:id", checkPermission("Samples", "read"), getSampleById);
router.post("/", checkPermission("Samples", "write"), createSample);
router.put("/:id", checkPermission("Samples", "update"), updateSample);
router.delete("/:id", checkPermission("Samples", "delete"), deleteSample);

export default router;


