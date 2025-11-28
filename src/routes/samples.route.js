import express from "express";
import { getAllSamples, getSampleById, createSample, updateSample, deleteSample } from "../controllers/samples.controller.js";

const router = express.Router();

router.get("/", getAllSamples);
router.get("/:id", getSampleById);
router.post("/", createSample);
router.put("/:id", updateSample);
router.delete("/:id", deleteSample);

export default router;


