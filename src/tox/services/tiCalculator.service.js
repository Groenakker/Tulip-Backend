/**
 * Tolerable Intake (TI) calculator — ISO 10993-17.
 *
 * Mirrors `backend/app/services/ti_calculator.py`. Pure-JS implementation
 * (no external API calls) so it runs offline.
 *
 * Formula:        TI = POD / (UF1 × UF2 × UF3 × UF4 × UF5)
 * Margin of safety:  MoS = TI / Exposure
 *
 * The uncertainty factors follow ISO 10993-17:2002 defaults with rationale
 * strings that the React UI surfaces alongside each factor.
 */

/** Default uncertainty factors and the rationale strings. */
const UF_DEFAULTS = {
  UF1_interspecies: { value: 10, label: 'Interspecies extrapolation (animal → human)' },
  UF2_intraspecies: { value: 10, label: 'Intraspecies variability (sensitive subpopulations)' },
  UF3_subchronic_to_chronic: { value: 1, label: 'Subchronic to chronic extrapolation' },
  UF4_loael_to_noael: { value: 1, label: 'LOAEL to NOAEL extrapolation' },
  UF5_data_quality: { value: 1, label: 'Incomplete or poor-quality database' },
}

/** Map POD units to mg/kg/day. */
const POD_UNIT_TO_MG_KG_DAY = {
  'mg/kg/day': 1,
  'mg/kg-day': 1,
  'mg/kg bw/day': 1,
  'µg/kg/day': 1e-3,
  'ug/kg/day': 1e-3,
  'mg/m3': null, // requires breathing-rate / mw conversion
  'µg/m3': null,
  'ppm': null,
}

/**
 * Calculate a Tolerable Intake from a POD value.
 *
 * @param {object} req - see `TICalculationRequest` in the Python service.
 */
export function calculateTi(req) {
  const factors = computeFactors(req)
  const totalUF = Object.values(factors).reduce((acc, f) => acc * f.value, 1)

  const podMgKgDay = normaliseToMgKgDay(req.pod_value, req.pod_unit)
  const tiMgKgDay = podMgKgDay != null ? podMgKgDay / totalUF : null

  const bw = req.body_weight_kg ?? 60
  const tiUgDay = tiMgKgDay != null ? tiMgKgDay * bw * 1000 : null
  const tiMgDay = tiMgKgDay != null ? tiMgKgDay * bw : null

  const outputUnit = (req.output_unit ?? 'auto').toLowerCase()
  let tiOut = null
  let tiUnit = 'µg/day'
  if (outputUnit === 'mg/kg/day') {
    tiOut = tiMgKgDay
    tiUnit = 'mg/kg/day'
  } else if (outputUnit === 'mg/day') {
    tiOut = tiMgDay
    tiUnit = 'mg/day'
  } else if (outputUnit === 'µg/kg/day' || outputUnit === 'ug/kg/day') {
    tiOut = tiMgKgDay != null ? tiMgKgDay * 1000 : null
    tiUnit = 'µg/kg/day'
  } else {
    tiOut = tiUgDay
    tiUnit = 'µg/day'
  }

  return new TICalculation({
    compound_name: req.compound_name,
    casrn: req.casrn ?? null,
    pod_value: req.pod_value,
    pod_unit: req.pod_unit,
    pod_type: req.pod_type,
    pod_source: req.pod_source,
    species: req.species ?? null,
    route: req.route ?? null,
    duration: req.duration ?? null,
    critical_effect: req.critical_effect ?? null,
    uncertainty_factors: factors,
    total_uf: totalUF,
    ti_value: tiOut,
    ti_unit: tiUnit,
    ti_mg_kg_day: tiMgKgDay,
    ti_ug_day: tiUgDay,
    body_weight_kg: bw,
    confidence: confidence(req, factors),
    data_gaps: dataGaps(req, factors),
    rationale: rationale(req, factors),
  })
}

/**
 * Calculate margin of safety given an existing TI calculation and an
 * exposure estimate.
 *
 * @param {{ ti_calculation: TICalculation, exposure_estimate: number, exposure_unit: string, body_weight_kg?: number }} args
 */
export function calculateMos({ ti_calculation, exposure_estimate, exposure_unit = 'µg/day', body_weight_kg = 60 }) {
  const tiUgDay = ti_calculation.ti_ug_day ?? convertToUgDay(ti_calculation.ti_value, ti_calculation.ti_unit, body_weight_kg)
  const exposureUgDay = convertToUgDay(exposure_estimate, exposure_unit, body_weight_kg)
  const mos = exposureUgDay && tiUgDay ? tiUgDay / exposureUgDay : null
  let interpretation = 'unknown'
  if (mos != null) {
    if (mos >= 100) interpretation = 'very_low_risk'
    else if (mos >= 10) interpretation = 'low_risk'
    else if (mos >= 1) interpretation = 'acceptable'
    else interpretation = 'elevated_risk'
  }
  return Object.assign(ti_calculation, {
    exposure_estimate,
    exposure_unit,
    margin_of_safety: mos,
    mos_interpretation: interpretation,
  })
}

/* -------------------------------------------------------------------------- */
/*  TICalculation class                                                       */
/* -------------------------------------------------------------------------- */

export class TICalculation {
  constructor(fields) {
    Object.assign(this, fields)
    this.reference_values_considered = fields.reference_values_considered ?? []
  }
  to_dict() {
    const { reference_values_considered, ...rest } = this
    return {
      ...rest,
      reference_values_considered: reference_values_considered.map((rv) =>
        rv && typeof rv.to_dict === 'function' ? rv.to_dict() : rv,
      ),
    }
  }
}

/** Used by `/aggregate-reference-values` — see `tiReferenceAggregation.js`. */
export class ReferenceValue {
  constructor(fields) {
    Object.assign(this, fields)
  }
  to_dict() {
    return { ...this }
  }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function computeFactors(req) {
  const out = JSON.parse(JSON.stringify(UF_DEFAULTS))

  // UF3: subchronic -> chronic
  if (/subchronic|sub-chronic|90.?day|13.?week/i.test(req.duration ?? '')) {
    out.UF3_subchronic_to_chronic.value = 10
    out.UF3_subchronic_to_chronic.label += ' (subchronic study scaled to chronic exposure)'
  }
  // UF4: LOAEL -> NOAEL
  if (/loael|loec/i.test(req.pod_type ?? '')) {
    out.UF4_loael_to_noael.value = 10
    out.UF4_loael_to_noael.label += ' (LOAEL provided; no NOAEL available)'
  }
  // UF5: data quality
  if (/limited|poor|incomplete/i.test(req.pod_source ?? '')) {
    out.UF5_data_quality.value = 5
    out.UF5_data_quality.label += ' (limited dataset)'
  }
  // Allow caller to override any UF
  if (req.custom_ufs) {
    for (const [k, v] of Object.entries(req.custom_ufs)) {
      if (out[k]) out[k].value = Number(v) || out[k].value
      else out[k] = { value: Number(v) || 1, label: `Custom factor ${k}` }
    }
  }
  return out
}

function normaliseToMgKgDay(value, unit) {
  if (value == null) return null
  const factor = POD_UNIT_TO_MG_KG_DAY[unit?.toLowerCase?.() ?? '']
  if (factor == null) return null
  return Number(value) * factor
}

function convertToUgDay(value, unit, bw = 60) {
  if (value == null) return null
  const lc = String(unit).toLowerCase()
  if (lc === 'µg/day' || lc === 'ug/day') return Number(value)
  if (lc === 'mg/day') return Number(value) * 1000
  if (lc === 'mg/kg/day' || lc === 'mg/kg-day') return Number(value) * bw * 1000
  if (lc === 'µg/kg/day' || lc === 'ug/kg/day') return Number(value) * bw
  return null
}

function confidence(req, factors) {
  const totalUF = Object.values(factors).reduce((a, f) => a * f.value, 1)
  if (totalUF <= 100 && /noael/i.test(req.pod_type ?? '')) return 'high'
  if (totalUF <= 1000) return 'medium'
  return 'low'
}

function dataGaps(req, factors) {
  const gaps = []
  if (factors.UF4_loael_to_noael.value > 1) gaps.push('NOAEL not available — LOAEL used with safety factor')
  if (factors.UF3_subchronic_to_chronic.value > 1) gaps.push('Chronic study not available — subchronic extrapolated')
  if (factors.UF5_data_quality.value > 1) gaps.push('Database considered limited / poor quality')
  if (!req.species) gaps.push('Test species not provided')
  if (!req.route) gaps.push('Exposure route not provided')
  return gaps
}

function rationale(req, factors) {
  return Object.entries(factors).map(([k, f]) => ({ factor: k, value: f.value, justification: f.label }))
}
