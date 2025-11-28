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

const router = express.Router();

router.get("/", getAllReceivings);
router.get("/:id", getReceivingById);
router.post("/", createReceiving);
router.put("/:id", updateReceiving);
router.delete("/:id", deleteReceiving);

router.get("/:id/lines", getReceivingLines);
router.post("/:id/lines", addReceivingLine);
router.put("/lines/:lineId", updateReceivingLine);
router.delete("/lines/:lineId", deleteReceivingLine);

export default router;


