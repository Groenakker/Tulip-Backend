import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema(
  {
    warehouseID: {
      type: String,
      required: true,
      unique: true,
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

const Warehouse = mongoose.model("Warehouse", warehouseSchema);

export default Warehouse;

