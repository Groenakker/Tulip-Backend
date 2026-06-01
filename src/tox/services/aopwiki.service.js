/**
 * AOP-Wiki service.
 *
 * Mirrors `backend/app/services/aopwiki_service.py`. AOP-Wiki provides
 * Adverse Outcome Pathways (a stressor → molecular initiating event →
 * key events → adverse outcome graph). The public REST API lives at
 * `aopwiki.org/api/v1`.
 */

import { httpGet } from './_httpClient.js'

const BASE_URL = 'https://aopwiki.org/api/v1'

export async function listAops(limit = 50, offset = 0) {
  try {
    const data = await httpGet(`${BASE_URL}/aops`, {
      params: { limit, offset },
      source: 'aopwiki.list_aops',
    })
    const aops = (data?.aops ?? data ?? []).slice(0, limit).map(mapAopSummary)
    return { total_results: aops.length, offset, aops }
  } catch (err) {
    return { total_results: 0, offset, aops: [], error: String(err?.message ?? err) }
  }
}

export async function searchAopsByStressor(stressor, limit = 20) {
  try {
    const data = await httpGet(`${BASE_URL}/aops/search`, {
      params: { q: stressor, limit },
      source: 'aopwiki.search_stressor',
    })
    const aops = (data?.aops ?? data ?? []).slice(0, limit).map(mapAopSummary)
    return { query: stressor, total_results: aops.length, aops }
  } catch (err) {
    return { query: stressor, total_results: 0, aops: [], error: String(err?.message ?? err) }
  }
}

export async function getAopDetails(aopId) {
  try {
    const data = await httpGet(`${BASE_URL}/aops/${aopId}`, { source: 'aopwiki.aop_detail' })
    if (!data) return null
    return {
      ...mapAopSummary(data),
      key_events: (data.key_events ?? []).map(mapKeyEvent),
      key_event_relationships: (data.key_event_relationships ?? []).map(mapKer),
      stressors: data.stressors ?? [],
      taxonomic_applicability: data.taxonomic_applicability ?? [],
      regulatory_uses: data.regulatory_uses ?? [],
    }
  } catch {
    return null
  }
}

export async function getAopPathwayVisualization(aopId) {
  // Build a simple node/edge graph from the detail payload.
  const detail = await getAopDetails(aopId)
  if (!detail) return { aop_id: aopId, nodes: [], edges: [] }
  const nodes = (detail.key_events ?? []).map((ke) => ({
    id: ke.id,
    label: ke.title,
    biological_level: ke.biological_level,
    is_mie: ke.is_mie,
    is_ao: ke.is_ao,
  }))
  const edges = (detail.key_event_relationships ?? []).map((rel) => ({
    source: rel.upstream_event_id,
    target: rel.downstream_event_id,
    relationship: rel.relationship_type ?? null,
    weight_of_evidence: rel.weight_of_evidence ?? null,
  }))
  return { aop_id: aopId, nodes, edges }
}

export async function searchKeyEvents(query, { biological_level, limit = 20 } = {}) {
  try {
    const data = await httpGet(`${BASE_URL}/key_events/search`, {
      params: { q: query, biological_level, limit },
      source: 'aopwiki.search_ke',
    })
    const items = (data?.key_events ?? data ?? []).slice(0, limit).map(mapKeyEvent)
    return { query, total_results: items.length, key_events: items }
  } catch (err) {
    return { query, total_results: 0, key_events: [], error: String(err?.message ?? err) }
  }
}

export async function getKeyEvent(keId) {
  try {
    const data = await httpGet(`${BASE_URL}/key_events/${keId}`, { source: 'aopwiki.ke_detail' })
    return data ? mapKeyEvent(data) : null
  } catch {
    return null
  }
}

export async function getKeyEventRelationship(kerId) {
  try {
    const data = await httpGet(`${BASE_URL}/key_event_relationships/${kerId}`, {
      source: 'aopwiki.ker_detail',
    })
    return data ? mapKer(data) : null
  } catch {
    return null
  }
}

export async function listStressors(limit = 50, offset = 0) {
  try {
    const data = await httpGet(`${BASE_URL}/stressors`, {
      params: { limit, offset },
      source: 'aopwiki.stressors',
    })
    const stressors = data?.stressors ?? data ?? []
    return { total_results: stressors.length, offset, stressors }
  } catch (err) {
    return { total_results: 0, offset, stressors: [], error: String(err?.message ?? err) }
  }
}

export async function getStressor(stressorId) {
  try {
    return (
      (await httpGet(`${BASE_URL}/stressors/${stressorId}`, {
        source: 'aopwiki.stressor_detail',
      })) ?? null
    )
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */

function mapAopSummary(raw) {
  return {
    id: raw?.id ?? raw?.aop_id ?? null,
    short_name: raw?.short_name ?? null,
    title: raw?.title ?? raw?.name ?? null,
    abstract: raw?.abstract ?? null,
    overall_assessment: raw?.overall_assessment ?? null,
    last_modified: raw?.last_modified ?? null,
    status: raw?.status ?? null,
  }
}

function mapKeyEvent(raw) {
  return {
    id: raw?.id ?? raw?.key_event_id ?? null,
    title: raw?.title ?? raw?.name ?? null,
    short_name: raw?.short_name ?? null,
    biological_level: raw?.biological_level ?? null,
    is_mie: Boolean(raw?.is_mie),
    is_ao: Boolean(raw?.is_ao),
    description: raw?.description ?? null,
    measurement_methods: raw?.measurement_methods ?? [],
  }
}

function mapKer(raw) {
  return {
    id: raw?.id ?? null,
    upstream_event_id: raw?.upstream_event_id ?? null,
    downstream_event_id: raw?.downstream_event_id ?? null,
    relationship_type: raw?.relationship_type ?? null,
    weight_of_evidence: raw?.weight_of_evidence ?? null,
    biological_plausibility: raw?.biological_plausibility ?? null,
    empirical_support: raw?.empirical_support ?? null,
  }
}
