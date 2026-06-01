/**
 * AOP-Wiki endpoints — mirrors `app/api/v1/endpoints/aopwiki.py`.
 */

import { Router } from 'express'
import * as aopwiki from '../../services/aopwiki.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/aops',
  asyncRoute(async (req, res) =>
    res.json(
      await aopwiki.listAops(
        parseIntParam(req.query.limit, 50, { min: 1, max: 500 }),
        parseIntParam(req.query.offset, 0, { min: 0 }),
      ),
    ),
  ),
)

router.get(
  '/aops/search',
  asyncRoute(async (req, res) => {
    const stressor = String(req.query.stressor ?? '').trim()
    if (!stressor) return res.status(400).json({ detail: 'Missing required query parameter `stressor`' })
    res.json(await aopwiki.searchAopsByStressor(stressor, parseIntParam(req.query.limit, 20, { min: 1, max: 100 })))
  }),
)

router.get(
  '/aops/:aop_id/visualization',
  asyncRoute(async (req, res) => res.json(await aopwiki.getAopPathwayVisualization(Number(req.params.aop_id)))),
)

router.get(
  '/aops/:aop_id',
  asyncRoute(async (req, res) => {
    const r = await aopwiki.getAopDetails(Number(req.params.aop_id))
    if (!r) return res.status(404).json({ detail: `AOP ${req.params.aop_id} not found` })
    res.json(r)
  }),
)

router.get(
  '/key-events',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(
      await aopwiki.searchKeyEvents(q, {
        biological_level: req.query.biological_level ? String(req.query.biological_level) : undefined,
        limit: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
      }),
    )
  }),
)

router.get(
  '/key-events/:ke_id',
  asyncRoute(async (req, res) => {
    const r = await aopwiki.getKeyEvent(Number(req.params.ke_id))
    if (!r) return res.status(404).json({ detail: `Key event ${req.params.ke_id} not found` })
    res.json(r)
  }),
)

router.get(
  '/kers/:ker_id',
  asyncRoute(async (req, res) => {
    const r = await aopwiki.getKeyEventRelationship(Number(req.params.ker_id))
    if (!r) return res.status(404).json({ detail: `KER ${req.params.ker_id} not found` })
    res.json(r)
  }),
)

router.get(
  '/stressors',
  asyncRoute(async (req, res) =>
    res.json(
      await aopwiki.listStressors(
        parseIntParam(req.query.limit, 50, { min: 1, max: 500 }),
        parseIntParam(req.query.offset, 0, { min: 0 }),
      ),
    ),
  ),
)

router.get(
  '/stressors/:stressor_id',
  asyncRoute(async (req, res) => {
    const r = await aopwiki.getStressor(Number(req.params.stressor_id))
    if (!r) return res.status(404).json({ detail: `Stressor ${req.params.stressor_id} not found` })
    res.json(r)
  }),
)

export default router
