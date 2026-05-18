import express from "express";
import {
  getAllReceivings,
  getReceivingById,
  createReceiving,
  updateReceiving,
  deleteReceiving,
  bulkDeleteReceivings,
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

router.get("/", checkPermission("Receiving", "read"), getAllReceivings);
router.post("/", checkPermission("Receiving", "write"), createReceiving);
// Bulk delete (must be declared before any "/:id" routes).
router.post("/bulk-delete", checkPermission("Receiving", "delete"), bulkDeleteReceivings);
router.get("/:id", checkPermission("Receiving", "read"), getReceivingById);
router.put("/:id", checkPermission("Receiving", "update"), updateReceiving);
router.delete("/:id", checkPermission("Receiving", "delete"), deleteReceiving);

router.get("/:id/lines", checkPermission("Receiving", "read"), getReceivingLines);
router.post("/:id/lines", checkPermission("Receiving", "update"), addReceivingLine);
router.put("/lines/:lineId", checkPermission("Receiving", "update"), updateReceivingLine);
router.delete("/lines/:lineId", checkPermission("Receiving", "update"), deleteReceivingLine);

export default router;


