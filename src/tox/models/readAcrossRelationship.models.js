/**
 * Mongoose model for ISO 10993-17 read-across relationships.
 *
 * Mirrors the SQL `ReadAcrossRelationship` model from the original
 * Python backend, but stored in MongoDB. Each document represents one
 * proposed source→target compound mapping along with similarity metrics,
 * the borrowed endpoint, and an optional approval block.
 */

import mongoose from 'mongoose'

const ReadAcrossApprovalSchema = new mongoose.Schema(
  {
    approved_by: { type: String, default: null },
    approved_at: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  { _id: false },
)

const ReadAcrossRelationshipSchema = new mongoose.Schema(
  {
    tra_project_id: { type: String, default: null, index: true },
    source_compound_id: { type: String, required: true, index: true },
    source_compound_name: { type: String, default: null },
    source_compound_smiles: { type: String, default: null },
    source_compound_cas: { type: String, default: null },
    target_compound_id: { type: String, required: true, index: true },
    target_compound_name: { type: String, default: null },
    target_compound_smiles: { type: String, default: null },
    target_compound_cas: { type: String, default: null },
    borrowed_endpoint: { type: String, default: null },
    borrowed_pod_value: { type: Number, default: null },
    borrowed_pod_unit: { type: String, default: null },
    tanimoto_similarity: { type: Number, default: null },
    similarity_method: { type: String, default: 'morgan' },
    source_klimisch_score: { type: Number, default: null },
    mw_ratio: { type: Number, default: null },
    logp_difference: { type: Number, default: null },
    iso_justification: { type: String, default: null },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected', 'archived'],
      default: 'draft',
      index: true,
    },
    approval: { type: ReadAcrossApprovalSchema, default: () => ({}) },
    created_at: { type: Date, default: Date.now },
    created_by: { type: String, default: null },
  },
  { timestamps: true, collection: 'tox_read_across_relationships' },
)

ReadAcrossRelationshipSchema.method('toJSON', function () {
  const obj = this.toObject({ versionKey: false })
  obj.id = String(obj._id)
  delete obj._id
  return obj
})

export const ReadAcrossRelationship =
  mongoose.models.ReadAcrossRelationship ??
  mongoose.model('ReadAcrossRelationship', ReadAcrossRelationshipSchema)
