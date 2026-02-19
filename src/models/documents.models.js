import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    documentID: { type: String, trim: true, required: true },
    name: { type: String, trim: true, required: true },
    status: {
      type: String,
      enum: ["Creation", "Review", "Update", "Rejected", "Published"],
      default: "Creation",
    },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: ["Logistics", "Finance", "HR", "Operations", "Quality", ""],
      trim: true,
    },
    currentVersion: { type: String, trim: true, default: "v1.0" },
    fileName: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    files: [
      { fileName: { type: String, trim: true }, fileUrl: { type: String, trim: true } },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

documentSchema.index({ company_id: 1, documentID: 1 }, { unique: true });
documentSchema.index({ company_id: 1, status: 1 });
documentSchema.index({ company_id: 1, createdAt: -1 });

const Document = mongoose.model("Document", documentSchema);
export default Document;
