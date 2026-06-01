/**
 * TI Calculator endpoints — mirrors `app/api/v1/endpoints/ti_calculator.py`.
 */

import { Router } from 'express'
import * as tiCalc from '../../services/tiCalculator.service.js'
import * as identifierSvc from '../../services/identifier.service.js'
import { buildReferenceAggregationResponse } from '../../services/tiReferenceAggregation.service.js'
import { asyncRoute, parseFloatParam } from '../../utils/routeHelpers.util.js'

const router = Router()

function markScreeningOnly(payload) {
  return {
    ...payload,
    advisory_only: true,
    authoritative_workflow: 'tra_project_assignments',
    authoritative_workflow_hint:
      'Use TRA project compound/family assignments and worksheet approvals for submission-grade decisions.',
  }
}

router.post(
  '/calculate',
  asyncRoute(async (req, res) => {
    const result = tiCalc.calculateTi(req.body ?? {})
    res.json(markScreeningOnly(result.to_dict()))
  }),
)

router.post(
  '/calculate-mos',
  asyncRoute(async (req, res) => {
    const ti = new tiCalc.TICalculation({
      ti_value: req.body?.ti_value,
      ti_unit: req.body?.ti_unit ?? 'µg/day',
      ti_ug_day: null,
    })
    const result = tiCalc.calculateMos({
      ti_calculation: ti,
      exposure_estimate: req.body?.exposure_estimate,
      exposure_unit: req.body?.exposure_unit ?? 'µg/day',
      body_weight_kg: req.body?.body_weight_kg ?? 60,
    })
    res.json(
      markScreeningOnly({
        ti_value: result.ti_value,
        ti_unit: result.ti_unit,
        exposure_estimate: result.exposure_estimate,
        exposure_unit: result.exposure_unit,
        margin_of_safety: result.margin_of_safety,
        mos_interpretation: result.mos_interpretation,
      }),
    )
  }),
)

router.get(
  '/aggregate-reference-values',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    res.json(markScreeningOnly(await buildReferenceAggregationResponse(q)))
  }),
)

router.get(
  '/full-assessment',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    const exposure = parseFloatParam(req.query.exposure_estimate, undefined)
    const bw = parseFloatParam(req.query.body_weight_kg, 60, { min: 1, max: 200 })

    const resolved = await identifierSvc.resolve(q, { resolve_all: true })
    const ids = resolved.to_dict()
    const aggregation = await buildReferenceAggregationResponse(q)
    const selected = aggregation.selected_reference_value

    if (!selected) {
      return res.json(
        markScreeningOnly({
          query: q,
          resolved_name: ids.preferred_name,
          resolved_cas: ids.casrn,
          success: false,
          error: 'No reference values found for TI calculation',
          data_sources_queried: aggregation.data_sources_queried,
          recommendation: 'Consider searching for structurally similar compounds or using TTC approach',
        }),
      )
    }

    let result = tiCalc.calculateTi({
      pod_value: selected.value,
      pod_unit: selected.unit,
      pod_type: selected.endpoint_type,
      pod_source: selected.source,
      compound_name: ids.preferred_name ?? q,
      casrn: ids.casrn,
      species: selected.species,
      route: selected.route,
      duration: selected.duration,
      critical_effect: selected.critical_effect,
      body_weight_kg: bw,
      output_unit: 'auto',
    })

    if (exposure != null) {
      result = tiCalc.calculateMos({
        ti_calculation: result,
        exposure_estimate: exposure,
        exposure_unit: 'µg/day',
        body_weight_kg: bw,
      })
    }

    const dict = result.to_dict()
    dict.success = true
    dict.resolved_identifiers = ids
    dict.data_sources_queried = aggregation.data_sources_queried
    dict.aggregation_rationale = aggregation.selection_rationale
    res.json(markScreeningOnly(dict))
  }),
)

export default router
