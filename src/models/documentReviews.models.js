import mongoose from "mongoose";

const documentReviewSchema = new mongoose.Schema(
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
    reviewer: { type: String, trim: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    date: { type: Date, default: Date.now },
    comment: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Approved", "Rejected", "Pending"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

documentReviewSchema.index({ company_id: 1, documentId: 1 });

const DocumentReview = mongoose.model("DocumentReview", documentReviewSchema);
export default DocumentReview;
