/**
 * KEGG (Kyoto Encyclopedia of Genes and Genomes) service.
 *
 * Mirrors `backend/app/services/kegg_service.py`.
 *
 * KEGG exposes a free, text-based REST API at https://rest.kegg.jp. The
 * responses are TSV-style line records (no JSON) so this module parses
 * them into the same JSON shapes the React UI already expects.
 *
 * Endpoints used:
 *   - GET /find/<db>/<query>   - search
 *   - GET /get/<db>:<id>       - record detail (multi-line)
 *   - GET /link/<db1>/<db2>:id - cross-database links
 *   - GET /list/pathway/<org>  - list pathways for organism
 */

import { httpGet } from './_httpClient.js'

const BASE_URL = 'https://rest.kegg.jp'

/**
 * Search KEGG COMPOUND by name.
 *
 * @param {string} query
 * @param {number} [limit=20]
 */
export async function searchCompound(query, limit = 20) {
  try {
    const tsv = await httpGet(`${BASE_URL}/find/compound/${encodeURIComponent(query)}`, {
      responseType: 'text',
      source: 'kegg.find_compound',
    })
    const rows = parseTwoColumn(tsv).slice(0, limit)
    return {
      query,
      total_results: rows.length,
      compounds: rows.map(([id, names]) => ({
        kegg_id: id.replace(/^cpd:/, ''),
        names: names.split(';').map((s) => s.trim()),
      })),
    }
  } catch (err) {
    return { query, total_results: 0, compounds: [], error: String(err?.message ?? err) }
  }
}

/** Get full COMPOUND record by KEGG id. */
export async function getCompound(keggId) {
  try {
    const txt = await httpGet(`${BASE_URL}/get/cpd:${encodeURIComponent(keggId)}`, {
      responseType: 'text',
      source: 'kegg.get_compound',
    })
    return parseFlatFile(txt, keggId)
  } catch {
    return null
  }
}

/** All pathways a compound participates in. */
export async function getCompoundPathways(keggId) {
  try {
    const tsv = await httpGet(`${BASE_URL}/link/pathway/cpd:${encodeURIComponent(keggId)}`, {
      responseType: 'text',
      source: 'kegg.compound_pathways',
    })
    const rows = parseTwoColumn(tsv)
    const pathways = rows.map(([, pathwayId]) => ({ pathway_id: pathwayId.replace(/^path:/, '') }))
    return { kegg_id: keggId, total_results: pathways.length, pathways }
  } catch (err) {
    return { kegg_id: keggId, total_results: 0, pathways: [], error: String(err?.message ?? err) }
  }
}

/** Search pathways by name within an organism (`hsa`, `mmu`, etc.). */
export async function searchPathway(query, { organism = 'hsa', limit = 20 } = {}) {
  try {
    const tsv = await httpGet(`${BASE_URL}/find/pathway/${encodeURIComponent(query)}`, {
      responseType: 'text',
      source: 'kegg.find_pathway',
    })
    const rows = parseTwoColumn(tsv)
      .filter(([id]) => id.includes(organism) || id.startsWith('path:map'))
      .slice(0, limit)
    return {
      query,
      organism,
      total_results: rows.length,
      pathways: rows.map(([id, name]) => ({ pathway_id: id.replace(/^path:/, ''), name })),
    }
  } catch (err) {
    return {
      query,
      organism,
      total_results: 0,
      pathways: [],
      error: String(err?.message ?? err),
    }
  }
}

/** Get full pathway record. */
export async function getPathwayDetails(pathwayId) {
  try {
    const txt = await httpGet(`${BASE_URL}/get/path:${encodeURIComponent(pathwayId)}`, {
      responseType: 'text',
      source: 'kegg.get_pathway',
    })
    return parseFlatFile(txt, pathwayId)
  } catch {
    return null
  }
}

/** All pathways for an organism. */
export async function listPathways({ organism = 'hsa' } = {}) {
  try {
    const tsv = await httpGet(`${BASE_URL}/list/pathway/${encodeURIComponent(organism)}`, {
      responseType: 'text',
      source: 'kegg.list_pathways',
    })
    const rows = parseTwoColumn(tsv)
    return {
      organism,
      total_results: rows.length,
      pathways: rows.map(([id, name]) => ({ pathway_id: id.replace(/^path:/, ''), name })),
    }
  } catch (err) {
    return { organism, total_results: 0, pathways: [], error: String(err?.message ?? err) }
  }
}

/** Drug metabolism: drug -> pathways. */
export async function getDrugMetabolism(drugName) {
  try {
    const find = await searchDrug(drugName)
    if (!find.drugs?.length) return { drug: drugName, drug_id: null, pathways: [] }
    const drugId = find.drugs[0].drug_id
    const tsv = await httpGet(`${BASE_URL}/link/pathway/dr:${drugId}`, {
      responseType: 'text',
      source: 'kegg.drug_pathways',
    })
    const rows = parseTwoColumn(tsv)
    return {
      drug: drugName,
      drug_id: drugId,
      pathways: rows.map(([, p]) => ({ pathway_id: p.replace(/^path:/, '') })),
    }
  } catch (err) {
    return { drug: drugName, drug_id: null, pathways: [], error: String(err?.message ?? err) }
  }
}

/** Disease -> pathways. */
export async function getDiseasePathways(diseaseName, limit = 20) {
  try {
    const find = await httpGet(`${BASE_URL}/find/disease/${encodeURIComponent(diseaseName)}`, {
      responseType: 'text',
      source: 'kegg.find_disease',
    })
    const diseaseRows = parseTwoColumn(find).slice(0, limit)
    const pathways = []
    for (const [diseaseId] of diseaseRows) {
      const linkTsv = await httpGet(`${BASE_URL}/link/pathway/${diseaseId}`, {
        responseType: 'text',
        source: 'kegg.disease_pathways',
      }).catch(() => '')
      for (const [, p] of parseTwoColumn(linkTsv)) {
        pathways.push({ disease_id: diseaseId.replace(/^ds:/, ''), pathway_id: p.replace(/^path:/, '') })
      }
    }
    return { disease: diseaseName, total_results: pathways.length, pathways }
  } catch (err) {
    return { disease: diseaseName, total_results: 0, pathways: [], error: String(err?.message ?? err) }
  }
}

/** Enzyme info by EC number. */
export async function getEnzymeInfo(ecNumber) {
  try {
    const txt = await httpGet(`${BASE_URL}/get/ec:${encodeURIComponent(ecNumber)}`, {
      responseType: 'text',
      source: 'kegg.enzyme',
    })
    return parseFlatFile(txt, ecNumber)
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Internal                                                                  */
/* -------------------------------------------------------------------------- */

async function searchDrug(query) {
  try {
    const tsv = await httpGet(`${BASE_URL}/find/drug/${encodeURIComponent(query)}`, {
      responseType: 'text',
      source: 'kegg.find_drug',
    })
    const rows = parseTwoColumn(tsv)
    return {
      drugs: rows.map(([id, name]) => ({ drug_id: id.replace(/^dr:/, ''), name })),
    }
  } catch {
    return { drugs: [] }
  }
}

/** Parse the two-column TSV format used by `/find` and `/link`. */
function parseTwoColumn(tsv) {
  if (!tsv) return []
  return tsv
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('\t').map((c) => c.trim()))
}

/**
 * Parse a KEGG flat-file response into a key/value record. Flat files use
 * top-level field names in the first 12 chars of each line and continue
 * multi-line values with whitespace indentation.
 */
function parseFlatFile(text, id) {
  if (!text) return null
  const record = { id }
  let currentKey = null
  let currentValue = []
  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine === '///') break
    const match = rawLine.match(/^([A-Z_]+)\s+(.*)$/)
    if (match) {
      if (currentKey) {
        record[currentKey.toLowerCase()] = currentValue.length === 1 ? currentValue[0] : currentValue
      }
      currentKey = match[1]
      currentValue = [match[2].trim()]
    } else if (currentKey && rawLine.startsWith(' ')) {
      currentValue.push(rawLine.trim())
    }
  }
  if (currentKey) {
    record[currentKey.toLowerCase()] = currentValue.length === 1 ? currentValue[0] : currentValue
  }
  return record
}
