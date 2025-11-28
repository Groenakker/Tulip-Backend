import mongoose from "mongoose";

const receivingLineSchema = new mongoose.Schema(
  {
    receivingId: { type: mongoose.Schema.Types.ObjectId, ref: "Receiving", required: true, index: true },
    sampleId: { type: String, required: true, trim: true },
    sampleCode: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    lot: { type: String, required: false, trim: true },
    quantity: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

const ReceivingLine = mongoose.model("ReceivingLine", receivingLineSchema);
export default ReceivingLine;


