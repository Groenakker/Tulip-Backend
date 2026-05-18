import express from "express";
import { getAllSamples, getSampleById, createSample, updateSample, deleteSample, bulkDeleteSamples } from "../controllers/samples.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Samples", "read"), getAllSamples);
router.post("/", checkPermission("Samples", "write"), createSample);
// Bulk delete (must be declared before "/:id" routes).
router.post("/bulk-delete", checkPermission("Samples", "delete"), bulkDeleteSamples);
router.get("/:id", checkPermission("Samples", "read"), getSampleById);
router.put("/:id", checkPermission("Samples", "update"), updateSample);
router.delete("/:id", checkPermission("Samples", "delete"), deleteSample);

export default router;


