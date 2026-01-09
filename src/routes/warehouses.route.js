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

router.get("/", checkPermission("Warehouses", "read"), getAllWarehouses);

router.get("/:id", checkPermission("Warehouses", "read"), getWarehouseById);

router.post("/", checkPermission("Warehouses", "write"), createWarehouse);

router.put("/:id", checkPermission("Warehouses", "update"), updateWarehouse);

router.delete("/:id", checkPermission("Warehouses", "delete"), deleteWarehouse);

export default router;

