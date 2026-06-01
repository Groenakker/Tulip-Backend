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
      set: (val) => {
        // Convert empty strings to undefined so sparse index works correctly
        if (!val || val.trim() === "") {
          return undefined;
        }
        return val.trim().toLowerCase();
      },
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
    },
    zip: {
      type: String,
    },
    country: {
      type: String,
    },
    address1: {
      type: String,
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
    // Sample / TRF documents the partner uses. These templates show
    // up as printable artifacts in the Shipping Log, and the document
    // scanner mines their field labels so the Sample Submission form
    // can suggest matching new fields.
    //
    // Multiple documents can be uploaded per BP, but exactly one is
    // flagged `isCurrent`. The "current working version" is what the
    // Sample Submission form pulls candidate custom fields from, and
    // what the Shipping Log surfaces in its "Print BP Documents"
    // button. Older / superseded versions stay in the array as
    // history.
    sampleDocuments: [
      {
        filename: { type: String, required: true, trim: true },
        url: { type: String, required: true },
        path: { type: String },
        mimeType: { type: String },
        size: { type: Number },
        category: {
          type: String,
          enum: ["Test Request Form", "TIDS", "PCF", "MSDS", "COA", "Specification", "Other"],
          default: "Test Request Form",
        },
        description: { type: String, trim: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        // The "current working version" flag. Exactly one sample
        // document per BP should be true at a time. Newly uploaded
        // docs are flagged true automatically (the upload supersedes
        // the previous current version) and the flag can be moved
        // explicitly via setCurrentPartnerDocument().
        isCurrent: { type: Boolean, default: false },
        // Scanner output: extracted plaintext + the label/field
        // candidates the scanner detected (used by Sample Submission
        // to suggest custom fields the user can adopt).
        extractedText: { type: String },
        scannedAt: { type: Date },
        detectedFields: [
          {
            label: { type: String, trim: true },
            normalizedKey: { type: String, trim: true },
            sampleValue: { type: String, trim: true },
            // "schema"  -> matches a known Sample field (already supported)
            // "custom"  -> not in the schema, candidate for customFields
            matchStatus: { type: String, enum: ["schema", "custom"], default: "custom" },
            schemaField: { type: String },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

// Compound indexes for common queries
bpartnerSchema.index({ company_id: 1, status: 1 });
bpartnerSchema.index({ company_id: 1, createdAt: -1 });
bpartnerSchema.index({ company_id: 1, partnerNumber: 1 }, { unique: true });
bpartnerSchema.index({ company_id: 1, category: 1 });
// Sparse unique index on email: allows multiple null/undefined emails, but enforces uniqueness when email is provided
bpartnerSchema.index({ email: 1 }, { unique: true, sparse: true });

const Bpartner = mongoose.model("Bpartner", bpartnerSchema);
export default Bpartner;
