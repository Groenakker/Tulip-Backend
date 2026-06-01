/**
 * EPA ECOTOX (Environmental Toxicity) service.
 *
 * Mirrors `backend/app/services/ecotox_service.py`. ECOTOX exposes a public
 * REST API at https://cfpub.epa.gov/ecotox/web_api/ for querying aquatic
 * and terrestrial toxicity studies.
 *
 * The API expects either a CAS number or chemical name and supports
 * paginated bulk export. We forward the standard query params and reshape
 * results into the consumer-friendly schema used by the React UI.
 */

import { httpGet, isCasrn } from './_httpClient.js'

const BASE_URL = 'https://cfpub.epa.gov/ecotox/web_api'

/** Search ECOTOX chemicals by name or CAS. */
export async function searchChemical(query, limit = 20) {
  try {
    const params = isCasrn(query) ? { cas: query } : { chemical: query }
    const data = await httpGet(`${BASE_URL}/chemicals.json`, {
      params: { ...params, limit },
      source: 'ecotox.search',
    })
    const chemicals = (data?.chemicals ?? data?.results ?? []).slice(0, limit).map(mapChemical)
    return { query, total_results: chemicals.length, chemicals }
  } catch (err) {
    return { query, total_results: 0, chemicals: [], error: String(err?.message ?? err) }
  }
}

/** Aquatic toxicity studies for a chemical. */
export async function getAquaticToxicity(identifier, { organism_group } = {}) {
  return queryStudies(identifier, { media: 'water', organism_group })
}

/** Terrestrial toxicity studies. */
export async function getTerrestrialToxicity(identifier, { organism_group } = {}) {
  return queryStudies(identifier, { media: 'soil,non-soil', organism_group })
}

/**
 * Species sensitivity distribution — return endpoints sorted by toxic effect
 * concentration (most sensitive first).
 */
export async function getSpeciesSensitivity(identifier, { environment = 'aquatic' } = {}) {
  const fn = environment === 'aquatic' ? getAquaticToxicity : getTerrestrialToxicity
  const result = await fn(identifier)
  const studies = (result.studies ?? []).filter((s) => s.endpoint_value != null)
  studies.sort((a, b) => Number(a.endpoint_value ?? Infinity) - Number(b.endpoint_value ?? Infinity))
  return {
    identifier,
    environment,
    total_studies: studies.length,
    species_distribution: studies,
  }
}

/**
 * Calculate Predicted No-Effect Concentration:
 *   PNEC = lowest_value / assessment_factor
 */
export async function getPnec(identifier, { environment = 'aquatic', assessment_factor = 1000 } = {}) {
  const ssd = await getSpeciesSensitivity(identifier, { environment })
  const lowest = ssd.species_distribution[0]?.endpoint_value
  const pnec = lowest != null ? Number(lowest) / Number(assessment_factor) : null
  return {
    identifier,
    environment,
    assessment_factor,
    lowest_value: lowest ?? null,
    lowest_endpoint: ssd.species_distribution[0]?.endpoint_type ?? null,
    lowest_species: ssd.species_distribution[0]?.species ?? null,
    pnec_value: pnec,
    pnec_unit: ssd.species_distribution[0]?.units ?? null,
    note:
      'PNEC = lowest measured effect / assessment factor. Default AF 1000 follows ECHA Annex I R.10.',
  }
}

/** Compare multiple chemicals by toxicity. */
export async function compareChemicals(chemicals, { environment = 'aquatic', organism_group } = {}) {
  const fn = environment === 'aquatic' ? getAquaticToxicity : getTerrestrialToxicity
  const results = await Promise.all(chemicals.map((c) => fn(c, { organism_group })))
  const ranking = results
    .map((r, idx) => {
      const lowest = (r.studies ?? [])
        .filter((s) => s.endpoint_value != null)
        .sort((a, b) => Number(a.endpoint_value) - Number(b.endpoint_value))[0]
      return {
        chemical: chemicals[idx],
        lowest_endpoint: lowest?.endpoint_type ?? null,
        lowest_value: lowest?.endpoint_value ?? null,
        lowest_units: lowest?.units ?? null,
        studies_found: (r.studies ?? []).length,
      }
    })
    .sort((a, b) => Number(a.lowest_value ?? Infinity) - Number(b.lowest_value ?? Infinity))
  return { environment, organism_group: organism_group ?? null, ranking }
}

/* -------------------------------------------------------------------------- */
/*  Internal                                                                  */
/* -------------------------------------------------------------------------- */

async function queryStudies(identifier, { media, organism_group } = {}) {
  try {
    const params = isCasrn(identifier) ? { cas: identifier } : { chemical: identifier }
    if (media) params.media = media
    if (organism_group) params.organism_group = organism_group
    const data = await httpGet(`${BASE_URL}/results.json`, {
      params,
      source: 'ecotox.results',
    })
    const studies = (data?.results ?? []).map(mapStudy)
    return { identifier, total_results: studies.length, studies }
  } catch (err) {
    return { identifier, total_results: 0, studies: [], error: String(err?.message ?? err) }
  }
}

function mapChemical(raw) {
  return {
    cas_number: raw?.cas_number ?? raw?.cas ?? null,
    chemical_name: raw?.chemical_name ?? raw?.name ?? null,
    ecotox_group: raw?.ecotox_group ?? null,
  }
}

function mapStudy(raw) {
  return {
    test_id: raw?.test_id ?? null,
    chemical: raw?.chemical_name ?? null,
    species: raw?.species_scientific_name ?? raw?.species ?? null,
    species_common: raw?.species_common_name ?? null,
    organism_group: raw?.organism_group ?? null,
    test_method: raw?.test_method ?? null,
    test_location: raw?.test_location ?? null,
    media: raw?.media_type ?? null,
    exposure_duration: raw?.exposure_duration ?? null,
    endpoint_type: raw?.endpoint ?? raw?.endpoint_type ?? null,
    endpoint_value: raw?.endpoint_value ?? raw?.conc_value ?? null,
    units: raw?.units ?? raw?.conc_units ?? null,
    effect: raw?.effect ?? null,
    reference: raw?.reference ?? null,
  }
}
