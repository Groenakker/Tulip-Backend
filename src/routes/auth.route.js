import express from "express";
import {
  login,
  logout,
  signup,
  sendOTP,
  verifyOTP,
  getMe,
  refreshToken,
  inviteUser,
  validateInvite,
  acceptInvite,
  getMyPermissions,
} from "../controllers/auth.controller.js";
import { verifyToken, verifyTokenForRefresh } from "../lib/utils.js";

const router = express.Router();

router.post("/send-otp", sendOTP);

router.post("/verify-otp", verifyOTP);

router.post("/signup", signup);

router.post("/invite", verifyToken, inviteUser);

router.get("/invite/validate", validateInvite);

router.post("/invite/accept", acceptInvite);

router.post("/login", login);

router.post("/logout", logout);

router.get("/me", verifyToken, getMe);
router.get("/me/permissions", verifyToken, getMyPermissions);

router.post("/refresh", verifyTokenForRefresh, refreshToken);

export default router;