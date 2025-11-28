import express from "express";
import { 
  getAllInstances, 
  getInstanceById, 
  createInstance, 
  updateInstance, 
  deleteInstance,
  getInstancesBySample 
} from "../controllers/instance.controller.js";

const router = express.Router();

router.get("/", getAllInstances);

router.get("/:id", getInstanceById);

router.get("/sample/:sampleId", getInstancesBySample);

router.post("/", createInstance);

router.put("/:id", updateInstance);

router.delete("/:id", deleteInstance);

export default router;
