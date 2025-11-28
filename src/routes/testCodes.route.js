import express from "express";
import { getAllTestCodes , getTestCodeById , createTestCode , updateTestCode , deleteTestCode} from "../controllers/testCode.controller.js";

const router = express.Router();

router.get("/", getAllTestCodes);

router.get("/:id", getTestCodeById);

router.post("/", createTestCode); 

router.put("/:id", updateTestCode);

router.delete("/:id" , deleteTestCode);

export default router;
