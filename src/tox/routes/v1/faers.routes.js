/**
 * openFDA / FAERS endpoints — mirrors `app/api/v1/endpoints/faers.py`.
 */

import { Router } from 'express'
import * as openfda from '../../services/openfda.service.js'
import { asyncRoute, parseBoolParam, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const drug = String(req.query.drug ?? '')
    if (!drug) return res.status(400).json({ detail: 'Missing drug' })
    res.json(
      await openfda.searchAdverseEvents({
        drug_name: drug,
        limit: parseIntParam(req.query.limit, 100, { min: 1, max: 100 }),
        serious: req.query.serious == null ? null : parseBoolParam(req.query.serious, null),
      }),
    )
  }),
)

router.get(
  '/reactions/:drug',
  asyncRoute(async (req, res) =>
    res.json(await openfda.getReactionCounts(req.params.drug, parseIntParam(req.query.limit, 25, { min: 1, max: 100 }))),
  ),
)
router.get(
  '/outcomes/:drug',
  asyncRoute(async (req, res) => res.json(await openfda.getOutcomeStatistics(req.params.drug))),
)
router.get(
  '/demographics/:drug',
  asyncRoute(async (req, res) => res.json(await openfda.getDemographics(req.params.drug))),
)
router.get(
  '/timeseries/:drug',
  asyncRoute(async (req, res) =>
    res.json(await openfda.getTimeSeries(req.params.drug, String(req.query.date_field ?? 'receivedate'))),
  ),
)
router.get(
  '/interactions/:drug',
  asyncRoute(async (req, res) =>
    res.json(await openfda.getDrugInteractions(req.params.drug, parseIntParam(req.query.limit, 20, { min: 1, max: 100 }))),
  ),
)
router.get(
  '/reaction/search',
  asyncRoute(async (req, res) => {
    const r = String(req.query.reaction ?? '')
    if (!r) return res.status(400).json({ detail: 'Missing reaction' })
    res.json(await openfda.searchByReaction(r, parseIntParam(req.query.limit, 100, { min: 1, max: 100 })))
  }),
)
router.get(
  '/reaction/:reaction/drugs',
  asyncRoute(async (req, res) =>
    res.json(
      await openfda.getDrugsForReaction(req.params.reaction, parseIntParam(req.query.limit, 20, { min: 1, max: 100 })),
    ),
  ),
)

export default router
