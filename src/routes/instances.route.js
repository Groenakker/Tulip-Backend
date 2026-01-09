import express from "express";
import {
  getAllInstances,
  getInstanceById,
  createInstance,
  updateInstance,
  deleteInstance,
  getInstancesBySample
} from "../controllers/instance.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Instances", "read"), getAllInstances);

router.get("/:id", checkPermission("Instances", "read"), getInstanceById);

router.get("/sample/:sampleId", checkPermission("Instances", "read"), getInstancesBySample);

router.post("/", checkPermission("Instances", "write"), createInstance);

router.put("/:id", checkPermission("Instances", "update"), updateInstance);

router.delete("/:id", checkPermission("Instances", "delete"), deleteInstance);

export default router;
