import mongoose from "mongoose";

const stakeholderSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    role: { type: String, trim: true },
    status: { type: String, trim: true },
    avatar: { type: String, trim: true },
  },
  { _id: true }
);

const documentVersionSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    version: { type: String, trim: true, required: true },
    date: { type: Date, default: Date.now },
    author: { type: String, trim: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Creation", "Review", "Update", "Rejected", "Published"],
      default: "Creation",
    },
    fileName: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    stakeholders: [stakeholderSchema],
  },
  { timestamps: true }
);

documentVersionSchema.index({ company_id: 1, documentId: 1 });
documentVersionSchema.index({ company_id: 1, documentId: 1, version: 1 }, { unique: true });

const DocumentVersion = mongoose.model("DocumentVersion", documentVersionSchema);
export default DocumentVersion;
