import express from "express";
import {
  getAllReceivings,
  getReceivingById,
  createReceiving,
  updateReceiving,
  deleteReceiving,
  getReceivingLines,
  addReceivingLine,
  updateReceivingLine,
  deleteReceivingLine,
} from "../controllers/receiving.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Receivings", "read"), getAllReceivings);
router.get("/:id", checkPermission("Receivings", "read"), getReceivingById);
router.post("/", checkPermission("Receivings", "write"), createReceiving);
router.put("/:id", checkPermission("Receivings", "update"), updateReceiving);
router.delete("/:id", checkPermission("Receivings", "delete"), deleteReceiving);

router.get("/:id/lines", checkPermission("Receivings", "read"), getReceivingLines);
router.post("/:id/lines", checkPermission("Receivings", "update"), addReceivingLine);
router.put("/lines/:lineId", checkPermission("Receivings", "update"), updateReceivingLine);
router.delete("/lines/:lineId", checkPermission("Receivings", "update"), deleteReceivingLine);

export default router;


