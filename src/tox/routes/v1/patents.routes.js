/**
 * SureChEMBL patent endpoints — mirrors `app/api/v1/endpoints/patents.py`.
 */

import { Router } from 'express'
import * as patents from '../../services/surechembl.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(
      await patents.searchCompound(q, {
        search_type: String(req.query.search_type ?? 'name'),
        limit: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
      }),
    )
  }),
)

router.get(
  '/compound/:schembl_id',
  asyncRoute(async (req, res) => {
    const r = await patents.getCompoundById(req.params.schembl_id)
    if (!r) return res.status(404).json({ detail: `Compound ${req.params.schembl_id} not found` })
    res.json(r)
  }),
)

router.get(
  '/compound/:schembl_id/patents',
  asyncRoute(async (req, res) =>
    res.json(await patents.getCompoundPatents(req.params.schembl_id, parseIntParam(req.query.limit, 50, { min: 1, max: 200 }))),
  ),
)

router.get(
  '/compound/:schembl_id/timeline',
  asyncRoute(async (req, res) => res.json(await patents.getPatentTimeline(req.params.schembl_id))),
)

router.get(
  '/patent/:patent_id/compounds',
  asyncRoute(async (req, res) =>
    res.json(await patents.getPatentCompounds(req.params.patent_id, parseIntParam(req.query.limit, 100, { min: 1, max: 500 }))),
  ),
)

router.get(
  '/structure/search',
  asyncRoute(async (req, res) => {
    const smiles = String(req.query.smiles ?? '')
    if (!smiles) return res.status(400).json({ detail: 'Missing smiles' })
    res.json(
      await patents.searchPatentsByStructure(smiles, {
        search_type: String(req.query.search_type ?? 'exact'),
        limit: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
      }),
    )
  }),
)

router.get(
  '/fto',
  asyncRoute(async (req, res) => {
    const smiles = String(req.query.smiles ?? '')
    if (!smiles) return res.status(400).json({ detail: 'Missing smiles' })
    res.json(await patents.getFreedomToOperate(smiles, { jurisdiction: String(req.query.jurisdiction ?? 'US') }))
  }),
)

router.get(
  '/assignee/:assignee/compounds',
  asyncRoute(async (req, res) =>
    res.json(await patents.getAssigneeCompounds(req.params.assignee, parseIntParam(req.query.limit, 50, { min: 1, max: 200 }))),
  ),
)

export default router
