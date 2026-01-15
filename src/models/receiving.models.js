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
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Completed", "On Hold", "Cancelled"],
      default: "Active",
    },
    projectID: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    actDate: {
      type: Date,
      required: true,
    },
    estDate: {
      type: Date,
      required: true,
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
      required: true,
    },
    poDate: {
      type: Date,
      required: true,
    },
    bPartnerCode: {
      type: String,
      required: true,
    },
    bPartnerID: {
      // type: mongoose.Schema.Types.ObjectId,
      type: String,
      ref: "Bpartner",
      required: true,
    },
    contactID: {
      // type: mongoose.Schema.Types.ObjectId,
      type: String,
      ref: "Contact",
    },
    commitDate: {
      type: Date,
      required: true,
    },
    quoteNumber: {
      type: String,
      required: true,
    },
    salesOrderNumber: {
      type: String,
      required: true,
    },
    image: {
      type: String, // Will store base64 string
      required: false,
    },
    bPartnerCode: {
      type: String,
      required: true,
    },
  },

  { timestamp: true }
);  
   

const Project = mongoose.model("Project", projectSchema);

export default Project;