import express from "express";
import {
  getCompanies,
  getCompanyById,
  getCompanyUsers,
  createCompany,
  updateCompany,
  deleteCompany,
} from "../controllers/company.controller.js";

const router = express.Router();

router.get("/", getCompanies);
router.get("/:id/users", getCompanyUsers);
router.get("/:id", getCompanyById);
router.post("/", createCompany);
router.put("/:id", updateCompany);
router.delete("/:id", deleteCompany);

export default router;

