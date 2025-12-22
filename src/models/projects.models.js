import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
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
      unique: true,
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
      // type: mongoose.Schema.Types.ObjectId,
      type: String,
      ref: "Bpartner",
      required: true,
    },
    contact: {
      // type: mongoose.Schema.Types.ObjectId,
      type: String,
      
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

  { timestamp: true }
);  
   

const Project = mongoose.model("Project", projectSchema);

export default Project;