import mongoose from "mongoose";

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

