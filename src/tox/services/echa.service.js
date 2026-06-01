/**
 * ECHA (European Chemicals Agency) service.
 *
 * Mirrors `backend/app/services/echa_service.py` + `echa_models.py`. Two
 * data flows are supported:
 *
 *   1. **ECHA CHEM live API** (https://chem.echa.europa.eu) — used when
 *      `ECHA_CHEM_API_BASE` is configured.
 *   2. **Bundled reference dataset** — a small curated snapshot from
 *      `app/services/echa_reference_data.py` so the SPA stays functional
 *      out of the box.
 *
 * Toxicity endpoints are normalised into the `ToxicityEndpoint` shape the
 * Python service used so the React components don't have to change.
 */

import { httpGet } from './_httpClient.js'

/** Small subset of the Python reference dataset for the most-queried substances. */
const REFERENCE_DATA = {
  '50-00-0': {
    name: 'Formaldehyde',
    ec: '200-001-8',
    endpoints: [
      {
        study_type: 'Repeated dose toxicity (inhalation)',
        endpoint_type: 'NOAEC',
        value: 2.0,
        unit: 'mg/m3',
        species: 'rat',
        route: 'inhalation',
        duration: '90 days',
        effect: 'Squamous cell hyperplasia (nasal)',
        reliability: '1 (reliable without restriction)',
        reference: 'EPA IRIS / Kerns 1983',
      },
    ],
  },
  '57-11-4': {
    name: 'Stearic acid',
    ec: '200-313-4',
    endpoints: [
      {
        study_type: 'Acute oral toxicity',
        endpoint_type: 'LD50',
        value: 5000,
        unit: 'mg/kg bw',
        species: 'rat',
        route: 'oral',
        duration: 'single dose',
        effect: 'No mortality at limit dose',
        reliability: '2 (reliable with restrictions)',
        reference: 'REACH registration dossier (illustrative)',
      },
    ],
  },
  '71-43-2': {
    name: 'Benzene',
    ec: '200-753-7',
    endpoints: [
      {
        study_type: 'Carcinogenicity (inhalation)',
        endpoint_type: 'LOAEC',
        value: 10,
        unit: 'mg/m3',
        species: 'human',
        route: 'inhalation',
        duration: 'chronic',
        effect: 'Leukaemia',
        reliability: '1',
        reference: 'IARC Monograph 100F',
      },
    ],
  },
}

function chemBase() {
  return process.env.ECHA_CHEM_API_BASE?.replace(/\/+$/, '') || null
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Search substances by name/CAS/EC.
 *
 * @param {string} query
 * @param {'name'|'cas'|'ec'} [search_type='name']
 */
export async function searchSubstance(query, search_type = 'name') {
  const base = chemBase()
  if (base) {
    try {
      const data = await httpGet(`${base}/substances/search`, {
        params: { q: query, type: search_type },
        source: 'echa.search.live',
      })
      return Array.isArray(data) ? data : data?.substances ?? []
    } catch {
      /* fall through to snapshot */
    }
  }
  return searchSnapshot(query, search_type)
}

/**
 * Get toxicity endpoints (NOAEL/LOAEL/LD50/etc.) for a substance. At least
 * one of `cas_number`, `ec_number`, `substance_name` must be provided.
 *
 * @returns {Promise<Array<object>>}
 */
export async function getToxicityEndpoints({ cas_number, ec_number, substance_name } = {}) {
  const base = chemBase()
  if (base) {
    try {
      const data = await httpGet(`${base}/endpoints`, {
        params: { cas: cas_number, ec: ec_number, name: substance_name },
        source: 'echa.endpoints.live',
      })
      return (Array.isArray(data) ? data : data?.endpoints ?? []).map(normaliseEndpoint)
    } catch {
      /* fall through */
    }
  }
  // Snapshot fallback
  const key = cas_number ?? findCasByEc(ec_number) ?? findCasByName(substance_name)
  const entry = key ? REFERENCE_DATA[key] : null
  return (entry?.endpoints ?? []).map(normaliseEndpoint)
}

/* -------------------------------------------------------------------------- */

function searchSnapshot(query, type) {
  const lc = query.toLowerCase().trim()
  const results = []
  for (const [cas, entry] of Object.entries(REFERENCE_DATA)) {
    if (
      (type === 'cas' && cas === query) ||
      (type === 'ec' && entry.ec === query) ||
      (type === 'name' && entry.name.toLowerCase().includes(lc))
    ) {
      results.push({ cas, ec_number: entry.ec, name: entry.name })
    }
  }
  return results
}

function findCasByEc(ec) {
  if (!ec) return null
  for (const [cas, entry] of Object.entries(REFERENCE_DATA)) {
    if (entry.ec === ec) return cas
  }
  return null
}

function findCasByName(name) {
  if (!name) return null
  const lc = name.toLowerCase().trim()
  for (const [cas, entry] of Object.entries(REFERENCE_DATA)) {
    if (entry.name.toLowerCase() === lc) return cas
  }
  return null
}

function normaliseEndpoint(e) {
  return {
    study_type: e.study_type ?? null,
    endpoint_type: e.endpoint_type ?? null,
    value: e.value ?? null,
    unit: e.unit ?? null,
    species: e.species ?? null,
    route: e.route ?? null,
    duration: e.duration ?? null,
    effect: e.effect ?? null,
    reliability: e.reliability ?? null,
    reference: e.reference ?? null,
    source: e.source ?? 'ECHA',
    study_url: e.study_url ?? null,
    dossier_url: e.dossier_url ?? null,
  }
}
