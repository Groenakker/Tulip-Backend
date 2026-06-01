/**
 * Target endpoints — mirrors `app/api/v1/endpoints/targets.py`.
 * Bioactivity + mechanism lookups reuse the existing chembl helpers.
 */

import { Router } from 'express'
import { searchTargets } from '../../services/chemblTargets.service.js'
import { getBioactivity, getMechanism } from '../../services/chembl.js'
import { asyncRoute, parseFloatParam, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    if (!req.query.query && !req.query.gene_symbol) {
      return res.status(400).json({ detail: "Either 'query' or 'gene_symbol' must be provided" })
    }
    const result = await searchTargets({
      query: req.query.query ? String(req.query.query) : undefined,
      gene_symbol: req.query.gene_symbol ? String(req.query.gene_symbol) : undefined,
      organism: req.query.organism ? String(req.query.organism) : 'Homo sapiens',
      target_type: req.query.target_type ? String(req.query.target_type) : undefined,
      limit: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
    })
    res.json({
      query: req.query.query ?? req.query.gene_symbol ?? '',
      ...result,
    })
  }),
)

router.get(
  '/:target_id/bioactivity',
  asyncRoute(async (req, res) => {
    const result = await getBioactivity({
      target_chembl_id: req.params.target_id,
      activity_type: req.query.activity_type ? String(req.query.activity_type) : undefined,
      min_pchembl: parseFloatParam(req.query.min_pchembl, undefined, { min: 0, max: 14 }),
      limit: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
    })
    const compounds = new Map()
    for (const act of result.bioactivities ?? []) {
      const id = act.molecule_chembl_id
      if (!id || compounds.has(id)) continue
      compounds.set(id, {
        chembl_id: id,
        name: act.target_pref_name,
        activity_type: act.standard_type,
        activity_value: act.standard_value,
        activity_units: act.standard_units,
        pchembl_value: act.pchembl_value,
      })
    }
    res.json({
      target_id: req.params.target_id,
      target_name: null,
      total_compounds: compounds.size,
      compounds: [...compounds.values()],
    })
  }),
)

router.get(
  '/:target_id/mechanism',
  asyncRoute(async (req, res) => {
    res.json({
      target_id: req.params.target_id,
      ...(await getMechanism(req.params.target_id, parseIntParam(req.query.limit, 20, { min: 1, max: 100 }))),
    })
  }),
)

router.get(
  '/:target_id',
  asyncRoute(async (req, res) => {
    const result = await searchTargets({ query: req.params.target_id, organism: null, limit: 1 })
    const target = result.targets?.[0]
    if (!target) return res.status(404).json({ detail: `Target ${req.params.target_id} not found` })
    res.json(target)
  }),
)

export default router
