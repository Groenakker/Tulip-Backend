import express from "express";
import { getByToken, approve, reject } from "../controllers/stakeholderApproval.controller.js";

const router = express.Router();

// Public routes – no auth; access is controlled by the signed token in the URL
router.get("/:token", getByToken);
router.post("/:token/approve", approve);
router.post("/:token/reject", reject);

export default router;
