import mongoose from "mongoose";
import validator from "validator";

const bpartnerSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || validator.isEmail(v);
        },
        message: 'Invalid email address'
      }
    },
    phone: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^[\d\s\-\+\(\)]+$/.test(v);
        },
        message: 'Invalid phone number format'
      }
    },
    category: {
      type: String,
      enum: ["Vendor", "Client", "Client & Vendor"],
      required: true,
    },
    city: {
      type: String,
    },
    state: {
      type: String,
      required: true,
    },
    zip: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    address1: {
      type: String,
      required: true,
    },
    address2: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    partnerNumber: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: false,
      default: "https://via.placeholder.com/150",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    contacts: [
      {
        name: { type: String, trim: true },
        email: {
          type: String,
          lowercase: true,
          trim: true,
          validate: {
            validator: function (v) {
              return !v || validator.isEmail(v);
            },
            message: 'Invalid email address'
          }
        },
        phone: {
          type: String,
          trim: true,
          validate: {
            validator: function (v) {
              return !v || /^[\d\s\-\+\(\)]+$/.test(v);
            },
            message: 'Invalid phone number format'
          }
        },
        jobTitle: { type: String, trim: true },
      },
    ],
    testCodes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Testcode",
      }
    ],
  },
  { timestamps: true }
);

// Compound indexes for common queries
bpartnerSchema.index({ company_id: 1, status: 1 });
bpartnerSchema.index({ company_id: 1, createdAt: -1 });
bpartnerSchema.index({ company_id: 1, partnerNumber: 1 }, { unique: true });
bpartnerSchema.index({ company_id: 1, category: 1 });

const Bpartner = mongoose.model("Bpartner", bpartnerSchema);
export default Bpartner;