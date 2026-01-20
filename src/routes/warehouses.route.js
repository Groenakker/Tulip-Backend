import express from "express";
import {
  getAllWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse
} from "../controllers/warehouse.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Warehouse", "read"), getAllWarehouses);

router.get("/:id", checkPermission("Warehouse", "read"), getWarehouseById);

router.post("/", checkPermission("Warehouse", "write"), createWarehouse);

router.put("/:id", checkPermission("Warehouse", "update"), updateWarehouse);

router.delete("/:id", checkPermission("Warehouse", "delete"), deleteWarehouse);

export default router;

