import mongoose from "mongoose";

const instanceMovementSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
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

// Compound indexes for common queries
instanceMovementSchema.index({ company_id: 1, instanceId: 1 });
instanceMovementSchema.index({ company_id: 1, movementType: 1 });
instanceMovementSchema.index({ company_id: 1, movementDate: -1 });

const InstanceMovement = mongoose.model("InstanceMovement", instanceMovementSchema);

export default InstanceMovement;

