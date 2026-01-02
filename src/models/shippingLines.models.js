import mongoose from "mongoose";

const shippingLineSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    shippingId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipping", required: true, index: true },
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
shippingLineSchema.index({ company_id: 1, shippingId: 1 });
shippingLineSchema.index({ company_id: 1, sampleId: 1 });

const ShippingLine = mongoose.model("ShippingLine", shippingLineSchema);
export default ShippingLine;

