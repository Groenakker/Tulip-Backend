import mongoose from "mongoose";
const CompoundFamilySchema = new mongoose.Schema(
  {
    numeric_id: { type: Number, required: true, unique: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true, collection: "tox_compound_families" }
);
const CompoundFamily = mongoose.models.CompoundFamily ?? mongoose.model("CompoundFamily", CompoundFamilySchema);
export {
  CompoundFamily
};
