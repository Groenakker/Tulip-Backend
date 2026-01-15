import mongoose from "mongoose";

const shippingSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    shippingCode: {
      type: String,
      required: true,
      trim: true,
    },
    shipmentOrigin: {
      type: String,
      required: true,
    },
    shipmentDestination: {
      type: String,
      required: true,
    },
    logisticsProvider: {
      type: String,
      
      trim: true,
    },
    note: {
      type: String,
      
      trim: true,
    },
    shipmentDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    projectID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      
    },
    projectCode: {
      type: String,
      
    },
    projectDesc: {
      type: String,
      
    },
    estimatedArrivalDate: {
      type: Date,
      
    },
    estDate: {
      type: Date,
      
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    bPartnerCode: {
      type: String,
      
    },
    bPartnerID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bpartner",
      
    },
    contactID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
    },
    image: {
      type: String, // Will store base64 string
      required: false,
    },
  },

  { timestamps: true }
);

// Compound indexes for common queries
shippingSchema.index({ company_id: 1, status: 1 });
shippingSchema.index({ company_id: 1, createdAt: -1 });
shippingSchema.index({ company_id: 1, shippingCode: 1 }, { unique: true });
shippingSchema.index({ company_id: 1, projectID: 1 });


const Shipping = mongoose.model("Shipping", shippingSchema);

export default Shipping;