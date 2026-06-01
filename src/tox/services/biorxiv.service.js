/**
 * bioRxiv / medRxiv preprint server service.
 *
 * Mirrors `backend/app/services/biorxiv_service.py`. The bioRxiv REST API
 * exposes preprint metadata by DOI and by date interval. We surface the
 * same shape the FastAPI layer used so the unified `/literature/search`
 * endpoint can drop in seamlessly.
 *
 * API docs: https://api.biorxiv.org
 */

import { httpGet } from './_httpClient.js'

const BIORXIV_BASE = 'https://api.biorxiv.org'

/**
 * Search recent preprints on bioRxiv or medRxiv.
 *
 * @param {object} opts
 * @param {'biorxiv'|'medrxiv'} [opts.server='biorxiv']
 * @param {string} [opts.date_from] - `YYYY-MM-DD`
 * @param {string} [opts.date_to] - `YYYY-MM-DD`
 * @param {number} [opts.limit=50]
 */
export async function searchPreprints({ server = 'biorxiv', date_from, date_to, limit = 50 } = {}) {
  try {
    // Default to the last 30 days when no interval is provided.
    const today = new Date()
    const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const to = date_to ?? today.toISOString().slice(0, 10)
    const from = date_from ?? oneMonthAgo.toISOString().slice(0, 10)

    const url = `${BIORXIV_BASE}/details/${server}/${from}/${to}/0`
    const data = await httpGet(url, { source: `biorxiv.details.${server}` })
    const collection = data?.collection ?? []
    const preprints = collection.slice(0, limit).map(mapPreprint)
    return { server, total_results: preprints.length, preprints }
  } catch (err) {
    return {
      server,
      total_results: 0,
      preprints: [],
      error: String(err?.message ?? err),
    }
  }
}

/**
 * Look up a single preprint by DOI.
 *
 * @param {string} doi
 * @param {'biorxiv'|'medrxiv'} [server='biorxiv']
 */
export async function getPreprint(doi, server = 'biorxiv') {
  try {
    const url = `${BIORXIV_BASE}/details/${server}/${encodeURIComponent(doi)}`
    const data = await httpGet(url, { source: `biorxiv.details.${server}.doi` })
    const first = data?.collection?.[0]
    return first ? mapPreprint(first) : null
  } catch {
    return null
  }
}

/**
 * Return the static list of bioRxiv subject categories. The Python service
 * hardcoded these to avoid an extra round-trip; we do the same.
 */
export async function getCategories() {
  return [
    'animal_behavior_and_cognition',
    'biochemistry',
    'bioengineering',
    'bioinformatics',
    'biophysics',
    'cancer_biology',
    'cell_biology',
    'clinical_trials',
    'developmental_biology',
    'ecology',
    'epidemiology',
    'evolutionary_biology',
    'genetics',
    'genomics',
    'immunology',
    'microbiology',
    'molecular_biology',
    'neuroscience',
    'paleontology',
    'pathology',
    'pharmacology_and_toxicology',
    'physiology',
    'plant_biology',
    'scientific_communication_and_education',
    'synthetic_biology',
    'systems_biology',
    'zoology',
  ]
}

/* -------------------------------------------------------------------------- */
/*  Internal                                                                  */
/* -------------------------------------------------------------------------- */

/** Coerce a bioRxiv `collection` entry into the unified preprint shape. */
function mapPreprint(entry) {
  const authors = (entry.authors ?? '')
    .split(';')
    .map((a) => a.trim())
    .filter(Boolean)
  return {
    doi: entry.doi,
    title: entry.title ?? '',
    authors,
    abstract: entry.abstract ?? null,
    publication_date: entry.date ?? null,
    server: entry.server ?? 'biorxiv',
    category: entry.category ?? null,
    version: entry.version ?? null,
    url: entry.doi ? `https://www.biorxiv.org/content/${entry.doi}` : null,
  }
}
