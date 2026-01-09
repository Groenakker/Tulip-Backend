import express from "express";
import { getAllPartners, getPartnerById, createPartner, updatePartner, deletePartner, getRelatedDataForPartner, getPartnerSummary, addPartnerContact, deletePartnerContact, addPartnerTestCode, removePartnerTestCode } from "../controllers/bPartner.controller.js";
import { verifyToken } from "../lib/utils.js";
import { checkPermission } from "../middleware/permission.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

router.get("/", checkPermission("Business Partners", "read"), getAllPartners);

router.get("/:id", checkPermission("Business Partners", "read"), getPartnerById);

router.post("/", checkPermission("Business Partners", "write"), createPartner);

router.post("/:id/contacts", checkPermission("Business Partners", "update"), addPartnerContact);

router.put("/:id", checkPermission("Business Partners", "update"), updatePartner);

router.delete("/:id", checkPermission("Business Partners", "delete"), deletePartner);

router.delete("/:id/contacts/:contactId", checkPermission("Business Partners", "update"), deletePartnerContact);

router.post("/:id/testCodes", checkPermission("Business Partners", "update"), addPartnerTestCode);

router.delete("/:id/testCodes/:testCodeId", checkPermission("Business Partners", "update"), removePartnerTestCode);

router.get("/:id/related", checkPermission("Business Partners", "read"), getRelatedDataForPartner);

router.get("/:id/summary", checkPermission("Business Partners", "read"), getPartnerSummary);

export default router;
