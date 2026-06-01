/**
 * SIDER endpoints — mirrors `app/api/v1/endpoints/sider.py`.
 */

import { Router } from 'express'
import * as sider from '../../services/sider.service.js'
import { asyncRoute, attachSourceMetadata, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/drug/:drug_name/side-effects',
  asyncRoute(async (req, res) => {
    const r = await sider.getSideEffects(req.params.drug_name, parseIntParam(req.query.limit, 50, { min: 1, max: 200 }))
    res.json(attachSourceMetadata(r, 'sider', { query: req.params.drug_name, endpoint: 'side_effects' }))
  }),
)

router.get(
  '/drug/:drug_name/side-effect/:effect',
  asyncRoute(async (req, res) => {
    const r = await sider.getSideEffectFrequency(req.params.drug_name, req.params.effect)
    res.json(attachSourceMetadata(r, 'sider', { query: `${req.params.drug_name}:${req.params.effect}`, endpoint: 'side_effect_frequency' }))
  }),
)

router.get(
  '/drug/:drug_name/indications',
  asyncRoute(async (req, res) => {
    const r = await sider.getDrugIndications(req.params.drug_name)
    res.json(attachSourceMetadata(r, 'sider', { query: req.params.drug_name, endpoint: 'indications' }))
  }),
)

router.get(
  '/drug/:drug_name/side-effects-by-class',
  asyncRoute(async (req, res) => {
    const r = await sider.getSideEffectClasses(req.params.drug_name)
    res.json(attachSourceMetadata(r, 'sider', { query: req.params.drug_name, endpoint: 'side_effect_classes' }))
  }),
)

router.get(
  '/effect/:effect_name/drugs',
  asyncRoute(async (req, res) => {
    const r = await sider.searchBySideEffect(req.params.effect_name, parseIntParam(req.query.limit, 20, { min: 1, max: 100 }))
    res.json(attachSourceMetadata(r, 'sider', { query: req.params.effect_name, endpoint: 'search_by_side_effect' }))
  }),
)

router.get(
  '/compare',
  asyncRoute(async (req, res) => {
    const d1 = String(req.query.drug1 ?? '')
    const d2 = String(req.query.drug2 ?? '')
    if (!d1 || !d2) return res.status(400).json({ detail: 'Both drug1 and drug2 are required' })
    res.json(attachSourceMetadata(await sider.compareDrugs(d1, d2), 'sider', { query: `${d1},${d2}`, endpoint: 'compare_drugs' }))
  }),
)

export default router
