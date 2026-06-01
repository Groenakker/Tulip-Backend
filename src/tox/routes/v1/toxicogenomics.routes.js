/**
 * Toxicogenomics endpoints — mirrors `app/api/v1/endpoints/toxicogenomics.py`.
 */

import { Router } from 'express'
import * as tggates from '../../services/tggates.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(await tggates.searchCompound(q, parseIntParam(req.query.limit, 20, { min: 1, max: 100 })))
  }),
)

router.get(
  '/compound/:compound_name',
  asyncRoute(async (req, res) => {
    const r = await tggates.getCompoundDetails(req.params.compound_name)
    if (!r) return res.status(404).json({ detail: `Compound ${req.params.compound_name} not found` })
    res.json(r)
  }),
)

router.get(
  '/compound/:compound_name/signature',
  asyncRoute(async (req, res) =>
    res.json(
      await tggates.getExpressionSignature(req.params.compound_name, {
        tissue: String(req.query.tissue ?? 'Liver'),
        dose: String(req.query.dose ?? 'High'),
      }),
    ),
  ),
)

router.get(
  '/compound/:compound_name/pathology',
  asyncRoute(async (req, res) => res.json(await tggates.getPathologyFindings(req.params.compound_name))),
)

router.get(
  '/compound/:compound_name/similar',
  asyncRoute(async (req, res) =>
    res.json(
      await tggates.findSimilarCompounds(req.params.compound_name, parseIntParam(req.query.limit, 5, { min: 1, max: 20 })),
    ),
  ),
)

router.get(
  '/gene/:gene_symbol/compounds',
  asyncRoute(async (req, res) => res.json(await tggates.getGeneAffectedCompounds(req.params.gene_symbol))),
)

router.get(
  '/hepatotoxicants',
  asyncRoute(async (req, res) =>
    res.json(
      await tggates.listHepatotoxicants({
        mechanism: req.query.mechanism ? String(req.query.mechanism) : undefined,
      }),
    ),
  ),
)

router.get(
  '/compare',
  asyncRoute(async (req, res) => {
    const c1 = String(req.query.compound1 ?? '')
    const c2 = String(req.query.compound2 ?? '')
    if (!c1 || !c2) return res.status(400).json({ detail: 'compound1 and compound2 are required' })
    res.json(await tggates.compareExpressionProfiles(c1, c2))
  }),
)

export default router
