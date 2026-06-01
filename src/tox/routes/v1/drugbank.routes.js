/**
 * DrugBank endpoints — mirrors `app/api/v1/endpoints/drugbank.py`.
 */

import { Router } from 'express'
import * as drugbank from '../../services/drugbank.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(await drugbank.searchDrug(q, parseIntParam(req.query.limit, 20, { min: 1, max: 100 })))
  }),
)

router.get(
  '/drug/:drugbank_id',
  asyncRoute(async (req, res) => {
    const r = await drugbank.getDrug(req.params.drugbank_id)
    if (!r) return res.status(404).json({ detail: `Drug ${req.params.drugbank_id} not found` })
    res.json(r)
  }),
)

router.get(
  '/drug/:drugbank_id/targets',
  asyncRoute(async (req, res) => res.json(await drugbank.getDrugTargets(req.params.drugbank_id))),
)
router.get(
  '/drug/:drugbank_id/interactions',
  asyncRoute(async (req, res) => res.json(await drugbank.getDrugInteractions(req.params.drugbank_id))),
)
router.get(
  '/drug/:drugbank_id/pharmacokinetics',
  asyncRoute(async (req, res) => res.json(await drugbank.getPharmacokinetics(req.params.drugbank_id))),
)
router.get(
  '/drug/:drugbank_id/food-interactions',
  asyncRoute(async (req, res) => res.json(await drugbank.getFoodInteractions(req.params.drugbank_id))),
)
router.get(
  '/drug/:drugbank_id/enzymes',
  asyncRoute(async (req, res) => res.json(await drugbank.getEnzymes(req.params.drugbank_id))),
)
router.get(
  '/drug/:drugbank_id/transporters',
  asyncRoute(async (req, res) => res.json(await drugbank.getTransporters(req.params.drugbank_id))),
)
router.get(
  '/drug/:drugbank_id/pathways',
  asyncRoute(async (req, res) => res.json(await drugbank.getPathways(req.params.drugbank_id))),
)
router.get(
  '/target/:target_name/drugs',
  asyncRoute(async (req, res) =>
    res.json(await drugbank.searchByTarget(req.params.target_name, parseIntParam(req.query.limit, 20, { min: 1, max: 100 }))),
  ),
)

export default router
