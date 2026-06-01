import mongoose from "mongoose";
const TraProjectSchema = new mongoose.Schema(
  {
    numeric_id: { type: Number, required: true, unique: true, index: true },
    detail: { type: mongoose.Schema.Types.Mixed, required: true },
    assignments: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true, collection: "tox_tra_projects" }
);
const TraProject = mongoose.models.TraProject ?? mongoose.model("TraProject", TraProjectSchema);
export {
  TraProject
};
