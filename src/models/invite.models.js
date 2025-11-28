import mongoose from "mongoose";

const inviteSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    role: {
      type: String,
      trim: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Expired", "Revoked"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

inviteSchema.index({ email: 1, status: 1 });
inviteSchema.index({ expiresAt: 1 });

const Invite = mongoose.model("Invite", inviteSchema);

export default Invite;

