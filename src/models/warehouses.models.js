import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    warehouseID: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    storage: {
      type: String,
      required: true,
      trim: true,
    },
    space: {
      type: String,
      enum: ["Full", "Space Available", "Empty"],
      default: "Empty",
      required: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for common queries
warehouseSchema.index({ company_id: 1, createdAt: -1 });
warehouseSchema.index({ company_id: 1, warehouseID: 1 }, { unique: true });
warehouseSchema.index({ company_id: 1, space: 1 });

const Warehouse = mongoose.model("Warehouse", warehouseSchema);

export default Warehouse;

