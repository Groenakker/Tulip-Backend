import express from "express";
import {
  getShippoConfig,
  listCarriers,
  validateAddress,
  createShipmentForShipping,
  refreshRates,
  buyLabel,
  getLabel,
  trackLabel,
  refundShippingLabel,
} from "../controllers/shippo.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// Every Shippo endpoint requires an authenticated user. We also piggyback
// on the existing "Shipping" permission so roles that can manage shipping
// can also use Shippo features.
router.use(verifyToken);

// Global Shippo utilities
router.get("/config", checkPermission("Shipping", "read"), getShippoConfig);
router.get("/carriers", checkPermission("Shipping", "read"), listCarriers);
router.post("/validate-address", checkPermission("Shipping", "read"), validateAddress);

// Per-shipping Shippo actions
router.post("/shipping/:id/shipment", checkPermission("Shipping", "update"), createShipmentForShipping);
router.get("/shipping/:id/rates", checkPermission("Shipping", "read"), refreshRates);
router.post("/shipping/:id/label", checkPermission("Shipping", "update"), buyLabel);
router.get("/shipping/:id/label", checkPermission("Shipping", "read"), getLabel);
router.get("/shipping/:id/track", checkPermission("Shipping", "read"), trackLabel);
router.post("/shipping/:id/refund", checkPermission("Shipping", "update"), refundShippingLabel);

export default router;
