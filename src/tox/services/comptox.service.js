/**
 * EPA CompTox Chemicals Dashboard service.
 *
 * Mirrors `backend/app/services/comptox_service.py`. Uses the EPA CCD REST
 * API (no key required for public endpoints).
 *
 * Docs: https://api-ccte.epa.gov/docs/
 */

import { httpGet } from './_httpClient.js'

const BASE_URL = 'https://api-ccte.epa.gov/chemical'

/** Search EPA CompTox by name; returns substance summaries with DTXSIDs. */
export async function searchByName(query, limit = 20) {
  try {
    const data = await httpGet(`${BASE_URL}/search/equal/${encodeURIComponent(query)}`, {
      source: 'comptox.search.equal',
    })
    const items = Array.isArray(data) ? data : data?.results ?? []
    const substances = items.slice(0, limit).map(mapSubstance)
    return { query, total_results: substances.length, substances }
  } catch (err) {
    return { query, total_results: 0, substances: [], error: String(err?.message ?? err) }
  }
}

/** Structure-based search (SMILES). */
export async function searchByStructure(smiles, search_type = 'exact') {
  try {
    const endpoint = search_type === 'similarity' ? 'msready/equal' : 'search/equal'
    const data = await httpGet(`${BASE_URL}/${endpoint}/${encodeURIComponent(smiles)}`, {
      source: `comptox.structure.${search_type}`,
    })
    const items = Array.isArray(data) ? data : data?.results ?? []
    return {
      query: smiles,
      search_type,
      total_results: items.length,
      substances: items.map(mapSubstance),
    }
  } catch (err) {
    return {
      query: smiles,
      search_type,
      total_results: 0,
      substances: [],
      error: String(err?.message ?? err),
    }
  }
}

/** Look up a substance by CAS Registry Number. */
export async function searchByCasrn(casrn) {
  try {
    const data = await httpGet(`${BASE_URL}/detail/search/by-casrn/${encodeURIComponent(casrn)}`, {
      source: 'comptox.casrn',
    })
    if (!data || (Array.isArray(data) && data.length === 0)) return null
    return mapDetail(Array.isArray(data) ? data[0] : data)
  } catch {
    return null
  }
}

/** Full chemical detail by DSSTox ID (e.g. DTXSID7020182). */
export async function getChemicalDetails(dtxsid) {
  try {
    const data = await httpGet(`${BASE_URL}/detail/search/by-dtxsid/${dtxsid}`, {
      source: 'comptox.detail',
    })
    if (!data) return null
    return mapDetail(Array.isArray(data) ? data[0] : data)
  } catch {
    return null
  }
}

/** ToxCast / Tox21 bioassay results. */
export async function getToxcastData(dtxsid) {
  try {
    const data = await httpGet(`${BASE_URL}/bioactivity/search/by-dtxsid/${dtxsid}`, {
      source: 'comptox.toxcast',
    })
    const assays = Array.isArray(data) ? data : []
    return {
      dtxsid,
      total_assays: assays.length,
      hit_count: assays.filter((a) => a?.hitc === 1 || a?.hitCall === 1).length,
      assays,
    }
  } catch (err) {
    return { dtxsid, total_assays: 0, hit_count: 0, assays: [], error: String(err?.message ?? err) }
  }
}

/** Predicted human/eco exposure from ExpoCast. */
export async function getExposurePredictions(dtxsid) {
  try {
    const data = await httpGet(`${BASE_URL}/exposure/search/by-dtxsid/${dtxsid}`, {
      source: 'comptox.exposure',
    })
    return { dtxsid, predictions: data ?? [] }
  } catch (err) {
    return { dtxsid, predictions: [], error: String(err?.message ?? err) }
  }
}

/** Hazard data (toxicology endpoint summary, study counts). */
export async function getHazardData(dtxsid) {
  try {
    const data = await httpGet(`${BASE_URL}/hazard/search/by-dtxsid/${dtxsid}`, {
      source: 'comptox.hazard',
    })
    return { dtxsid, hazards: data ?? [] }
  } catch (err) {
    return { dtxsid, hazards: [], error: String(err?.message ?? err) }
  }
}

/** Physicochemical properties (experimental + predicted). */
export async function getPhysicochemicalProperties(dtxsid) {
  try {
    const data = await httpGet(`${BASE_URL}/property/search/by-dtxsid/${dtxsid}`, {
      source: 'comptox.properties',
    })
    return { dtxsid, properties: data ?? [] }
  } catch (err) {
    return { dtxsid, properties: [], error: String(err?.message ?? err) }
  }
}

/** Regulatory & inventory lists the chemical appears on. */
export async function getChemicalLists(dtxsid) {
  try {
    const data = await httpGet(`${BASE_URL}/list/search/by-dtxsid/${dtxsid}`, {
      source: 'comptox.lists',
    })
    return { dtxsid, lists: data ?? [] }
  } catch (err) {
    return { dtxsid, lists: [], error: String(err?.message ?? err) }
  }
}

/** Structurally related chemicals (salts, metabolites). */
export async function getRelatedChemicals(dtxsid) {
  try {
    const data = await httpGet(`${BASE_URL}/related/search/by-dtxsid/${dtxsid}`, {
      source: 'comptox.related',
    })
    return { dtxsid, related: data ?? [] }
  } catch (err) {
    return { dtxsid, related: [], error: String(err?.message ?? err) }
  }
}

/* -------------------------------------------------------------------------- */

function mapSubstance(raw) {
  return {
    dtxsid: raw?.dtxsid ?? raw?.dsstoxSubstanceId ?? null,
    cas_number: raw?.casrn ?? null,
    preferred_name: raw?.preferredName ?? raw?.name ?? null,
    molecular_formula: raw?.molFormula ?? null,
    molecular_weight: raw?.averageMass ?? null,
    smiles: raw?.smiles ?? null,
    inchi_key: raw?.inchiKey ?? null,
  }
}

function mapDetail(raw) {
  return {
    ...mapSubstance(raw),
    iupac_name: raw?.iupacName ?? null,
    monoisotopic_mass: raw?.monoisotopicMass ?? null,
    image_url: raw?.dtxsid ? `https://comptox.epa.gov/dashboard/chemical/details/${raw.dtxsid}` : null,
    sources: raw?.dataSources ?? [],
  }
}
