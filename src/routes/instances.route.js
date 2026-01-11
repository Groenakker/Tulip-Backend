import express from "express";
import { 
  getAllInstances, 
  getInstanceById, 
  createInstance, 
  updateInstance, 
  deleteInstance,
  getInstanceByCode,
  getInstancesBySample 
} from "../controllers/instance.controller.js";

const router = express.Router();

router.get("/", getAllInstances);

router.get("/:id", getInstanceById);

router.get("/instance-code/:instanceCode", getInstanceByCode);

router.get("/sample/:sampleId", getInstancesBySample);

router.post("/", createInstance);

router.put("/:id", updateInstance);

router.delete("/:id", deleteInstance);

export default router;
