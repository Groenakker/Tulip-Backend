import mongoose from "mongoose";
const LibraryCompoundSchema = new mongoose.Schema(
  {
    numeric_id: { type: Number, required: true, unique: true, index: true },
    detail: { type: mongoose.Schema.Types.Mixed, required: true },
    report: { type: mongoose.Schema.Types.Mixed, required: false },
    pod_worksheet_overrides: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true, collection: "tox_library_compounds" }
);
const LibraryCompound = mongoose.models.LibraryCompound ?? mongoose.model("LibraryCompound", LibraryCompoundSchema);
export {
  LibraryCompound
};
