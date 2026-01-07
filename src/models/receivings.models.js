import mongoose from "mongoose";

const receivingSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    receivingCode: { type: String, required: true, trim: true },
    origin: { type: String, required: true, trim: true },
    destination: { type: String, required: false, trim: true },
    tracking: { type: String, required: false, trim: true },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: false
    },
    projectDesc: { type: String, required: false, trim: true },
    shippedDate: { type: Date },
    arrivedDate: { type: Date },
    estArrival: { type: Date },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    signatureImage: { type: String },
  },
  { timestamps: true }
);

// Compound indexes for common queries
receivingSchema.index({ company_id: 1, createdAt: -1 });
receivingSchema.index({ company_id: 1, receivingCode: 1 }, { unique: true });
receivingSchema.index({ company_id: 1, projectId: 1 });

const Receiving = mongoose.model("Receiving", receivingSchema);
export default Receiving;


