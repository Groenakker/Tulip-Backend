import mongoose from "mongoose";

const instanceSchema = new mongoose.Schema(
  {
    instanceCode: {
      type: String,
      required: true,
      unique: true,
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

const Instance = mongoose.model("Instance", instanceSchema);

export default Instance;
