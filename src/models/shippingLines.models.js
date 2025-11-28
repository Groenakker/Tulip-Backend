import mongoose from "mongoose";

const shippingLineSchema = new mongoose.Schema(
  {
    shippingId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipping", required: true, index: true },
    sampleId: { type: String, required: true, trim: true },
    sampleCode: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    lot: { type: String, required: false, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    companyID: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    
  },
  { timestamps: true }
);

const ShippingLine = mongoose.model("ShippingLine", shippingLineSchema);
export default ShippingLine;

