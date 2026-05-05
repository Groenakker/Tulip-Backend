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
} from "../controllers/company.controller.js";

const router = express.Router();

router.get("/", getCompanies);
router.get("/:id/users", getCompanyUsers);

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
