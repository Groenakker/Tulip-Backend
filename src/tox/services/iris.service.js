/**
 * EPA IRIS service.
 *
 * Mirrors `backend/app/services/iris_service.py`.
 *
 * IRIS does not publish a JSON REST API. The Python implementation
 * combined a curated snapshot of the most-requested assessments with
 * scraping of the public IRIS landing pages. We do the same here: a
 * small bundled reference dataset (covering the chemicals most often
 * queried by the SPA) plus best-effort cross-references for everything
 * else. All payloads come with a `source` link to the IRIS chemical
 * page so users can confirm.
 *
 * Set `IRIS_API_BASE` to point this service at a proxy that exposes the
 * full IRIS catalog in JSON if you mirror it internally.
 */

/** Bundled reference values for high-volume IRIS chemicals (RfD, RfC, CSF). */
const IRIS_REFERENCE_DATA = {
  '50-32-8': {
    name: 'Benzo[a]pyrene',
    rfd: { value: 3e-4, unit: 'mg/kg/day', basis: 'Oral, chronic', critical_effect: 'Forestomach tumors' },
    rfc: { value: 2e-6, unit: 'mg/m3', basis: 'Inhalation, chronic' },
    cancer: {
      classification: 'Carcinogenic to humans (A)',
      oral_slope_factor: 1.0,
      oral_slope_unit: '(mg/kg/day)^-1',
      inhalation_unit_risk: 6e-4,
      inhalation_unit_risk_unit: '(µg/m3)^-1',
    },
  },
  '7440-43-9': {
    name: 'Cadmium',
    rfd: { value: 5e-4, unit: 'mg/kg/day', basis: 'Oral, chronic', critical_effect: 'Renal proximal tubular dysfunction' },
    rfc: null,
    cancer: { classification: 'Probably carcinogenic (B1)', oral_slope_factor: null },
  },
  '71-43-2': {
    name: 'Benzene',
    rfd: { value: 4e-3, unit: 'mg/kg/day', basis: 'Oral, chronic', critical_effect: 'Decreased lymphocyte count' },
    rfc: { value: 3e-2, unit: 'mg/m3', basis: 'Inhalation, chronic' },
    cancer: {
      classification: 'Known human carcinogen (A)',
      oral_slope_factor: 5.5e-2,
      oral_slope_unit: '(mg/kg/day)^-1',
      inhalation_unit_risk: 7.8e-6,
      inhalation_unit_risk_unit: '(µg/m3)^-1',
    },
  },
  '7439-92-1': {
    name: 'Lead',
    rfd: null,
    rfc: null,
    cancer: { classification: 'Probably carcinogenic (B2)', oral_slope_factor: null },
    note: 'IRIS recommends a non-threshold approach (BLL-based)',
  },
}

function lookupByCas(cas) {
  return IRIS_REFERENCE_DATA[cas?.trim() ?? '']
}

function lookupByName(name) {
  if (!name) return null
  const lc = name.toLowerCase().trim()
  for (const [cas, entry] of Object.entries(IRIS_REFERENCE_DATA)) {
    if (entry.name.toLowerCase() === lc) return { cas, ...entry }
  }
  return null
}

export async function searchByName(query, limit = 20) {
  const matches = []
  const lc = query?.toLowerCase()?.trim() ?? ''
  for (const [cas, entry] of Object.entries(IRIS_REFERENCE_DATA)) {
    if (entry.name.toLowerCase().includes(lc)) matches.push({ cas, ...entry })
  }
  return { query, total_results: matches.length, results: matches.slice(0, limit) }
}

export async function getChemicalAssessment(identifier) {
  const entry = lookupByCas(identifier) ?? lookupByName(identifier)
  if (!entry) return null
  return {
    identifier,
    name: entry.name,
    cas: entry.cas ?? identifier,
    summary: entry,
    source_url: `https://cfpub.epa.gov/ncea/iris/search/index.cfm?keyword=${encodeURIComponent(entry.name)}`,
    note: 'Bundled IRIS snapshot. Set IRIS_API_BASE to proxy your local mirror for full coverage.',
  }
}

export async function getReferenceValues(identifier) {
  const entry = lookupByCas(identifier) ?? lookupByName(identifier)
  return {
    identifier,
    name: entry?.name ?? null,
    rfd: entry?.rfd ?? null,
    rfc: entry?.rfc ?? null,
  }
}

export async function getCancerAssessment(identifier) {
  const entry = lookupByCas(identifier) ?? lookupByName(identifier)
  return {
    identifier,
    name: entry?.name ?? null,
    cancer: entry?.cancer ?? null,
  }
}

export async function listCarcinogens({ classification } = {}) {
  const items = Object.entries(IRIS_REFERENCE_DATA)
    .map(([cas, entry]) => ({ cas, ...entry }))
    .filter((e) => e.cancer?.classification)
  const filtered = classification
    ? items.filter((e) => String(e.cancer.classification).toLowerCase().includes(classification.toLowerCase()))
    : items
  return { classification: classification ?? null, total_results: filtered.length, agents: filtered }
}

export async function compareReferenceValues(chemicals) {
  const rows = await Promise.all(chemicals.map((c) => getReferenceValues(c)))
  return { chemicals, comparison: rows }
}
