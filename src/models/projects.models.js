import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
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
    description: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: false,
    },
    endDate: {
      type: Date,
      required: false,
    },
    status: {
      type: String,
      enum: ["Active", "Completed", "On Hold", "Cancelled"],
      default: "Active",
    },
    projectID: {
      type: String,
      required: true,
      trim: true,
    },
    actDate: {
      type: Date,
      required: false,
    },
    estDate: {
      type: Date,
      required: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    poNumber: {
      type: String,
      required: false,
    },
    poDate: {
      type: Date,
      required: false,
    },
    bPartnerCode: {
      type: String,
      required: true,
    },
    bPartnerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bpartner",
      required: true,
    },
    contact: {
      type: String,
      required: false,
    },
    commitDate: {
      type: Date,
      required: false,
    },
    quoteNumber: {
      type: String,
      required: false,
    },

    salesOrderNumber: {
      type: String,
      required: false,
    },
    image: {
      type: String, // Will store base64 string
      required: false,
    },
  },

  { timestamps: true }
);

// Compound indexes for common queries
projectSchema.index({ company_id: 1, status: 1 });
projectSchema.index({ company_id: 1, createdAt: -1 });
projectSchema.index({ company_id: 1, projectID: 1 }, { unique: true });


const Project = mongoose.model("Project", projectSchema);

export default Project;