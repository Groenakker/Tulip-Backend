import express from "express";
import {
  getAllShipping,
  getShippingById,
  createShipping,
  updateShipping,
  deleteShipping,
  getShippingLines,
  addShippingLine,
  updateShippingLine,
  deleteShippingLine,
} from "../controllers/shipping.controller.js";

const router = express.Router();

router.get("/", getAllShipping);
router.get("/:id", getShippingById);
router.post("/", createShipping);
router.put("/:id", updateShipping);
router.delete("/:id", deleteShipping);

router.get("/:id/lines", getShippingLines);
router.post("/:id/lines", addShippingLine);
router.put("/lines/:lineId", updateShippingLine);
router.delete("/lines/:lineId", deleteShippingLine);

export default router;

