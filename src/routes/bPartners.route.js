import express from "express";
import { getAllPartners , getPartnerById , createPartner , updatePartner , deletePartner , getRelatedDataForPartner, getPartnerSummary} from "../controllers/bpartner.controller.js";

const router = express.Router();

router.get("/", getAllPartners);

router.get("/:id", getPartnerById);

router.post("/", createPartner); 

router.put("/:id", updatePartner);

router.delete("/:id", deletePartner);

router.get("/:id/related" , getRelatedDataForPartner);

router.get("/:id/summary" , getPartnerSummary);

export default router;
