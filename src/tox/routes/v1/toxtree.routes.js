/**
 * Toxtree QSAR endpoints — mirrors `app/api/v1/endpoints/toxtree.py`.
 */

import { Router } from 'express'
import * as toxtree from '../../services/toxtree.service.js'
import { asyncRoute } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/predict',
  asyncRoute(async (req, res) => {
    const smiles = String(req.query.smiles ?? '').trim()
    if (!smiles) return res.status(400).json({ detail: 'SMILES string is required' })
    res.json(await toxtree.predictAll(smiles, req.query.compound_name ? String(req.query.compound_name) : null))
  }),
)

router.get('/cramer', asyncRoute(async (req, res) => {
  const smiles = String(req.query.smiles ?? '').trim()
  if (!smiles) return res.status(400).json({ detail: 'SMILES required' })
  res.json(await toxtree.predictCramer(smiles))
}))

router.get('/mutagenicity', asyncRoute(async (req, res) => {
  const smiles = String(req.query.smiles ?? '').trim()
  if (!smiles) return res.status(400).json({ detail: 'SMILES required' })
  res.json(await toxtree.predictMutagenicity(smiles))
}))

router.get('/carcinogenicity', asyncRoute(async (req, res) => {
  const smiles = String(req.query.smiles ?? '').trim()
  if (!smiles) return res.status(400).json({ detail: 'SMILES required' })
  res.json(await toxtree.predictCarcinogenicity(smiles))
}))

router.get('/skin-sensitization', asyncRoute(async (req, res) => {
  const smiles = String(req.query.smiles ?? '').trim()
  if (!smiles) return res.status(400).json({ detail: 'SMILES required' })
  res.json(await toxtree.predictSkinSensitization(smiles))
}))

router.get('/skin-irritation', asyncRoute(async (req, res) => {
  const smiles = String(req.query.smiles ?? '').trim()
  if (!smiles) return res.status(400).json({ detail: 'SMILES required' })
  res.json(await toxtree.predictSkinIrritation(smiles))
}))

router.get('/eye-irritation', asyncRoute(async (req, res) => {
  const smiles = String(req.query.smiles ?? '').trim()
  if (!smiles) return res.status(400).json({ detail: 'SMILES required' })
  res.json(await toxtree.predictEyeIrritation(smiles))
}))

router.get('/info', (_req, res) => {
  res.json({
    prediction_modules: {
      cramer: { name: 'Cramer Rules', classes: ['I', 'II', 'III'] },
      mutagenicity: { name: 'Ames Mutagenicity', basis: 'Benigni-Bossa rulebase' },
      carcinogenicity: { name: 'Carcinogenicity', basis: 'ISS rules' },
      skin_sensitization: { name: 'Skin Sensitization' },
      skin_irritation: { name: 'Skin Irritation' },
      eye_irritation: { name: 'Eye Irritation' },
    },
    cramer_classes: {
      I: 'Low toxicity — Simple chemistry with efficient metabolism',
      II: 'Intermediate — No strong toxicity signals',
      III: 'High concern — No presumption of safety',
    },
    ttc_values: {
      'Class I': '1800 µg/person/day',
      'Class II': '540 µg/person/day',
      'Class III': '90 µg/person/day',
    },
    data_sources: [
      'Toxtree decision trees',
      'AMBIT REST API (when AMBIT_API_BASE is configured)',
      'Heuristic SMILES estimator (built-in fallback)',
    ],
  })
})

export default router
