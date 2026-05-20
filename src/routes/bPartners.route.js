import express from "express";
import { getAllPartners, getPartnerById, createPartner, updatePartner, deletePartner, bulkDeletePartners, getRelatedDataForPartner, getPartnerSummary, addPartnerContact, updatePartnerContact, deletePartnerContact, addPartnerTestCode, removePartnerTestCode } from "../controllers/bPartner.controller.js";
import { importBusinessPartners } from "../controllers/import.controller.js";
import { uploadImportFile, handleMulterError } from "../middleware/upload.middleware.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Business Partners", "read"), getAllPartners);

router.post(
  "/import",
  checkPermission("Business Partners", "write"),
  uploadImportFile,
  handleMulterError,
  importBusinessPartners
);

router.get("/:id", checkPermission("Business Partners", "read"), getPartnerById);

router.post("/", checkPermission("Business Partners", "write"), createPartner);

// Bulk delete must be declared before the "/:id" routes so Express doesn't
// treat the literal segment "bulk-delete" as an :id param. Same delete
// permission as the single-record delete so it stays consistent with RBAC.
router.post("/bulk-delete", checkPermission("Business Partners", "delete"), bulkDeletePartners);

router.post("/:id/contacts", checkPermission("Business Partners", "update"), addPartnerContact);

router.put("/:id", checkPermission("Business Partners", "update"), updatePartner);

router.delete("/:id", checkPermission("Business Partners", "delete"), deletePartner);

router.put("/:id/contacts/:contactId", checkPermission("Business Partners", "update"), updatePartnerContact);

router.delete("/:id/contacts/:contactId", checkPermission("Business Partners", "update"), deletePartnerContact);

router.post("/:id/testCodes", checkPermission("Business Partners", "update"), addPartnerTestCode);

router.delete("/:id/testCodes/:testCodeId", checkPermission("Business Partners", "update"), removePartnerTestCode);

router.get("/:id/related", checkPermission("Business Partners", "read"), getRelatedDataForPartner);

router.get("/:id/summary", checkPermission("Business Partners", "read"), getPartnerSummary);

export default router;
