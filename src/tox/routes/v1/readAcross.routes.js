/**
 * Read-across endpoints — mirrors `app/api/v1/endpoints/read_across.py`.
 *
 * Auth-gated routes (`require_actor_roles(...)`) in the Python service
 * are intentionally exposed without auth here per project scope. Wiring
 * them back to a role-check happens when the auth module is restored.
 */

import { Router } from 'express'
import * as readAcross from '../../services/readAcross.service.js'
import { ReadAcrossRelationship } from '../../models/readAcrossRelationship.models.js'
import { asyncRoute, parseFloatParam, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

/* ----------------------- Candidate / similarity ----------------------- */

router.post(
  '/candidates/search',
  asyncRoute(async (req, res) => res.json(await readAcross.searchCandidates(req.body ?? {}))),
)

router.get(
  '/candidates/:compound_id',
  asyncRoute(async (req, res) => {
    // Without RDKit we accept SMILES via query string; the SPA falls back
    // to PubChem when no local profile exists.
    const target_smiles = String(req.query.smiles ?? '')
    res.json(
      await readAcross.searchCandidates({
        target_smiles,
        candidates: [],
        min_similarity: parseFloatParam(req.query.min_similarity, 0.7, { min: 0.5, max: 1.0 }),
        max_candidates: parseIntParam(req.query.max_candidates, 10, { min: 1, max: 50 }),
      }),
    )
  }),
)

router.post(
  '/similarity',
  asyncRoute(async (req, res) => {
    const smiles1 = String(req.query.smiles1 ?? req.body?.smiles1 ?? '')
    const smiles2 = String(req.query.smiles2 ?? req.body?.smiles2 ?? '')
    if (!smiles1 || !smiles2) return res.status(400).json({ detail: 'smiles1 and smiles2 are required' })
    res.json(await readAcross.calculateSimilarity(smiles1, smiles2, String(req.query.method ?? req.body?.method ?? 'morgan')))
  }),
)

router.post(
  '/validate',
  asyncRoute(async (req, res) => {
    const args = {
      tanimoto_similarity: parseFloatParam(req.query.tanimoto_similarity ?? req.body?.tanimoto_similarity, 0, { min: 0, max: 1 }),
      source_klimisch_score: parseIntParam(req.query.source_klimisch_score ?? req.body?.source_klimisch_score, 4, { min: 1, max: 4 }),
      mw_ratio: parseFloatParam(req.query.mw_ratio ?? req.body?.mw_ratio, undefined),
      logp_difference: parseFloatParam(req.query.logp_difference ?? req.body?.logp_difference, undefined),
    }
    res.json(readAcross.validateReadAcross(args))
  }),
)

router.post(
  '/generate-justification',
  asyncRoute(async (req, res) => res.json(readAcross.generateJustification(req.body ?? {}))),
)

/* --------------------- Relationship CRUD (Mongo) --------------------- */

router.post(
  '/relationships',
  asyncRoute(async (req, res) => {
    const doc = await ReadAcrossRelationship.create({
      ...req.body,
      status: req.body?.status ?? 'draft',
      created_at: new Date(),
    })
    res.status(201).json(doc.toJSON())
  }),
)

router.get(
  '/relationships',
  asyncRoute(async (req, res) => {
    const filter = {}
    if (req.query.compound_id) {
      filter.$or = [{ target_compound_id: req.query.compound_id }, { source_compound_id: req.query.compound_id }]
    }
    if (req.query.tra_project_id) filter.tra_project_id = req.query.tra_project_id
    if (req.query.status) filter.status = req.query.status
    const page = parseIntParam(req.query.page, 1, { min: 1 })
    const pageSize = parseIntParam(req.query.page_size, 20, { min: 1, max: 100 })
    const [items, total] = await Promise.all([
      ReadAcrossRelationship.find(filter)
        .sort({ created_at: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      ReadAcrossRelationship.countDocuments(filter),
    ])
    res.json({ page, page_size: pageSize, total, items: items.map((it) => it.toJSON()) })
  }),
)

router.get(
  '/relationships/:relationship_id',
  asyncRoute(async (req, res) => {
    const doc = await ReadAcrossRelationship.findById(req.params.relationship_id)
    if (!doc) return res.status(404).json({ detail: 'Relationship not found' })
    res.json(doc.toJSON())
  }),
)

router.patch(
  '/relationships/:relationship_id',
  asyncRoute(async (req, res) => {
    const doc = await ReadAcrossRelationship.findByIdAndUpdate(req.params.relationship_id, req.body, { new: true })
    if (!doc) return res.status(404).json({ detail: 'Relationship not found' })
    res.json(doc.toJSON())
  }),
)

router.put(
  '/relationships/:relationship_id/approve',
  asyncRoute(async (req, res) => {
    const doc = await ReadAcrossRelationship.findByIdAndUpdate(
      req.params.relationship_id,
      { status: 'approved', approval: { ...req.body, approved_at: new Date() } },
      { new: true },
    )
    if (!doc) return res.status(404).json({ detail: 'Relationship not found' })
    res.json(doc.toJSON())
  }),
)

router.delete(
  '/relationships/:relationship_id',
  asyncRoute(async (req, res) => {
    const result = await ReadAcrossRelationship.findByIdAndDelete(req.params.relationship_id)
    if (!result) return res.status(404).json({ detail: 'Relationship not found' })
    res.json({ deleted: true })
  }),
)

router.get(
  '/compound/:compound_id/relationships',
  asyncRoute(async (req, res) => {
    const filter = []
    if (String(req.query.as_target ?? 'true') !== 'false') filter.push({ target_compound_id: req.params.compound_id })
    if (String(req.query.as_source ?? 'true') !== 'false') filter.push({ source_compound_id: req.params.compound_id })
    const items = await ReadAcrossRelationship.find({ $or: filter }).sort({ created_at: -1 })
    res.json({ compound_id: req.params.compound_id, total: items.length, items: items.map((it) => it.toJSON()) })
  }),
)

export default router
