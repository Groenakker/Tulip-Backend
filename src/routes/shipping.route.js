import express from "express";
import {
  getAllShipping,
  getShippingById,
  createShipping,
  updateShipping,
  deleteShipping,
  getShippingLines,
  addShippingLine,
  addShippingLineInstance,
  updateShippingLine,
  deleteShippingLine,
  getShippingLineById,
} from "../controllers/shipping.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Shipping", "read"), getAllShipping);
router.get("/:id", checkPermission("Shipping", "read"), getShippingById);
router.post("/", checkPermission("Shipping", "write"), createShipping);
router.put("/:id", checkPermission("Shipping", "update"), updateShipping);
router.delete("/:id", checkPermission("Shipping", "delete"), deleteShipping);

router.get("/:id/lines", checkPermission("Shipping", "read"), getShippingLines);
router.get("/lines/:lineId", checkPermission("Shipping", "read"), getShippingLineById);
router.post("/:id/lines", checkPermission("Shipping", "update"), addShippingLine);
router.post("/lines/:lineId/instances", checkPermission("Shipping", "update"), addShippingLineInstance);
router.put("/lines/:lineId", checkPermission("Shipping", "update"), updateShippingLine);
router.delete("/lines/:lineId", checkPermission("Shipping", "update"), deleteShippingLine);

export default router;

