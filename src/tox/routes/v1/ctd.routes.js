/**
 * CTD endpoints — mirrors `app/api/v1/endpoints/ctd.py`.
 */

import { Router } from 'express'
import * as ctd from '../../services/ctd.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

function lim(req) {
  return parseIntParam(req.query.limit, 100, { min: 1, max: 500 })
}

router.get(
  '/chemical/:chemical_name/genes',
  asyncRoute(async (req, res) => res.json(await ctd.getChemicalGenes(req.params.chemical_name, lim(req)))),
)
router.get(
  '/chemical/:chemical_name/diseases',
  asyncRoute(async (req, res) => res.json(await ctd.getChemicalDiseases(req.params.chemical_name, lim(req)))),
)
router.get(
  '/chemical/:chemical_name/pathways',
  asyncRoute(async (req, res) => res.json(await ctd.getChemicalPathways(req.params.chemical_name, lim(req)))),
)
router.get(
  '/chemical/:chemical_name/go',
  asyncRoute(async (req, res) =>
    res.json(await ctd.getGoEnrichment(req.params.chemical_name, String(req.query.ontology ?? 'all'), lim(req))),
  ),
)
router.get(
  '/chemical/:chemical_name/phenotypes',
  asyncRoute(async (req, res) => res.json(await ctd.getPhenotypeData(req.params.chemical_name, lim(req)))),
)
router.get(
  '/gene/:gene_symbol/chemicals',
  asyncRoute(async (req, res) => res.json(await ctd.getGeneChemicalInteractions(req.params.gene_symbol, lim(req)))),
)
router.get(
  '/gene/:gene_symbol/diseases',
  asyncRoute(async (req, res) => res.json(await ctd.getGeneDiseases(req.params.gene_symbol, lim(req)))),
)
router.get(
  '/disease/:disease_name/chemicals',
  asyncRoute(async (req, res) => res.json(await ctd.getDiseaseChemicals(req.params.disease_name, lim(req)))),
)
router.get(
  '/disease/:disease_name/genes',
  asyncRoute(async (req, res) => res.json(await ctd.getDiseaseGenes(req.params.disease_name, lim(req)))),
)

export default router
