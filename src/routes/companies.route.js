import express from "express";
import {
  getCompanies,
  getCompanyById,
  getCompanyUsers,
  createCompany,
  updateCompany,
  deleteCompany,
  listShippingAddresses,
  addShippingAddress,
  updateShippingAddress,
  deleteShippingAddress,
  getCompanyShippoConfig,
  updateCompanyShippoConfig,
} from "../controllers/company.controller.js";
import { verifyToken } from "../lib/utils.js";

const router = express.Router();

router.get("/", getCompanies);
router.get("/:id/users", getCompanyUsers);

// Per-company Shippo credentials (Settings > System Configuration)
router.get("/:id/shippo-config", verifyToken, getCompanyShippoConfig);
router.put("/:id/shippo-config", verifyToken, updateCompanyShippoConfig);

// Shipping addresses (multi) — used by Settings > Company and picked up
// by the Shippo Ship-From dropdown on Shipping Details.
router.get("/:id/shipping-addresses", listShippingAddresses);
router.post("/:id/shipping-addresses", addShippingAddress);
router.put("/:id/shipping-addresses/:addressId", updateShippingAddress);
router.delete("/:id/shipping-addresses/:addressId", deleteShippingAddress);

router.get("/:id", getCompanyById);
router.post("/", createCompany);
router.put("/:id", updateCompany);
router.delete("/:id", deleteCompany);

export default router;
