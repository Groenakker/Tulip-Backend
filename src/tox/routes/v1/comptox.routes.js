/**
 * EPA CompTox endpoints — mirrors `app/api/v1/endpoints/comptox.py`.
 */

import { Router } from 'express'
import * as comptox from '../../services/comptox.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(await comptox.searchByName(q, parseIntParam(req.query.limit, 20, { min: 1, max: 100 })))
  }),
)

router.get(
  '/structure',
  asyncRoute(async (req, res) => {
    const smiles = String(req.query.smiles ?? '')
    if (!smiles) return res.status(400).json({ detail: 'Missing smiles' })
    res.json(await comptox.searchByStructure(smiles, String(req.query.search_type ?? 'exact')))
  }),
)

router.get(
  '/casrn/:casrn',
  asyncRoute(async (req, res) => {
    const r = await comptox.searchByCasrn(req.params.casrn)
    if (!r) return res.status(404).json({ detail: `CAS ${req.params.casrn} not found` })
    res.json(r)
  }),
)

router.get(
  '/:dtxsid/toxcast',
  asyncRoute(async (req, res) => res.json(await comptox.getToxcastData(req.params.dtxsid))),
)
router.get(
  '/:dtxsid/exposure',
  asyncRoute(async (req, res) => res.json(await comptox.getExposurePredictions(req.params.dtxsid))),
)
router.get(
  '/:dtxsid/hazard',
  asyncRoute(async (req, res) => res.json(await comptox.getHazardData(req.params.dtxsid))),
)
router.get(
  '/:dtxsid/properties',
  asyncRoute(async (req, res) => res.json(await comptox.getPhysicochemicalProperties(req.params.dtxsid))),
)
router.get(
  '/:dtxsid/lists',
  asyncRoute(async (req, res) => res.json(await comptox.getChemicalLists(req.params.dtxsid))),
)
router.get(
  '/:dtxsid/related',
  asyncRoute(async (req, res) => res.json(await comptox.getRelatedChemicals(req.params.dtxsid))),
)

// Detail route comes last so the `/:dtxsid` doesn't shadow `/search` etc.
router.get(
  '/:dtxsid',
  asyncRoute(async (req, res) => {
    const r = await comptox.getChemicalDetails(req.params.dtxsid)
    if (!r) return res.status(404).json({ detail: `Chemical ${req.params.dtxsid} not found` })
    res.json(r)
  }),
)

export default router
