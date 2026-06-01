/**
 * Reference-value aggregation for the TI calculator.
 *
 * Mirrors `backend/app/api/v1/endpoints/ti_reference_aggregation.py`.
 *
 * Pulls reference values from IRIS, EFSA, ECHA REACH, and ChEMBL bioactivity
 * for a single chemical, prioritises them (regulatory > IUCLID > derived),
 * and returns the recommended POD for downstream TI calculation.
 */

import * as identifier from './identifier.service.js'
import * as iris from './iris.service.js'
import * as efsa from './efsa.service.js'
import * as echa from './echa.service.js'

/**
 * Build a reference-value aggregation payload for `/ti-calculator/aggregate-reference-values`.
 *
 * @param {string} query
 */
export async function buildReferenceAggregationResponse(query) {
  const resolved = await identifier.resolve(query, { resolve_all: true })
  const dict = resolved.to_dict()
  const cas = dict.casrn
  const name = dict.preferred_name ?? query

  const [irisRefs, efsaRefs, echaRefs] = await Promise.all([
    iris.getReferenceValues(cas ?? name).catch(() => null),
    efsa.getReferenceValues(cas ?? name).catch(() => null),
    echa.getToxicityEndpoints({ cas_number: cas, substance_name: name }).catch(() => []),
  ])

  const referenceValues = []

  // IRIS RfD/RfC
  if (irisRefs?.rfd) {
    referenceValues.push({
      source: 'EPA IRIS',
      endpoint_type: 'RfD',
      value: irisRefs.rfd.value,
      unit: irisRefs.rfd.unit,
      basis: irisRefs.rfd.basis,
      critical_effect: irisRefs.rfd.critical_effect,
      priority: 1,
    })
  }
  if (irisRefs?.rfc) {
    referenceValues.push({
      source: 'EPA IRIS',
      endpoint_type: 'RfC',
      value: irisRefs.rfc.value,
      unit: irisRefs.rfc.unit,
      basis: irisRefs.rfc.basis,
      priority: 1,
    })
  }

  // EFSA ADI/ARfD
  for (const rv of efsaRefs?.reference_values ?? []) {
    referenceValues.push({
      source: 'EFSA',
      endpoint_type: rv.type,
      value: rv.value,
      unit: rv.unit,
      basis: rv.basis,
      priority: rv.type === 'ADI' ? 1 : 2,
    })
  }

  // ECHA REACH endpoints
  for (const ep of echaRefs ?? []) {
    referenceValues.push({
      source: 'ECHA REACH',
      endpoint_type: ep.endpoint_type,
      value: ep.value,
      unit: ep.unit,
      species: ep.species,
      route: ep.route,
      duration: ep.duration,
      critical_effect: ep.effect,
      basis: ep.reference,
      priority: ep.reliability?.startsWith('1') ? 2 : 3,
    })
  }

  // Pick the highest-priority reference value as the "selected" POD.
  referenceValues.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
  const selected = referenceValues.find((rv) => rv.value != null) ?? null

  return {
    query,
    resolved_identifiers: dict,
    reference_values: referenceValues,
    selected_reference_value: selected,
    selection_rationale: selected
      ? `Selected ${selected.source} ${selected.endpoint_type} as it has the highest regulatory priority among available reference values.`
      : 'No reference value available — consider read-across or TTC approach.',
    data_sources_queried: ['EPA IRIS', 'EFSA OpenFoodTox', 'ECHA REACH'],
  }
}
