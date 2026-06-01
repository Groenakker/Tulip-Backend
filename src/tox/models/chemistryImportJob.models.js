import mongoose from "mongoose";
const ChemistryImportSchema = new mongoose.Schema(
  {
    numeric_id: { type: Number, required: true, unique: true, index: true },
    filename: String,
    file_type: String,
    compounds: mongoose.Schema.Types.Mixed,
    records: mongoose.Schema.Types.Mixed,
    resolved: mongoose.Schema.Types.Mixed,
    operation: mongoose.Schema.Types.Mixed,
    status: { type: String, default: "parsed" }
  },
  { timestamps: true, collection: "tox_chemistry_imports" }
);
const ChemistryImportJob = mongoose.models.ChemistryImportJob ?? mongoose.model("ChemistryImportJob", ChemistryImportSchema);
export {
  ChemistryImportJob
};
