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

    // ----------------------------------------------------------
    // Project Management (Monday-style) additions
    // ----------------------------------------------------------
    // Team members assigned to the project. Each entry stores a
    // user reference plus the role they play on THIS project so
    // someone can be a Manager on one project and a Member on
    // another without juggling tenant-wide roles. The Project
    // Manager has authority to assign tasks; Members can only
    // update their own. Owners can do everything including
    // editing the team.
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["Owner", "Manager", "Member", "Viewer"],
          default: "Member",
        },
        addedAt: { type: Date, default: Date.now },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    // Tag palette for tasks on this project. The Task model
    // embeds (snapshot) the picked tags so renames here don't
    // forcibly cascade; this list is just the menu the task
    // editor offers. Colours follow the Tulip blue accent set
    // by default but anything CSS-valid works.
    tags: [
      {
        name: { type: String, trim: true, required: true },
        color: { type: String, trim: true, default: "#4570B6" },
      },
    ],
  },

  { timestamps: true }
);

// Compound indexes for common queries
projectSchema.index({ company_id: 1, status: 1 });
projectSchema.index({ company_id: 1, createdAt: -1 });
projectSchema.index({ company_id: 1, projectID: 1 }, { unique: true });
// Quick lookup of all projects a given user is a member of.
projectSchema.index({ company_id: 1, "members.user": 1 });


const Project = mongoose.model("Project", projectSchema);

export default Project;
