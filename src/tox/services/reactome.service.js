/**
 * Reactome service.
 *
 * Mirrors `backend/app/services/reactome_service.py`. Reactome offers a
 * public REST API at https://reactome.org/ContentService for searching
 * pathways, retrieving participants, and running pathway enrichment.
 */

import { httpGet, httpPost } from './_httpClient.js'

const CONTENT_BASE = 'https://reactome.org/ContentService'
const ANALYSIS_BASE = 'https://reactome.org/AnalysisService'

/** Free-text search restricted to a species. */
export async function searchByQuery(query, { species = 'Homo sapiens', limit = 20 } = {}) {
  try {
    const data = await httpGet(`${CONTENT_BASE}/search/query`, {
      params: { query, species, types: 'Pathway,Reaction,Protein,SimpleEntity', cluster: true },
      source: 'reactome.search',
    })
    const items = data?.results?.flatMap((r) => r.entries ?? []) ?? []
    return {
      query,
      species,
      total_results: items.length,
      results: items.slice(0, limit).map(mapSearchEntry),
    }
  } catch (err) {
    return { query, species, total_results: 0, results: [], error: String(err?.message ?? err) }
  }
}

export async function getPathwayDetails(pathwayId) {
  try {
    const data = await httpGet(`${CONTENT_BASE}/data/pathway/${pathwayId}/containedEvents`, {
      source: 'reactome.pathway_contained',
    })
    const meta = await httpGet(`${CONTENT_BASE}/data/query/${pathwayId}`, {
      source: 'reactome.pathway_meta',
    })
    return {
      pathway_id: pathwayId,
      display_name: meta?.displayName ?? null,
      species: meta?.speciesName ?? null,
      summation: meta?.summation?.[0]?.text ?? null,
      contained_event_count: Array.isArray(data) ? data.length : 0,
      contained_events: Array.isArray(data) ? data : [],
    }
  } catch {
    return null
  }
}

export async function getPathwayParticipants(pathwayId, { entity_type } = {}) {
  try {
    const data = await httpGet(`${CONTENT_BASE}/data/pathway/${pathwayId}/containedEvents`, {
      source: 'reactome.pathway_participants',
    })
    let participants = Array.isArray(data) ? data : []
    if (entity_type) participants = participants.filter((p) => p?.className === entity_type)
    return { pathway_id: pathwayId, total_results: participants.length, participants }
  } catch (err) {
    return { pathway_id: pathwayId, total_results: 0, participants: [], error: String(err?.message ?? err) }
  }
}

export async function getDiagramData(pathwayId) {
  try {
    return (
      (await httpGet(`${CONTENT_BASE}/data/eventsHierarchy/${pathwayId}`, {
        source: 'reactome.diagram',
      })) ?? []
    )
  } catch (err) {
    return { pathway_id: pathwayId, error: String(err?.message ?? err) }
  }
}

export async function getPathwaysForEntity(entityId, { species = 'Homo sapiens' } = {}) {
  try {
    const data = await httpGet(`${CONTENT_BASE}/data/pathways/low/entity/${entityId}/allForms`, {
      params: { species },
      source: 'reactome.entity_pathways',
    })
    return { entity_id: entityId, species, pathways: Array.isArray(data) ? data : [] }
  } catch (err) {
    return { entity_id: entityId, species, pathways: [], error: String(err?.message ?? err) }
  }
}

export async function getInteractors(entityId) {
  try {
    const data = await httpGet(`${CONTENT_BASE}/interactors/static/molecule/${entityId}/details`, {
      source: 'reactome.interactors',
    })
    return { entity_id: entityId, interactors: data?.entities ?? [] }
  } catch (err) {
    return { entity_id: entityId, interactors: [], error: String(err?.message ?? err) }
  }
}

export async function getPathwayHierarchy({ species = 'Homo sapiens' } = {}) {
  try {
    const data = await httpGet(`${CONTENT_BASE}/data/eventsHierarchy/9612973`, {
      params: { species },
      source: 'reactome.hierarchy',
    })
    return { species, hierarchy: Array.isArray(data) ? data : [] }
  } catch (err) {
    return { species, hierarchy: [], error: String(err?.message ?? err) }
  }
}

export async function analyzeGeneList(genes, { species = 'Homo sapiens' } = {}) {
  try {
    const body = genes.join('\n')
    const data = await httpPost(`${ANALYSIS_BASE}/identifiers/projection/`, body, {
      params: { species, pageSize: 50, page: 1, sortBy: 'ENTITIES_PVALUE' },
      headers: { 'Content-Type': 'text/plain' },
      source: 'reactome.analyze',
    })
    return {
      species,
      total_pathways: data?.pathwaysFound ?? 0,
      summary: data?.summary ?? null,
      pathways: (data?.pathways ?? []).slice(0, 100).map((p) => ({
        stId: p.stId,
        name: p.name,
        entities_found: p.entities?.found ?? 0,
        entities_total: p.entities?.total ?? 0,
        entities_pvalue: p.entities?.pValue ?? null,
        entities_fdr: p.entities?.fdr ?? null,
      })),
    }
  } catch (err) {
    return { species, total_pathways: 0, pathways: [], error: String(err?.message ?? err) }
  }
}

export async function getDiseasePathways(diseaseName, { species = 'Homo sapiens' } = {}) {
  return searchByQuery(diseaseName, { species, limit: 50 }).then((r) => ({
    disease: diseaseName,
    species,
    pathways: (r.results ?? []).filter((it) => it.exact_type === 'Pathway'),
  }))
}

/* -------------------------------------------------------------------------- */

function mapSearchEntry(raw) {
  return {
    stId: raw?.stId ?? null,
    name: raw?.name ?? raw?.title ?? null,
    species: raw?.species ?? null,
    exact_type: raw?.exactType ?? raw?.type ?? null,
    compartment_names: raw?.compartmentNames ?? [],
    summation: raw?.summation ?? null,
  }
}
