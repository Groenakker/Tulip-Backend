/**
 * ECOTOX endpoints — mirrors `app/api/v1/endpoints/ecotox.py`.
 */

import { Router } from 'express'
import * as ecotox from '../../services/ecotox.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(await ecotox.searchChemical(q, parseIntParam(req.query.limit, 20, { min: 1, max: 100 })))
  }),
)

router.get(
  '/chemical/:identifier/aquatic',
  asyncRoute(async (req, res) =>
    res.json(
      await ecotox.getAquaticToxicity(req.params.identifier, {
        organism_group: req.query.organism_group ? String(req.query.organism_group) : undefined,
      }),
    ),
  ),
)

router.get(
  '/chemical/:identifier/terrestrial',
  asyncRoute(async (req, res) =>
    res.json(
      await ecotox.getTerrestrialToxicity(req.params.identifier, {
        organism_group: req.query.organism_group ? String(req.query.organism_group) : undefined,
      }),
    ),
  ),
)

router.get(
  '/chemical/:identifier/sensitivity',
  asyncRoute(async (req, res) =>
    res.json(
      await ecotox.getSpeciesSensitivity(req.params.identifier, {
        environment: String(req.query.environment ?? 'aquatic'),
      }),
    ),
  ),
)

router.get(
  '/chemical/:identifier/pnec',
  asyncRoute(async (req, res) =>
    res.json(
      await ecotox.getPnec(req.params.identifier, {
        environment: String(req.query.environment ?? 'aquatic'),
        assessment_factor: parseIntParam(req.query.assessment_factor, 1000, { min: 1, max: 10_000 }),
      }),
    ),
  ),
)

router.post(
  '/compare',
  asyncRoute(async (req, res) => {
    const chemicals = Array.isArray(req.body) ? req.body : []
    if (!chemicals.length) return res.status(400).json({ detail: 'Body must be an array of chemical identifiers' })
    res.json(
      await ecotox.compareChemicals(chemicals, {
        environment: String(req.query.environment ?? 'aquatic'),
        organism_group: req.query.organism_group ? String(req.query.organism_group) : undefined,
      }),
    )
  }),
)

export default router
