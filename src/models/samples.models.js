import mongoose from "mongoose";

const sampleSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    sampleCode: { type: String, unique: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["Active", "Completed", "On Hold", "Cancelled", "Draft"],
      default: "Draft",
    },
    projectID: { type: String, trim: true },
    actDate: { type: Date },
    estDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    poNumber: { type: String },
    poDate: { type: Date },
    bPartnerCode: { type: String },
    bPartnerID: { type: String, ref: "Bpartner" },
    contactID: { type: String, ref: "Contact" },
    commitDate: { type: Date },
    quoteNumber: { type: String },
    salesOrderNumber: { type: String },
    image: { type: String },
    signatureImage: { type: String },
    // store full submission form here so UI fields persist
    formData: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const Sample = mongoose.model("Sample", sampleSchema);

export default Sample;