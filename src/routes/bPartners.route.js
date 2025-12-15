import express from "express";
import { getAllPartners , getPartnerById , createPartner , updatePartner , deletePartner , getRelatedDataForPartner, getPartnerSummary, addPartnerContact, deletePartnerContact} from "../controllers/bPartner.controller.js";

const router = express.Router();

router.get("/", getAllPartners);

router.get("/:id", getPartnerById);

router.post("/", createPartner); 

router.post("/:id/contacts", addPartnerContact);

router.put("/:id", updatePartner);

router.delete("/:id", deletePartner);

router.delete("/:id/contacts/:contactId", deletePartnerContact);

router.get("/:id/related" , getRelatedDataForPartner);

router.get("/:id/summary" , getPartnerSummary);

export default router;
