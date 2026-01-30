import express from "express";
import {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  getDocumentVersions,
  addDocumentVersion,
  updateDocumentVersion,
  deleteDocumentVersion,
  getDocumentReviews,
  addDocumentReview,
} from "../controllers/documents.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";
import { uploadDocumentFile, handleMulterError } from "../middleware/upload.middleware.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", checkPermission("Documents", "read"), getAllDocuments);
router.get("/:id", checkPermission("Documents", "read"), getDocumentById);
router.post(
  "/",
  checkPermission("Documents", "write"),
  uploadDocumentFile,
  handleMulterError,
  createDocument
);
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
