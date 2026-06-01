import mongoose from "mongoose";
const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 }
  },
  { collection: "tox_counters" }
);
const Counter = mongoose.models.Counter ?? mongoose.model("Counter", CounterSchema);
async function nextSeq(name) {
  const c = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).lean();
  if (!c?.seq || !Number.isFinite(c.seq)) {
    throw new Error(`Counter '${name}' failed to allocate`);
  }
  return c.seq;
}
export {
  Counter,
  nextSeq
};
