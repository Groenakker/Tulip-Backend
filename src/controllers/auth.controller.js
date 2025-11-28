import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { generateToken } from "../lib/utils.js";
import User from "../models/user.models.js";
import Company from "../models/company.models.js";
import Invite from "../models/invite.models.js";
import Role from "../models/roles.models.js";
import Permission from "../models/permissions.models.js";
import { sendOTPEmail, sendInviteEmail } from "../utils/mailer.js";
import {
  storeOTP,
  getOTP,
  deleteOTP,
  storeEmailVerification,
  checkEmailVerification,
  deleteEmailVerification,
} from "../lib/redis.js";

dotenv.config();
// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const normalizeRole = (role) => {
  if (!role || typeof role !== "string") {
    return "User";
  }

  const lowered = role.trim().toLowerCase();
  switch (lowered) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "user":
    default:
      return "User";
  }
};

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const ensureAdminRoleWithPermissions = async () => {
  const permissions = await Permission.find({ isActive: true }).select(
    "_id availableActions"
  );

  const fullPermissionSet = permissions.map((permission) => ({
    permissionId: permission._id,
    allowedActions: permission.availableActions,
  }));

  let adminRole = await Role.findOne({ name: "Admin" });

  if (!adminRole) {
    adminRole = await Role.create({
      name: "Admin",
      description: "System administrator with full access",
      permissions: fullPermissionSet,
      isSystemRole: true,
    });
    return adminRole;
  }

  const currentPermissionIds = new Set(
    (adminRole.permissions || []).map((perm) => perm.permissionId?.toString())
  );
  const needsUpdate =
    adminRole.permissions.length !== fullPermissionSet.length ||
    fullPermissionSet.some(
      (perm) => !currentPermissionIds.has(perm.permissionId.toString())
    );

  if (needsUpdate) {
    adminRole.permissions = fullPermissionSet;
    adminRole.isSystemRole = true;
    await adminRole.save();
  }

  return adminRole;
};

export const sendOTP = async (req, res) => {
  const { email } = req.body;
  
  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Generate and store OTP
    const otp = generateOTP();
    await storeOTP(email, otp);

    // Send OTP via email
    try {
      await sendOTPEmail(email, otp);
      res.status(200).json({ 
        message: "OTP sent successfully to your email",
        email: email 
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Still return success to prevent email enumeration
      res.status(200).json({ 
        message: "OTP sent successfully to your email",
        email: email 
      });
    }
  } catch (error) {
    console.error("Error in sendOTP:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  
  try {
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Invalid OTP format. OTP must be 6 digits" });
    }

    // Get stored OTP
    const storedOTP = await getOTP(email);
    
    if (!storedOTP) {
      return res.status(400).json({ message: "OTP expired or not found. Please request a new OTP" });
    }

    if (storedOTP !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // OTP is valid - delete it and store verification status
    await deleteOTP(email);
    await storeEmailVerification(email);

    res.status(200).json({ 
      message: "Email verified successfully",
      email: email 
    });
  } catch (error) {
    console.error("Error in verifyOTP:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const signup = async (req, res) => {
  const { name, companyName, email, password } = req.body;
  
  try {
    // Validate required fields
    if (!name || !companyName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const trimmedName = name.trim();
    const trimmedCompanyName = companyName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedCompanyName || !normalizedEmail) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    // Check if email is verified
    const isEmailVerified = await checkEmailVerification(normalizedEmail);
    if (!isEmailVerified) {
      return res.status(400).json({
        message: "Email not verified. Please verify your email first",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Check if company name already exists
    const existingCompany = await Company.findOne({
      company_name: trimmedCompanyName,
    });
    if (existingCompany) {
      return res.status(400).json({ message: "Company already exists" });
    }

    const adminRole = await ensureAdminRoleWithPermissions();

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const [company] = await Company.create(
        [
          {
            company_name: trimmedCompanyName,
            company_email: normalizedEmail,
            status: "Active",
          },
        ],
        { session }
      );

      const newUser = new User({
        name: trimmedName,
        username: normalizedEmail,
        companyName: trimmedCompanyName,
        company_id: company._id,
        email: normalizedEmail,
        password: hashedPassword,
        isVerified: true, // Email already verified via OTP
        roles: adminRole ? [adminRole._id] : [],
      });

      await newUser.save({ session });
      await Company.findByIdAndUpdate(
        company._id,
        { createdBy: newUser._id, updatedBy: newUser._id },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      // Delete email verification status from Redis
      await deleteEmailVerification(normalizedEmail);

      // Generate token and set cookie
      generateToken(newUser._id, res);

      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        companyName: newUser.companyName,
        company_id: newUser.company_id,
        email: newUser.email,
        profilePicture: newUser.profilePicture,
        roles: newUser.roles,
        message: "User created successfully",
      });
    } catch (transactionError) {
      await session.abortTransaction();
      session.endSession();
      throw transactionError;
    }
  } catch (error) {
    console.error("Error during signup:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const resolveRoleFromInput = async (input) => {
  if (!input) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(input)) {
    const roleById = await Role.findById(input);
    if (roleById) {
      return roleById;
    }
  }

  if (typeof input === "string") {
    return Role.findOne({ name: input.trim() });
  }

  return null;
};

export const inviteUser = async (req, res) => {
  const { email, role } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const inviter = await User.findById(req.userId);
    if (!inviter) {
      return res.status(404).json({ message: "Inviting user not found" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    let resolvedRole = await resolveRoleFromInput(role);
    if (!resolvedRole) {
      resolvedRole = await Role.findOne({ name: "User" });
    }

    if (!resolvedRole) {
      return res
        .status(400)
        .json({ message: "Selected role not found. Please create it first." });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "A user with this email already exists" });
    }

    // Revoke any previous pending invites for this email
    await Invite.updateMany(
      { email: normalizedEmail, status: "Pending" },
      { status: "Revoked" }
    );

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

    const invite = await Invite.create({
      email: normalizedEmail,
      username: normalizedEmail,
      companyName: inviter.companyName,
      company_id: inviter.company_id,
      role: resolvedRole.name,
      roleId: resolvedRole._id,
      invitedBy: inviter._id,
      tokenHash,
      expiresAt,
    });

    const baseUrl =
      process.env.INVITE_BASE_URL ||
      process.env.CLIENT_BASE_URL ||
      "http://localhost:5173";

    const inviteLink = `${baseUrl.replace(/\/$/, "")}/invite-signup?token=${rawToken}`;

    try {
      await sendInviteEmail({
        to: normalizedEmail,
        inviteLink,
        inviterName: inviter.name,
        companyName: inviter.companyName,
        role: resolvedRole.name,
      });
    } catch (emailError) {
      console.error("Error sending invite email:", emailError);
      // If email fails, keep invite so the inviter can resend later
    }

    return res.status(201).json({
      message: "Invitation sent successfully",
      inviteId: invite._id,
      expiresAt,
    });
  } catch (error) {
    console.error("Error inviting user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const validateInvite = async (req, res) => {
  const { token } = req.query;

  try {
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invite = await Invite.findOne({
      tokenHash,
      status: "Pending",
    });

    if (!invite) {
      return res.status(404).json({
        message: "Invitation not found or already used",
      });
    }

    if (invite.expiresAt < new Date()) {
      invite.status = "Expired";
      await invite.save();
      return res.status(410).json({ message: "Invitation has expired" });
    }

    return res.status(200).json({
      email: invite.email,
      companyName: invite.companyName,
      company_id: invite.company_id,
      role: invite.role,
      roleId: invite.roleId,
    });
  } catch (error) {
    console.error("Error validating invite:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const acceptInvite = async (req, res) => {
  const { token, name, password } = req.body;

  try {
    if (!token || !name || !password) {
      return res
        .status(400)
        .json({ message: "Token, name, and password are required" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invite = await Invite.findOne({
      tokenHash,
      status: "Pending",
    });

    if (!invite) {
      return res
        .status(404)
        .json({ message: "Invitation not found or already used" });
    }

    if (invite.expiresAt < new Date()) {
      invite.status = "Expired";
      await invite.save();
      return res.status(410).json({ message: "Invitation has expired" });
    }

    const normalizedEmail = invite.email;

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      invite.status = "Revoked";
      await invite.save();
      return res.status(400).json({ message: "User already exists" });
    }

    const existingUsername = await User.findOne({ name });
    if (existingUsername) {
      return res
        .status(400)
        .json({ message: "Username already exists. Choose another." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let resolvedRoleId = invite.roleId;
    if (!resolvedRoleId && invite.role) {
      const fallbackRole = await Role.findOne({ name: invite.role });
      if (fallbackRole) {
        resolvedRoleId = fallbackRole._id;
      }
    }

    const newUser = new User({
      name,
      companyName: invite.companyName,
      company_id: invite.company_id,
      email: normalizedEmail,
      username: normalizedEmail,
      password: hashedPassword,
      roles: resolvedRoleId ? [resolvedRoleId] : [],
      isVerified: true,
      createdBy: invite.invitedBy,
    });

    await newUser.save();

    invite.status = "Accepted";
    invite.acceptedAt = new Date();
    await invite.save();

    generateToken(newUser._id, res);

    return res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      companyName: newUser.companyName,
      company_id: newUser.company_id,
      email: newUser.email,
      username: newUser.username,
      profilePicture: newUser.profilePicture,
      message: "Invitation accepted successfully",
    });
  } catch (error) {
    console.error("Error accepting invite:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const {email,password} = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
      
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    
    generateToken(user._id, res);
    res.status(200).json({
      _id: user._id,
      name: user.name,
      companyName: user.companyName,
      company_id: user.company_id,
      email: user.email,
      username: user.username,
      profilePicture: user.profilePicture,
      message: "Login successful",
    });
      
      
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("token", "", { 
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'Strict',
    });
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("-password")
      .populate("roles", "name description isActive isSystemRole");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      companyName: user.companyName,
      company_id: user.company_id,
      email: user.email,
      username: user.username,
      profilePicture: user.profilePicture,
      roles: user.roles, // RBAC roles array
    });
  } catch (error) {
    console.error("Error in getMe:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export const getMyPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.roles || user.roles.length === 0) {
      return res.json({
        userId: user._id,
        hasSystemRole: false,
        permissions: [],
      });
    }

    const roleIds = user.roles.map((role) =>
      role?._id ? role._id : role
    );

    const roles = await Role.find({
      _id: { $in: roleIds },
      isActive: true,
    }).populate("permissions.permissionId");

    const hasSystemRole = roles.some((role) => role.isSystemRole);

    const permissionsMap = new Map();

    for (const role of roles) {
      for (const rolePermission of role.permissions || []) {
        const permission = rolePermission.permissionId;
        if (!permission) continue;

        if (!permissionsMap.has(permission.module)) {
          permissionsMap.set(permission.module, {
            module: permission.module,
            availableActions: permission.availableActions,
            allowedActions: new Set(),
          });
        }

        const modulePerms = permissionsMap.get(permission.module);
        (rolePermission.allowedActions || []).forEach((action) =>
          modulePerms.allowedActions.add(action)
        );
      }
    }

    const permissions = Array.from(permissionsMap.values()).map(
      (perm) => ({
        module: perm.module,
        availableActions: perm.availableActions,
        allowedActions: Array.from(perm.allowedActions),
      })
    );

    return res.json({
      userId: user._id,
      hasSystemRole,
      permissions,
    });
  } catch (error) {
    console.error("Error in getMyPermissions:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    // verifyTokenForRefresh middleware already set req.userId
    const user = await User.findById(req.userId).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate new token
    generateToken(user._id, res);
    
    res.status(200).json({
      _id: user._id,
      name: user.name,
      companyName: user.companyName,
      company_id: user.company_id,
      email: user.email,
      username: user.username,
      profilePicture: user.profilePicture,
      message: "Token refreshed successfully",
    });
  } catch (error) {
    console.error("Error in refreshToken:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
} 