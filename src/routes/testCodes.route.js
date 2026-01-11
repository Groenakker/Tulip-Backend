import express from "express";
import { getAllTestCodes, getTestCodeById, createTestCode, updateTestCode, deleteTestCode } from "../controllers/testCode.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Test Codes", "read"), getAllTestCodes);

router.get("/:id", checkPermission("Test Codes", "read"), getTestCodeById);

router.post("/", checkPermission("Test Codes", "write"), createTestCode);

router.put("/:id", checkPermission("Test Codes", "update"), updateTestCode);

router.delete("/:id", checkPermission("Test Codes", "delete"), deleteTestCode);

export default router;
