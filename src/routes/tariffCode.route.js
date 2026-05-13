import express from "express";
import {
  searchTariffCodes,
  getTariffCode,
  getRecentTariffCodes,
} from "../controllers/tariffCode.controller.js";
import { verifyToken } from "../lib/utils.js";

const router = express.Router();

// Reference data — any authenticated user can read it. We don't gate
// behind a specific module permission because the tariff picker shows up
// in both the Samples and Shipping flows.
router.use(verifyToken);

router.get("/recent", getRecentTariffCodes);
router.get("/search", searchTariffCodes);
router.get("/:code", getTariffCode);

export default router;
