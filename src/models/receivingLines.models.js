import mongoose from "mongoose";

const receivingLineSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    receivingId: { type: mongoose.Schema.Types.ObjectId, ref: "Receiving", required: true, index: true },
    sampleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sample",
      required: true
    },
    sampleCode: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    lot: { type: String, required: false, trim: true },
    quantity: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// Compound indexes for common queries
receivingLineSchema.index({ company_id: 1, receivingId: 1 });
receivingLineSchema.index({ company_id: 1, sampleId: 1 });

const ReceivingLine = mongoose.model("ReceivingLine", receivingLineSchema);
export default ReceivingLine;


