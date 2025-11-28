import mongoose from "mongoose";

const shippingSchema = new mongoose.Schema(
  {
    shippingCode: {
      type: String,
      required: true,
      unique: true,
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
      required: true,
      trim: true,
    },
    note: {
      type: String,
      required: true,
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
      type: String,
      required: true,
      trim: true,
    },
    estimatedArrivalDate: {
      type: Date,
      required: true,
    },
    estDate: {
      type: Date,
      required: true,
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
      required: true,
    },
    bPartnerID: {
      // type: mongoose.Schema.Types.ObjectId,
      type: String,
      ref: "Bpartner",
      required: true,
    },
    contactID: {
      // type: mongoose.Schema.Types.ObjectId,
      type: String,
      ref: "Contact",
    },
    image: {
      type: String, // Will store base64 string
      required: false,
    },
  },

  { timestamp: true }
);  
   

const Shipping = mongoose.model("Shipping", shippingSchema);

export default Shipping;