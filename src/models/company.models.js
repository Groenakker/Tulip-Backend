import mongoose from "mongoose";

// ============================================================
// Shipping Address sub-schema
// ------------------------------------------------------------
// A company can have multiple ship-from addresses (e.g. HQ,
// warehouse, satellite office). Each is reusable when creating
// a Shippo label: the user picks one from a dropdown instead
// of retyping the full address every time.
// ============================================================
const shippingAddressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true }, // e.g. "Main Warehouse"
    name: { type: String, trim: true },
    company: { type: String, trim: true },
    street1: { type: String, trim: true },
    street2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zip: { type: String, trim: true },
    country: { type: String, trim: true, default: "US", uppercase: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: false }
);

const companySchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      default: function () {
        return this._id;
      },
      immutable: true,
    },
    company_name: {
      type: String,
      required: true,
      trim: true,
    },
    company_email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    address: {
      type: String,
      trim: true,
    },
    shippingAddresses: {
      type: [shippingAddressSchema],
      default: [],
    },
    profile_img: {
      type: String,
      default: "https://via.placeholder.com/150",
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
    timestamps: true,
  }
);

const Company = mongoose.model("Company", companySchema);

export default Company;
