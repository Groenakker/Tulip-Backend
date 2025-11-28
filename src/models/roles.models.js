import mongoose from "mongoose";

const rolePermissionSchema = new mongoose.Schema(
  {
    permissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
      required: true,
    },
    allowedActions: {
      type: [String],
      required: true,
      enum: ["read", "write", "update", "delete", "export", "import"],
    },
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    permissions: {
      type: [rolePermissionSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
roleSchema.index({ name: 1 });
roleSchema.index({ isActive: 1 });

const Role = mongoose.model("Role", roleSchema);

export default Role;

