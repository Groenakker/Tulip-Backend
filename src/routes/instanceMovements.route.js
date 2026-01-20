import express from "express";
import {
  getAllInstanceMovements,
  getInstanceMovementById,
  createInstanceMovement,
  updateInstanceMovement,
  deleteInstanceMovement,
  getInstanceMovementsByInstance,
  getInstanceMovementsByType,
} from "../controllers/instanceMovements.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission , checkAnyPermission} from "../middleware/permission.middleware.js";


const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("InstanceMovements", "read"), getAllInstanceMovements);

router.get("/instance/:instanceId", checkPermission("Instances", "read"), getInstanceMovementsByInstance);

router.get("/type/:movementType", checkPermission("InstanceMovements", "read"), getInstanceMovementsByType);

router.get("/:id", checkPermission("InstanceMovements", "read"), getInstanceMovementById);

router.post("/", checkAnyPermission([["Receiving", "write"], ["Shipping", "write"], ["Warehouse", "write"]]), createInstanceMovement);

router.put("/:id", checkPermission("InstanceMovements", "update"), updateInstanceMovement);

router.delete("/:id", checkPermission("InstanceMovements", "delete"), deleteInstanceMovement);

export default router;
