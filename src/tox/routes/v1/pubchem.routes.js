/**
 * PubChem endpoints — mirrors `app/api/v1/endpoints/pubchem.py`.
 */

import { Router } from 'express'
import * as pubchem from '../../services/pubchem.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const query = String(req.query.query ?? '').trim()
    if (!query) return res.status(400).json({ detail: 'Missing query' })
    res.json(await pubchem.searchByName(query, parseIntParam(req.query.limit, 20, { min: 1, max: 100 })))
  }),
)

router.get(
  '/structure',
  asyncRoute(async (req, res) => {
    const smiles = String(req.query.smiles ?? '')
    if (!smiles) return res.status(400).json({ detail: 'Missing smiles' })
    res.json(await pubchem.searchBySmiles(smiles, String(req.query.search_type ?? 'identity')))
  }),
)

router.get(
  '/resolve',
  asyncRoute(async (req, res) => {
    const id = String(req.query.identifier ?? '')
    if (!id) return res.status(400).json({ detail: 'Missing identifier' })
    res.json(await pubchem.resolveToAllIds(id))
  }),
)

router.get(
  '/cid/:cid',
  asyncRoute(async (req, res) => {
    const result = await pubchem.getCompoundByCid(req.params.cid)
    if (!result) return res.status(404).json({ detail: `CID ${req.params.cid} not found` })
    res.json(result)
  }),
)

router.get(
  '/cid/:cid/properties',
  asyncRoute(async (req, res) => {
    res.json(await pubchem.getCompoundProperties(req.params.cid))
  }),
)

router.get(
  '/cid/:cid/synonyms',
  asyncRoute(async (req, res) => {
    const synonyms = await pubchem.getSynonyms(req.params.cid)
    res.json({ cid: Number(req.params.cid), total_synonyms: synonyms.length, synonyms })
  }),
)

router.get(
  '/cid/:cid/bioassays',
  asyncRoute(async (req, res) => {
    res.json(
      await pubchem.getBioassays(
        req.params.cid,
        String(req.query.activity ?? 'active'),
        parseIntParam(req.query.limit, 50, { min: 1, max: 500 }),
      ),
    )
  }),
)

router.get(
  '/cid/:cid/safety',
  asyncRoute(async (req, res) => {
    res.json(await pubchem.getSafetyData(req.params.cid))
  }),
)

router.get(
  '/cid/:cid/xrefs',
  asyncRoute(async (req, res) => {
    res.json(await pubchem.getCrossReferences(req.params.cid))
  }),
)

router.get(
  '/cid/:cid/pharmacology',
  asyncRoute(async (req, res) => {
    res.json(await pubchem.getPharmacologyData(req.params.cid))
  }),
)

export default router
