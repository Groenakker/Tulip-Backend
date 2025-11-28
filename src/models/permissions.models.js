import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      enum: [
        "Dashboard",
        "Material Research",
        "Constituent Research",
        "Library",
        "Warehouse",
      "Projects",
      "Samples",
      "Receiving",
      "Shipping",
      "Test Codes",
      "Business Partners",
        "Users",
        "Roles",
        "Permissions",
      "Settings",
      "Sample Submission",
      "Create Sample",
      "Lab Studies",
      "Reports",
      "Instances",
      ],
    },
    availableActions: {
      type: [String],
      required: true,
      default: ["read", "write", "update", "delete"],
      enum: ["read", "write", "update", "delete", "export", "import"],
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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

const Permission = mongoose.model("Permission", permissionSchema);

export default Permission;

