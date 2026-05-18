import express from "express";
import {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  bulkDeleteDocuments,
  getDocumentVersions,
  addDocumentVersion,
  updateDocumentVersion,
  deleteDocumentVersion,
  addVersionStakeholder,
  resendStakeholderEmail,
  getDocumentReviews,
  addDocumentReview,
} from "../controllers/documents.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";
import { uploadDocumentFile, uploadSingleDocumentFile, handleMulterError } from "../middleware/upload.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", checkPermission("Documents", "read"), getAllDocuments);
router.post(
  "/",
  checkPermission("Documents", "write"),
  uploadDocumentFile,
  handleMulterError,
  createDocument
);

// Bulk delete (must be declared before any "/:id" routes).
// Skips Published / Archived documents to mirror single-delete behavior.
router.post(
  "/bulk-delete",
  checkPermission("Documents", "delete"),
  bulkDeleteDocuments
);

router.get("/:id", checkPermission("Documents", "read"), getDocumentById);
router.put("/:id", checkPermission("Documents", "update"), updateDocument);
router.delete("/:id", checkPermission("Documents", "delete"), deleteDocument);

router.get(
  "/:id/versions",
  checkPermission("Documents", "read"),
  getDocumentVersions
);
router.post(
  "/:id/versions",
  checkPermission("Documents", "update"),
  uploadSingleDocumentFile,
  handleMulterError,
  addDocumentVersion
);
router.put(
  "/:id/versions/:versionId",
  checkPermission("Documents", "update"),
  updateDocumentVersion
);
router.delete(
  "/:id/versions/:versionId",
  checkPermission("Documents", "update"),
  deleteDocumentVersion
);

router.post(
  "/:id/versions/:versionId/stakeholders",
  checkPermission("Documents", "update"),
  addVersionStakeholder
);
router.post(
  "/:id/versions/:versionId/stakeholders/:stakeholderId/send-email",
  checkPermission("Documents", "update"),
  resendStakeholderEmail
);

router.get(
  "/:id/reviews",
  checkPermission("Documents", "read"),
  getDocumentReviews
);
router.post(
  "/:id/reviews",
  checkPermission("Documents", "update"),
  addDocumentReview
);

export default router;
