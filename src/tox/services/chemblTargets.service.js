/**
 * ChEMBL target search and detail.
 *
 * The existing `chembl.js` covers compound/bioactivity/mechanism. This
 * module mirrors the Python `chembl_service.search_targets()` so the
 * `/targets/*` endpoints work without modifying the existing file.
 */

import axios from 'axios'

const BASE_URL = 'https://www.ebi.ac.uk/chembl/api/data'

/**
 * Search ChEMBL targets by free text, gene symbol, organism, or type.
 *
 * @param {object} opts
 * @param {string} [opts.query]
 * @param {string} [opts.gene_symbol]
 * @param {string|null} [opts.organism='Homo sapiens']
 * @param {string} [opts.target_type]
 * @param {number} [opts.limit=20]
 */
export async function searchTargets({
  query,
  gene_symbol,
  organism = 'Homo sapiens',
  target_type,
  limit = 20,
} = {}) {
  try {
    const params = { format: 'json', limit }
    if (query) params.pref_name__icontains = query
    if (gene_symbol) params.target_components__component_synonym__icontains = gene_symbol
    if (organism) params.organism = organism
    if (target_type) params.target_type = target_type

    const { data } = await axios.get(`${BASE_URL}/target`, { params, timeout: 30_000 })
    const targets = (data?.targets ?? []).map(mapTarget)
    return {
      total_results: data?.page_meta?.total_count ?? targets.length,
      targets,
    }
  } catch (err) {
    return { total_results: 0, targets: [], error: String(err?.message ?? err) }
  }
}

function mapTarget(raw) {
  return {
    chembl_id: raw?.target_chembl_id,
    pref_name: raw?.pref_name,
    target_type: raw?.target_type,
    organism: raw?.organism,
    tax_id: raw?.tax_id ?? null,
    species_group_flag: Boolean(raw?.species_group_flag),
    components: (raw?.target_components ?? []).map((c) => ({
      component_id: c?.component_id,
      component_type: c?.component_type,
      accession: c?.accession,
      description: c?.component_description,
    })),
    cross_references: raw?.cross_references ?? [],
  }
}
