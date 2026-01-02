import mongoose from "mongoose";

const sampleSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    sampleCode: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["Active", "Completed", "On Hold", "Cancelled", "Draft"],
      default: "Draft",
    },
    projectID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      trim: true
    },
    actDate: { type: Date },
    estDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    poNumber: { type: String },
    poDate: { type: Date },
    bPartnerCode: { type: String },
    bPartnerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bpartner"
    },
    contactID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact"
    },
    commitDate: { type: Date },
    quoteNumber: { type: String },
    salesOrderNumber: { type: String },
    image: { type: String },
    signatureImage: { type: String },
    // store full submission form here so UI fields persist
    formData: { type: mongoose.Schema.Types.Mixed },
    // Requested tests for this sample
    requestedTests: [{
      testCodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Testcode" },
      grkCode: { type: String },
      description: { type: String },
      samplesSubmitted: { type: String },
      extractionTime: { type: String },
      extractionTemp: { type: String },
      quality: { type: String, enum: ["GLP", "Non-GLP"] },
      category: { type: String },
      extractBased: { type: String }
    }],
    // Test metadata
    testMetadata: {
      totalSamplesSubmitted: { type: String },
      serviceLevel: { type: String, enum: ["Standard", "Expedited"] },
      notes: { type: String }
    }
  },

  { timestamps: true }
);

// Compound indexes for common queries
sampleSchema.index({ company_id: 1, status: 1 });
sampleSchema.index({ company_id: 1, createdAt: -1 });
sampleSchema.index({ company_id: 1, sampleCode: 1 }, { unique: true });
sampleSchema.index({ company_id: 1, projectID: 1 });

const Sample = mongoose.model("Sample", sampleSchema);

export default Sample;