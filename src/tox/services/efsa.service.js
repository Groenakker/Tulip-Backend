/**
 * EFSA OpenFoodTox service.
 *
 * Mirrors `backend/app/services/efsa_service.py`. EFSA publishes its
 * OpenFoodTox data via the EFSA Knowledge Junction; there is no
 * documented REST API for live querying. The Python implementation
 * shipped a bundled snapshot of reference values (ADI, ARfD, TDI) for
 * the most commonly queried substances. We mirror that behaviour.
 *
 * Place a richer dataset at `data/efsa_snapshot.json` and load it from
 * here if you mirror the full catalog.
 */

/** Bundled EFSA reference values keyed by lowercase substance name. */
const EFSA_DATA = {
  'aspartame': {
    name: 'Aspartame',
    cas: '22839-47-0',
    e_number: 'E951',
    reference_values: [
      { type: 'ADI', value: 40, unit: 'mg/kg bw/day', basis: 'EFSA 2013 re-evaluation' },
    ],
    genotoxicity: { conclusion: 'No concern', basis: 'Negative in vivo' },
  },
  'glyphosate': {
    name: 'Glyphosate',
    cas: '1071-83-6',
    reference_values: [
      { type: 'ADI', value: 0.5, unit: 'mg/kg bw/day', basis: 'EFSA 2017' },
      { type: 'ARfD', value: 0.5, unit: 'mg/kg bw/day', basis: 'EFSA 2017' },
    ],
    genotoxicity: { conclusion: 'No genotoxic concern', basis: 'Weight-of-evidence' },
  },
  'aflatoxin b1': {
    name: 'Aflatoxin B1',
    cas: '1162-65-8',
    reference_values: [{ type: 'BMDL10', value: 0.4, unit: 'µg/kg bw/day', basis: 'Liver cancer' }],
    genotoxicity: { conclusion: 'Genotoxic carcinogen', basis: 'In vivo positive' },
  },
  'caffeine': {
    name: 'Caffeine',
    cas: '58-08-2',
    reference_values: [
      { type: 'TDI (adult)', value: 5.7, unit: 'mg/kg bw/day', basis: 'Cardiovascular' },
      { type: 'TDI (pregnant)', value: 200, unit: 'mg/day', basis: 'Pregnancy outcomes' },
    ],
    genotoxicity: null,
  },
}

const E_NUMBER_INDEX = (() => {
  const map = {}
  for (const [, entry] of Object.entries(EFSA_DATA)) {
    if (entry.e_number) map[entry.e_number] = entry
  }
  return map
})()

const CAS_INDEX = (() => {
  const map = {}
  for (const [, entry] of Object.entries(EFSA_DATA)) {
    if (entry.cas) map[entry.cas] = entry
  }
  return map
})()

function lookup(id) {
  const key = String(id ?? '').toLowerCase().trim()
  return EFSA_DATA[key] ?? CAS_INDEX[id] ?? E_NUMBER_INDEX[id] ?? null
}

export async function searchSubstance(query, limit = 20) {
  const lc = query.toLowerCase().trim()
  const items = Object.values(EFSA_DATA).filter(
    (e) => e.name.toLowerCase().includes(lc) || e.cas === query || e.e_number === query,
  )
  return { query, total_results: items.length, substances: items.slice(0, limit) }
}

export async function getReferenceValues(substanceId) {
  const entry = lookup(substanceId)
  return { substance_id: substanceId, name: entry?.name ?? null, reference_values: entry?.reference_values ?? [] }
}

export async function getGenotoxicityAssessment(substanceId) {
  const entry = lookup(substanceId)
  return { substance_id: substanceId, name: entry?.name ?? null, genotoxicity: entry?.genotoxicity ?? null }
}

export async function getEndpointSummary(substanceId) {
  const entry = lookup(substanceId)
  if (!entry) return { substance_id: substanceId, endpoints: [] }
  return {
    substance_id: substanceId,
    name: entry.name,
    endpoints: [
      ...(entry.reference_values ?? []).map((rv) => ({ category: 'reference_value', ...rv })),
      ...(entry.genotoxicity ? [{ category: 'genotoxicity', ...entry.genotoxicity }] : []),
    ],
  }
}

export async function searchByCas(casrn) {
  const entry = CAS_INDEX[casrn]
  return entry ? { cas: casrn, ...entry } : null
}

export async function getPesticideResidues(substanceName) {
  // EFSA MRLs are published per crop; without a live API we return a
  // hand-curated stub that the UI can render.
  return {
    substance: substanceName,
    mrls: [
      {
        crop: 'Apples',
        mrl_value: 0.1,
        mrl_unit: 'mg/kg',
        regulation: 'Regulation (EC) No 396/2005 (illustrative)',
      },
    ],
    note: 'EFSA MRL snapshot — wire up the EU Pesticide Database for live values.',
  }
}

export async function getFoodAdditiveData(eNumber) {
  const entry = E_NUMBER_INDEX[eNumber]
  if (!entry) return { e_number: eNumber, found: false }
  return { e_number: eNumber, ...entry }
}

export async function getContaminantData(contaminantName) {
  const entry = lookup(contaminantName)
  if (!entry) return { contaminant: contaminantName, found: false }
  return { contaminant: contaminantName, ...entry }
}
