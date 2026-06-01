/**
 * Clinical trials endpoints — mirrors `app/api/v1/endpoints/clinical.py`.
 */

import { Router } from 'express'
import * as clinical from '../../services/clinicalTrials.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    if (!req.query.condition && !req.query.intervention) {
      return res.status(400).json({ detail: "Either 'condition' or 'intervention' must be provided" })
    }
    const status = req.query.status ? String(req.query.status).split(',').map((s) => s.trim()) : undefined
    const phase = req.query.phase ? String(req.query.phase).split(',').map((p) => p.trim()) : undefined
    res.json({
      query: {
        condition: req.query.condition ?? null,
        intervention: req.query.intervention ?? null,
        status: status ?? null,
        phase: phase ?? null,
      },
      ...(await clinical.searchTrials({
        condition: req.query.condition ? String(req.query.condition) : undefined,
        intervention: req.query.intervention ? String(req.query.intervention) : undefined,
        status,
        phase,
        page_size: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
      })),
    })
  }),
)

router.get(
  '/trial/:nct_id',
  asyncRoute(async (req, res) => {
    const r = await clinical.getTrialDetails(req.params.nct_id)
    if (!r) return res.status(404).json({ detail: `Trial ${req.params.nct_id} not found` })
    res.json({ ...r, url: `https://clinicaltrials.gov/study/${req.params.nct_id}` })
  }),
)

router.get(
  '/sponsor/:sponsor_name',
  asyncRoute(async (req, res) => {
    const phase = req.query.phase ? String(req.query.phase).split(',').map((s) => s.trim()) : undefined
    const status = req.query.status ? String(req.query.status).split(',').map((s) => s.trim()) : undefined
    res.json({
      sponsor: req.params.sponsor_name,
      ...(await clinical.searchBySponsor({
        sponsor_name: req.params.sponsor_name,
        condition: req.query.condition ? String(req.query.condition) : undefined,
        phase,
        status,
        page_size: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
      })),
    })
  }),
)

router.get(
  '/endpoints',
  asyncRoute(async (req, res) => {
    if (!req.query.condition && !req.query.nct_id) {
      return res.status(400).json({ detail: "Either 'condition' or 'nct_id' must be provided" })
    }
    const phase = req.query.phase ? String(req.query.phase).split(',').map((s) => s.trim()) : undefined
    res.json({
      query: { condition: req.query.condition ?? null, nct_id: req.query.nct_id ?? null, phase: phase ?? null },
      ...(await clinical.analyzeEndpoints({
        condition: req.query.condition ? String(req.query.condition) : undefined,
        nct_id: req.query.nct_id ? String(req.query.nct_id) : undefined,
        phase,
        page_size: parseIntParam(req.query.limit, 50, { min: 1, max: 200 }),
      })),
    })
  }),
)

router.get(
  '/eligibility',
  asyncRoute(async (req, res) => {
    res.json({
      query: {
        condition: req.query.condition ?? null,
        min_age: req.query.min_age ?? null,
        max_age: req.query.max_age ?? null,
        sex: req.query.sex ?? null,
        keywords: req.query.keywords ?? null,
      },
      ...(await clinical.searchByEligibility({
        condition: req.query.condition ? String(req.query.condition) : undefined,
        min_age: req.query.min_age ? String(req.query.min_age) : undefined,
        max_age: req.query.max_age ? String(req.query.max_age) : undefined,
        sex: req.query.sex ? String(req.query.sex) : undefined,
        eligibility_keywords: req.query.keywords ? String(req.query.keywords) : undefined,
        page_size: parseIntParam(req.query.limit, 20, { min: 1, max: 100 }),
      })),
    })
  }),
)

export default router
