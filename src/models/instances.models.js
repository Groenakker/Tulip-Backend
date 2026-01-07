import mongoose from "mongoose";

const instanceSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    instanceCode: {
      type: String,
      required: true,
      trim: true,
    },
    idSample: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sample",
    },
    sampleCode: {
      type: String,
      required: true,
      trim: true,
    },
    lotNo: {
      type: String,
      required: false,
      trim: true,
      default: 'DEFAULT-LOT',
    },
    status: {
      type: String,
      enum: ["Pending", "In Testing", "Completed", "Failed", "Cancelled"],
      default: "Pending",
    },
    warehouseID: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: "Warehouse",
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
    timestamps: true // This automatically adds createdAt and updatedAt fields
  }
);

// Compound indexes for common queries
instanceSchema.index({ company_id: 1, status: 1 });
instanceSchema.index({ company_id: 1, createdAt: -1 });
instanceSchema.index({ company_id: 1, instanceCode: 1 }, { unique: true });
instanceSchema.index({ company_id: 1, idSample: 1 });

const Instance = mongoose.model("Instance", instanceSchema);

export default Instance;
