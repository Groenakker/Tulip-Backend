import mongoose from "mongoose";

const shippingLineSchema = new mongoose.Schema(
  {
    shippingId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipping", required: true, index: true },
    sampleId: { type: String, required: true, trim: true },
    sampleCode: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    lot: { type: String, required: false, trim: true },
    instances: [
      {
        instanceId: { type: mongoose.Schema.Types.ObjectId, ref: "Instance" },
        instanceCode: { type: String, trim: true },
        sampleCode: { type: String, trim: true },
        lotNo: { type: String, trim: true },
        status: { 
          type: String, 
          enum: ["Pending", "In Testing", "Completed", "Failed", "Cancelled"],
          default: "Pending"
        },
      },
    ],
    quantity: { type: Number, default: 0, min: 0 },
    companyID: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    
  },
  { timestamps: true }
);

// Pre-save hook to automatically update quantity based on instances array length
shippingLineSchema.pre('save', function(next) {
  if (this.instances && Array.isArray(this.instances)) {
    this.quantity = this.instances.length;
  } else {
    this.quantity = 0;
  }
  next();
});

const ShippingLine = mongoose.model("ShippingLine", shippingLineSchema);
export default ShippingLine;

