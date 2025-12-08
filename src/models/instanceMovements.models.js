import mongoose from "mongoose";

const instanceMovementSchema = new mongoose.Schema(
  {
    instanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Instance",
      required: true,
      index: true,
    },
    movementType: {
      type: String,
      enum: ["Received", "In Warehouse", "Shipped"],
      required: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: false,
    },
    warehouseID: {
      type: String,
      required: false,
      trim: true,
    },
    receivingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Receiving",
      required: false,
    },
    shippingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipping",
      required: false,
    },
    location: {
      type: String,
      required: false,
      trim: true,
    },
    notes: {
      type: String,
      required: false,
      trim: true,
    },
    movementDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { 
    timestamps: true 
  }
);

const InstanceMovement = mongoose.model("InstanceMovement", instanceMovementSchema);

export default InstanceMovement;

