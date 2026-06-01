/**
 * KEGG + Reactome pathway endpoints — mirrors `app/api/v1/endpoints/pathways.py`.
 */

import { Router } from 'express'
import * as kegg from '../../services/kegg.service.js'
import * as reactome from '../../services/reactome.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

/* ----------------------------- KEGG ----------------------------- */

router.get(
  '/kegg/compound/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(await kegg.searchCompound(q, parseIntParam(req.query.limit, 20, { min: 1, max: 100 })))
  }),
)

router.get(
  '/kegg/compound/:kegg_id/pathways',
  asyncRoute(async (req, res) => res.json(await kegg.getCompoundPathways(req.params.kegg_id))),
)

router.get(
  '/kegg/compound/:kegg_id',
  asyncRoute(async (req, res) => {
    const r = await kegg.getCompound(req.params.kegg_id)
    if (!r) return res.status(404).json({ detail: `Compound ${req.params.kegg_id} not found` })
    res.json(r)
  }),
)

router.get(
  '/kegg/pathway/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(
      await kegg.searchPathway(q, {
        organism: String(req.query.organism ?? 'hsa'),
        limit: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
      }),
    )
  }),
)

router.get(
  '/kegg/pathway/:pathway_id',
  asyncRoute(async (req, res) => {
    const r = await kegg.getPathwayDetails(req.params.pathway_id)
    if (!r) return res.status(404).json({ detail: `Pathway ${req.params.pathway_id} not found` })
    res.json(r)
  }),
)

router.get(
  '/kegg/pathways/:organism',
  asyncRoute(async (req, res) => res.json(await kegg.listPathways({ organism: req.params.organism }))),
)

router.get(
  '/kegg/drug/:drug_name/metabolism',
  asyncRoute(async (req, res) => res.json(await kegg.getDrugMetabolism(req.params.drug_name))),
)

router.get(
  '/kegg/disease/:disease_name/pathways',
  asyncRoute(async (req, res) =>
    res.json(await kegg.getDiseasePathways(req.params.disease_name, parseIntParam(req.query.limit, 20, { min: 1, max: 100 }))),
  ),
)

router.get(
  '/kegg/enzyme/:ec_number',
  asyncRoute(async (req, res) => {
    const r = await kegg.getEnzymeInfo(req.params.ec_number)
    if (!r) return res.status(404).json({ detail: `Enzyme ${req.params.ec_number} not found` })
    res.json(r)
  }),
)

/* --------------------------- Reactome --------------------------- */

router.get(
  '/reactome/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(
      await reactome.searchByQuery(q, {
        species: String(req.query.species ?? 'Homo sapiens'),
        limit: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
      }),
    )
  }),
)

router.get(
  '/reactome/pathway/:pathway_id/participants',
  asyncRoute(async (req, res) =>
    res.json(
      await reactome.getPathwayParticipants(req.params.pathway_id, {
        entity_type: req.query.entity_type ? String(req.query.entity_type) : undefined,
      }),
    ),
  ),
)

router.get(
  '/reactome/pathway/:pathway_id/diagram',
  asyncRoute(async (req, res) => res.json(await reactome.getDiagramData(req.params.pathway_id))),
)

router.get(
  '/reactome/pathway/:pathway_id',
  asyncRoute(async (req, res) => {
    const r = await reactome.getPathwayDetails(req.params.pathway_id)
    if (!r) return res.status(404).json({ detail: `Pathway ${req.params.pathway_id} not found` })
    res.json(r)
  }),
)

router.get(
  '/reactome/entity/:entity_id/pathways',
  asyncRoute(async (req, res) =>
    res.json(await reactome.getPathwaysForEntity(req.params.entity_id, { species: String(req.query.species ?? 'Homo sapiens') })),
  ),
)

router.get(
  '/reactome/entity/:entity_id/interactors',
  asyncRoute(async (req, res) => res.json(await reactome.getInteractors(req.params.entity_id))),
)

router.get(
  '/reactome/hierarchy',
  asyncRoute(async (req, res) =>
    res.json(await reactome.getPathwayHierarchy({ species: String(req.query.species ?? 'Homo sapiens') })),
  ),
)

router.post(
  '/reactome/analyze',
  asyncRoute(async (req, res) => {
    const genes = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.genes) ? req.body.genes : []
    if (!genes.length) return res.status(400).json({ detail: 'Body must be an array of gene symbols' })
    res.json(await reactome.analyzeGeneList(genes, { species: String(req.query.species ?? 'Homo sapiens') }))
  }),
)

router.get(
  '/reactome/disease/:disease_name',
  asyncRoute(async (req, res) =>
    res.json(await reactome.getDiseasePathways(req.params.disease_name, { species: String(req.query.species ?? 'Homo sapiens') })),
  ),
)

export default router
