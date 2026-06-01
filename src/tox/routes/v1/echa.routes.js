/**
 * ECHA endpoints — mirrors `app/api/v1/endpoints/echa.py`.
 */

import { Router } from 'express'
import * as echa from '../../services/echa.service.js'
import { asyncRoute } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const query = String(req.query.query ?? '')
    if (!query) return res.status(400).json({ detail: 'Missing query' })
    const substances = await echa.searchSubstance(query, String(req.query.search_type ?? 'name'))
    res.json({ query, total_results: substances.length, substances })
  }),
)

router.get(
  '/toxicity',
  asyncRoute(async (req, res) => {
    const cas_number = req.query.cas_number ? String(req.query.cas_number) : undefined
    const ec_number = req.query.ec_number ? String(req.query.ec_number) : undefined
    const name = req.query.name ? String(req.query.name) : undefined
    if (!cas_number && !ec_number && !name) {
      return res.status(400).json({ detail: 'At least one of cas_number, ec_number, or name is required' })
    }
    const endpoints = await echa.getToxicityEndpoints({ cas_number, ec_number, substance_name: name })
    const queryParts = []
    if (cas_number) queryParts.push(`CAS: ${cas_number}`)
    if (ec_number) queryParts.push(`EC: ${ec_number}`)
    if (name) queryParts.push(`Name: ${name}`)
    res.json({
      query: queryParts.join(', '),
      total_endpoints: endpoints.length,
      endpoints,
      data_sources: ['ECHA CHEM API', 'REACH Registration Data', 'Bundled snapshot'],
      notes: [
        'For comprehensive toxicity data, consider downloading IUCLID REACH Study Results',
        'Reliability scores follow Klimisch criteria (1=reliable, 4=not assignable)',
        'Set ECHA_CHEM_API_BASE to point the service at the live CHEM API.',
      ],
    })
  }),
)

router.get('/info', (_req, res) => {
  res.json({
    data_sources: {
      echa_chem_api: {
        description: 'ECHA CHEM REST API for real-time substance lookups',
        url: 'https://chem.echa.europa.eu',
      },
      iuclid_reach_study_results: {
        description: 'Bulk download of REACH toxicology study results',
        url: 'https://iuclid6.echa.europa.eu/reach-study-results',
        substances_count: '~23,000',
      },
    },
    endpoint_types: {
      NOAEL: 'No Observed Adverse Effect Level',
      LOAEL: 'Lowest Observed Adverse Effect Level',
      LD50: 'Lethal Dose 50%',
      LC50: 'Lethal Concentration 50%',
    },
    reliability_scores: {
      1: 'Reliable without restriction',
      2: 'Reliable with restrictions',
      3: 'Not reliable',
      4: 'Not assignable',
    },
  })
})

export default router
