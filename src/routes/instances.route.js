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
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Instances", "read"), getAllInstances);

router.get("/instance-code/:instanceCode", checkPermission("Instances", "read"), getInstanceByCode);

router.get("/sample/:sampleId", checkPermission("Instances", "read"), getInstancesBySample);

router.get("/sample/:sampleId", checkPermission("Instances", "read"), getInstancesBySample);

router.post("/", checkPermission("Instances", "write"), createInstance);

router.put("/:id", checkPermission("Instances", "update"), updateInstance);

router.delete("/:id", checkPermission("Instances", "delete"), deleteInstance);

export default router;
