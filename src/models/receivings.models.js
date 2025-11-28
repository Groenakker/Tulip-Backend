import mongoose from "mongoose";

const receivingSchema = new mongoose.Schema(
  {
    receivingCode: { type: String, required: true, unique: true, trim: true },
    origin: { type: String, required: true, trim: true },
    destination: { type: String, required: false, trim: true },
    tracking: { type: String, required: false, trim: true },
    projectId: { type: String, required: false, trim: true },
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

const Receiving = mongoose.model("Receiving", receivingSchema);
export default Receiving;


