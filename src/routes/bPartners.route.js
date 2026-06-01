import express from "express";
import { getAllPartners, getPartnerById, createPartner, updatePartner, deletePartner, bulkDeletePartners, getRelatedDataForPartner, getPartnerSummary, addPartnerContact, updatePartnerContact, deletePartnerContact, addPartnerTestCode, removePartnerTestCode, uploadPartnerDocument, listPartnerDocuments, getPartnerDocument, deletePartnerDocument, rescanPartnerDocument, setCurrentPartnerDocument } from "../controllers/bPartner.controller.js";
import { importBusinessPartners } from "../controllers/import.controller.js";
import { uploadImportFile, uploadBpSampleDocument, handleMulterError } from "../middleware/upload.middleware.js";
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

// Sample documents (TRF / TIDS / PCF templates) attached to a BP.
// Same permission as updating the partner itself: uploading a
// document mutates the partner record.
router.get("/:id/documents", checkPermission("Business Partners", "read"), listPartnerDocuments);
router.post(
  "/:id/documents",
  checkPermission("Business Partners", "update"),
  uploadBpSampleDocument,
  handleMulterError,
  uploadPartnerDocument
);
router.get("/:id/documents/:docId", checkPermission("Business Partners", "read"), getPartnerDocument);
router.delete("/:id/documents/:docId", checkPermission("Business Partners", "update"), deletePartnerDocument);
router.post("/:id/documents/:docId/rescan", checkPermission("Business Partners", "update"), rescanPartnerDocument);
// Promote a specific uploaded doc to the "current working version".
// All other docs on the partner are demoted in the same save so the
// invariant "exactly one current per BP" is preserved atomically.
router.put("/:id/documents/:docId/current", checkPermission("Business Partners", "update"), setCurrentPartnerDocument);

export default router;
