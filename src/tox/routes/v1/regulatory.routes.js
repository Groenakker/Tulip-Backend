/**
 * Regulatory endpoints (IRIS + IARC + EFSA) — mirrors `app/api/v1/endpoints/regulatory.py`.
 */

import { Router } from 'express'
import * as iris from '../../services/iris.service.js'
import * as iarc from '../../services/iarc.service.js'
import * as efsa from '../../services/efsa.service.js'
import { asyncRoute, attachSourceMetadata, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

/* --------------------------------- IRIS --------------------------------- */

router.get(
  '/iris/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(
      attachSourceMetadata(
        await iris.searchByName(q, parseIntParam(req.query.limit, 20, { min: 1, max: 100 })),
        'iris',
        { query: q, endpoint: 'search' },
      ),
    )
  }),
)

router.get(
  '/iris/chemical/:identifier/reference-values',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await iris.getReferenceValues(req.params.identifier), 'iris', { query: req.params.identifier, endpoint: 'reference_values' })),
  ),
)

router.get(
  '/iris/chemical/:identifier/cancer',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await iris.getCancerAssessment(req.params.identifier), 'iris', { query: req.params.identifier, endpoint: 'cancer_assessment' })),
  ),
)

router.get(
  '/iris/chemical/:identifier',
  asyncRoute(async (req, res) => {
    const r = await iris.getChemicalAssessment(req.params.identifier)
    if (!r) return res.status(404).json({ detail: `Chemical ${req.params.identifier} not found in IRIS` })
    res.json(attachSourceMetadata(r, 'iris', { query: req.params.identifier, endpoint: 'assessment' }))
  }),
)

router.get(
  '/iris/carcinogens',
  asyncRoute(async (req, res) =>
    res.json(
      attachSourceMetadata(
        await iris.listCarcinogens({ classification: req.query.classification ? String(req.query.classification) : undefined }),
        'iris',
        { endpoint: 'carcinogens' },
      ),
    ),
  ),
)

router.post(
  '/iris/compare',
  asyncRoute(async (req, res) => {
    const chemicals = Array.isArray(req.body) ? req.body : []
    if (!chemicals.length) return res.status(400).json({ detail: 'Body must be array of chemical names/CAS' })
    res.json(attachSourceMetadata(await iris.compareReferenceValues(chemicals), 'iris', { query: chemicals.join(','), endpoint: 'compare' }))
  }),
)

/* --------------------------------- IARC --------------------------------- */

router.get(
  '/iarc/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(
      attachSourceMetadata(
        await iarc.searchAgents(q, {
          group: req.query.group ? String(req.query.group) : undefined,
          limit: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
        }),
        'iarc',
        { query: q, endpoint: 'search' },
      ),
    )
  }),
)

router.get(
  '/iarc/agent/:agent_name/evidence',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await iarc.getEvidenceSummary(req.params.agent_name), 'iarc', { query: req.params.agent_name, endpoint: 'evidence' })),
  ),
)

router.get(
  '/iarc/agent/:agent_name/mechanism',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await iarc.getMechanismData(req.params.agent_name), 'iarc', { query: req.params.agent_name, endpoint: 'mechanism' })),
  ),
)

router.get(
  '/iarc/agent/:agent_name',
  asyncRoute(async (req, res) => {
    const r = await iarc.getClassification(req.params.agent_name)
    if (!r) return res.status(404).json({ detail: `Agent ${req.params.agent_name} not found` })
    res.json(attachSourceMetadata(r, 'iarc', { query: req.params.agent_name, endpoint: 'classification' }))
  }),
)

router.get(
  '/iarc/group/:group',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await iarc.listGroupAgents(req.params.group), 'iarc', { query: req.params.group, endpoint: 'group_agents' })),
  ),
)

router.get(
  '/iarc/cancer-site/:cancer_site',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await iarc.searchByCancerSite(req.params.cancer_site), 'iarc', { query: req.params.cancer_site, endpoint: 'cancer_site_search' })),
  ),
)

router.get(
  '/iarc/statistics',
  asyncRoute(async (_req, res) => res.json(attachSourceMetadata(await iarc.getGroupStatistics(), 'iarc', { endpoint: 'statistics' }))),
)

router.post(
  '/iarc/compare',
  asyncRoute(async (req, res) => {
    const agents = Array.isArray(req.body) ? req.body : []
    if (!agents.length) return res.status(400).json({ detail: 'Body must be an array of agent names' })
    res.json(attachSourceMetadata(await iarc.compareClassifications(agents), 'iarc', { query: agents.join(','), endpoint: 'compare' }))
  }),
)

/* --------------------------------- EFSA --------------------------------- */

router.get(
  '/efsa/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(
      attachSourceMetadata(
        await efsa.searchSubstance(q, parseIntParam(req.query.limit, 20, { min: 1, max: 100 })),
        'efsa',
        { query: q, endpoint: 'search' },
      ),
    )
  }),
)

router.get(
  '/efsa/substance/:substance_id/reference-values',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await efsa.getReferenceValues(req.params.substance_id), 'efsa', { query: req.params.substance_id, endpoint: 'reference_values' })),
  ),
)

router.get(
  '/efsa/substance/:substance_id/genotoxicity',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await efsa.getGenotoxicityAssessment(req.params.substance_id), 'efsa', { query: req.params.substance_id, endpoint: 'genotoxicity' })),
  ),
)

router.get(
  '/efsa/substance/:substance_id/endpoints',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await efsa.getEndpointSummary(req.params.substance_id), 'efsa', { query: req.params.substance_id, endpoint: 'endpoints' })),
  ),
)

router.get(
  '/efsa/casrn/:casrn',
  asyncRoute(async (req, res) => {
    const r = await efsa.searchByCas(req.params.casrn)
    if (!r) return res.status(404).json({ detail: `CAS ${req.params.casrn} not found in EFSA` })
    res.json(attachSourceMetadata(r, 'efsa', { query: req.params.casrn, endpoint: 'search_by_cas' }))
  }),
)

router.get(
  '/efsa/pesticide/:substance_name/mrl',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await efsa.getPesticideResidues(req.params.substance_name), 'efsa', { query: req.params.substance_name, endpoint: 'pesticide_mrls' })),
  ),
)

router.get(
  '/efsa/additive/:e_number',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await efsa.getFoodAdditiveData(req.params.e_number), 'efsa', { query: req.params.e_number, endpoint: 'food_additive' })),
  ),
)

router.get(
  '/efsa/contaminant/:contaminant_name',
  asyncRoute(async (req, res) =>
    res.json(attachSourceMetadata(await efsa.getContaminantData(req.params.contaminant_name), 'efsa', { query: req.params.contaminant_name, endpoint: 'contaminant' })),
  ),
)

export default router
