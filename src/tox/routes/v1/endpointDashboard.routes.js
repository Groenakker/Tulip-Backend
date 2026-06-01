/**
 * Endpoint-organised toxicity dashboard endpoints — mirrors
 * `app/api/v1/endpoints/endpoint_dashboard.py`.
 */

import { Router } from 'express'
import * as dashboard from '../../services/endpointDashboard.service.js'
import { asyncRoute, parseBoolParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/generate',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(
      await dashboard.generateDashboard(q, {
        include_echa: parseBoolParam(req.query.include_echa, true),
        include_toxtree: parseBoolParam(req.query.include_toxtree, true),
        include_chembl: parseBoolParam(req.query.include_chembl, true),
        include_faers: parseBoolParam(req.query.include_faers, true),
        include_iris: parseBoolParam(req.query.include_iris, true),
        include_iarc: parseBoolParam(req.query.include_iarc, true),
        include_ctd: parseBoolParam(req.query.include_ctd, true),
        include_sider: parseBoolParam(req.query.include_sider, true),
      }),
    )
  }),
)

router.get('/categories', (_req, res) => {
  res.json({
    categories: dashboard.listCategories(),
    contact_type_requirements: {
      limited_contact: { description: '<24 hours', required_endpoints: ['cytotoxicity', 'sensitization', 'irritation'] },
      prolonged_contact: {
        description: '24 hours to 30 days',
        required_endpoints: ['cytotoxicity', 'sensitization', 'irritation', 'systemic_toxicity', 'genotoxicity'],
      },
      permanent_contact: {
        description: '>30 days',
        required_endpoints: [
          'cytotoxicity',
          'sensitization',
          'irritation',
          'systemic_toxicity',
          'genotoxicity',
          'chronic_toxicity',
          'carcinogenicity',
          'reproductive_toxicity',
        ],
      },
    },
  })
})

export default router
