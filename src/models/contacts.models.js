import mongoose from "mongoose";
import validator from "validator";

const contactSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: validator.isEmail,
        message: 'Invalid email address'
      }
    },
    phone: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^[\d\s\-\+\(\)]+$/.test(v);
        },
        message: 'Invalid phone number format'
      }
    },
    position: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    bPartnerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bpartner",
      required: true,
    },
    bPartnerCode: {
      type: String,
      required: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    notes: {
      type: String,
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

// Compound indexes for common queries
contactSchema.index({ company_id: 1, status: 1 });
contactSchema.index({ company_id: 1, createdAt: -1 });
contactSchema.index({ company_id: 1, bPartnerID: 1 });
contactSchema.index({ company_id: 1, email: 1 });

const Contact = mongoose.model("Contact", contactSchema);

export default Contact;
