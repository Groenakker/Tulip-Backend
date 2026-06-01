/**
 * REACH database endpoints — mirrors `app/api/v1/endpoints/reach.py`.
 */

import { Router } from 'express'
import * as reach from '../../services/reachDatabase.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get('/status', (_req, res) => {
  const stats = reach.getDatabaseStats()
  res.json({
    status: stats.initialized ? 'initialized' : 'not_initialized',
    statistics: stats,
    setup_instructions: stats.initialized
      ? null
      : 'Provide an indexed REACH/IUCLID dump and set REACH_DATABASE_READY=true.',
  })
})

router.get(
  '/query/cas/:cas_number',
  asyncRoute(async (req, res) => {
    const stats = reach.getDatabaseStats()
    if (!stats.initialized) {
      return res.status(503).json({ detail: 'REACH database not initialized.', status: 'not_initialized' })
    }
    const studies = await reach.queryByCas({
      cas_number: req.params.cas_number,
      study_types: req.query.study_types ? String(req.query.study_types).split(',') : undefined,
      endpoint_types: req.query.endpoint_types ? String(req.query.endpoint_types).split(',') : undefined,
      limit: parseIntParam(req.query.limit, 50, { min: 1, max: 500 }),
    })
    res.json({ cas_number: req.params.cas_number, total_results: studies.length, studies })
  }),
)

router.get(
  '/query/name/:substance_name',
  asyncRoute(async (req, res) => {
    const stats = reach.getDatabaseStats()
    if (!stats.initialized) {
      return res.status(503).json({ detail: 'REACH database not initialized.', status: 'not_initialized' })
    }
    const studies = await reach.queryByName({
      substance_name: req.params.substance_name,
      study_types: req.query.study_types ? String(req.query.study_types).split(',') : undefined,
      endpoint_types: req.query.endpoint_types ? String(req.query.endpoint_types).split(',') : undefined,
      limit: parseIntParam(req.query.limit, 50, { min: 1, max: 500 }),
    })
    res.json({ substance_name: req.params.substance_name, total_results: studies.length, studies })
  }),
)

router.get(
  '/pod',
  asyncRoute(async (req, res) => {
    if (!req.query.cas_number && !req.query.substance_name) {
      return res.status(400).json({ detail: 'Either cas_number or substance_name is required' })
    }
    const stats = reach.getDatabaseStats()
    if (!stats.initialized) {
      return res.status(503).json({ detail: 'REACH database not initialized.', status: 'not_initialized' })
    }
    res.json(
      await reach.getPodValues({
        cas_number: req.query.cas_number ? String(req.query.cas_number) : undefined,
        substance_name: req.query.substance_name ? String(req.query.substance_name) : undefined,
      }),
    )
  }),
)

router.get('/study-types', (_req, res) => {
  res.json({
    study_types: [
      { id: 'acute_oral', name: 'Acute Toxicity - Oral' },
      { id: 'acute_dermal', name: 'Acute Toxicity - Dermal' },
      { id: 'acute_inhalation', name: 'Acute Toxicity - Inhalation' },
      { id: 'repeated_dose_oral', name: 'Repeated Dose Toxicity - Oral' },
      { id: 'repeated_dose_dermal', name: 'Repeated Dose Toxicity - Dermal' },
      { id: 'repeated_dose_inhalation', name: 'Repeated Dose Toxicity - Inhalation' },
      { id: 'developmental', name: 'Developmental Toxicity' },
      { id: 'reproductive', name: 'Reproductive Toxicity' },
      { id: 'carcinogenicity', name: 'Carcinogenicity' },
      { id: 'genetic_toxicity_vivo', name: 'Genetic Toxicity - In Vivo' },
      { id: 'genetic_toxicity_vitro', name: 'Genetic Toxicity - In Vitro' },
      { id: 'neurotoxicity', name: 'Neurotoxicity' },
      { id: 'immunotoxicity', name: 'Immunotoxicity' },
      { id: 'skin_sensitisation', name: 'Skin Sensitisation' },
      { id: 'skin_irritation', name: 'Skin Irritation/Corrosion' },
      { id: 'eye_irritation', name: 'Eye Irritation' },
    ],
    endpoint_types: [
      { id: 'NOAEL', name: 'No Observed Adverse Effect Level' },
      { id: 'LOAEL', name: 'Lowest Observed Adverse Effect Level' },
      { id: 'NOEL', name: 'No Observed Effect Level' },
      { id: 'LOEL', name: 'Lowest Observed Effect Level' },
      { id: 'NOAEC', name: 'No Observed Adverse Effect Concentration' },
      { id: 'LOAEC', name: 'Lowest Observed Adverse Effect Concentration' },
      { id: 'LD50', name: 'Lethal Dose 50%' },
      { id: 'LC50', name: 'Lethal Concentration 50%' },
      { id: 'BMD', name: 'Benchmark Dose' },
      { id: 'BMDL', name: 'Benchmark Dose Lower Confidence Limit' },
    ],
  })
})

export default router
