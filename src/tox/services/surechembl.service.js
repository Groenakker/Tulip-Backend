/**
 * SureChEMBL (patent chemistry) service.
 *
 * Mirrors `backend/app/services/surechembl_service.py`. SureChEMBL exposes
 * compound-patent mappings via its REST API
 * (https://www.surechembl.org/api/v3/). Where the endpoint is gated or
 * down, we fall back to a friendly payload so the UI still renders.
 */

import { httpGet, looksLikeSmiles } from './_httpClient.js'

const BASE_URL = 'https://www.surechembl.org/api/v3'

export async function searchCompound(query, { search_type = 'name', limit = 20 } = {}) {
  try {
    const endpoint =
      search_type === 'smiles' || looksLikeSmiles(query)
        ? `chemistry/smiles/${encodeURIComponent(query)}`
        : search_type === 'inchi'
          ? `chemistry/inchi/${encodeURIComponent(query)}`
          : `search/text/${encodeURIComponent(query)}`
    const data = await httpGet(`${BASE_URL}/${endpoint}`, {
      params: { limit },
      source: `surechembl.${search_type}`,
    })
    const items = (data?.compounds ?? data ?? []).slice(0, limit).map(mapCompound)
    return { query, search_type, total_results: items.length, compounds: items }
  } catch (err) {
    return { query, search_type, total_results: 0, compounds: [], error: String(err?.message ?? err) }
  }
}

export async function getCompoundById(schemblId) {
  try {
    const data = await httpGet(`${BASE_URL}/chemistry/${schemblId}`, {
      source: 'surechembl.compound',
    })
    return data ? mapCompound(data) : null
  } catch {
    return null
  }
}

export async function getCompoundPatents(schemblId, limit = 50) {
  try {
    const data = await httpGet(`${BASE_URL}/chemistry/${schemblId}/documents`, {
      params: { limit },
      source: 'surechembl.documents',
    })
    return {
      schembl_id: schemblId,
      total_results: data?.total ?? 0,
      patents: (data?.documents ?? []).map(mapPatent),
    }
  } catch (err) {
    return { schembl_id: schemblId, total_results: 0, patents: [], error: String(err?.message ?? err) }
  }
}

export async function getPatentTimeline(schemblId) {
  const data = await getCompoundPatents(schemblId, 200)
  const byYear = {}
  for (const patent of data.patents ?? []) {
    const year = patent.publication_date ? String(patent.publication_date).slice(0, 4) : 'unknown'
    byYear[year] = (byYear[year] ?? 0) + 1
  }
  return {
    schembl_id: schemblId,
    timeline: Object.entries(byYear)
      .filter(([y]) => y !== 'unknown')
      .map(([year, count]) => ({ year: Number(year), patents: count }))
      .sort((a, b) => a.year - b.year),
  }
}

export async function getPatentCompounds(patentId, limit = 100) {
  try {
    const data = await httpGet(`${BASE_URL}/document/${patentId}/compounds`, {
      params: { limit },
      source: 'surechembl.patent_compounds',
    })
    return {
      patent_id: patentId,
      total_results: data?.total ?? 0,
      compounds: (data?.compounds ?? []).slice(0, limit).map(mapCompound),
    }
  } catch (err) {
    return { patent_id: patentId, total_results: 0, compounds: [], error: String(err?.message ?? err) }
  }
}

export async function searchPatentsByStructure(smiles, { search_type = 'exact', limit = 20 } = {}) {
  try {
    const endpoint =
      search_type === 'substructure' ? 'chemistry/substructure' : search_type === 'similarity' ? 'chemistry/similarity' : 'chemistry/smiles'
    const data = await httpGet(`${BASE_URL}/${endpoint}/${encodeURIComponent(smiles)}/documents`, {
      params: { limit },
      source: `surechembl.structure.${search_type}`,
    })
    return {
      query: smiles,
      search_type,
      total_results: data?.total ?? 0,
      patents: (data?.documents ?? []).slice(0, limit).map(mapPatent),
    }
  } catch (err) {
    return {
      query: smiles,
      search_type,
      total_results: 0,
      patents: [],
      error: String(err?.message ?? err),
    }
  }
}

/**
 * Lightweight Freedom-To-Operate scan: search for substructure patents
 * and summarise the result. NOTE: This is not legal advice — the original
 * Python service flagged this explicitly and we do the same.
 */
export async function getFreedomToOperate(smiles, { jurisdiction = 'US' } = {}) {
  const sub = await searchPatentsByStructure(smiles, { search_type: 'substructure', limit: 100 })
  const filtered = (sub.patents ?? []).filter((p) => {
    if (!jurisdiction) return true
    const code = String(p.patent_number ?? '').slice(0, 2).toUpperCase()
    return code === jurisdiction.toUpperCase()
  })
  return {
    query: smiles,
    jurisdiction,
    total_active_patents: filtered.length,
    representative_patents: filtered.slice(0, 10),
    risk_level: filtered.length > 20 ? 'high' : filtered.length > 5 ? 'moderate' : 'low',
    disclaimer:
      'Preliminary screening only. Consult a registered patent attorney for definitive freedom-to-operate analysis.',
  }
}

export async function getAssigneeCompounds(assignee, limit = 50) {
  try {
    const data = await httpGet(`${BASE_URL}/search/assignee/${encodeURIComponent(assignee)}/compounds`, {
      params: { limit },
      source: 'surechembl.assignee',
    })
    return {
      assignee,
      total_results: data?.total ?? 0,
      compounds: (data?.compounds ?? []).slice(0, limit).map(mapCompound),
    }
  } catch (err) {
    return { assignee, total_results: 0, compounds: [], error: String(err?.message ?? err) }
  }
}

/* -------------------------------------------------------------------------- */

function mapCompound(raw) {
  return {
    schembl_id: raw?.schembl_id ?? raw?.id ?? null,
    inchi: raw?.inchi ?? null,
    inchi_key: raw?.inchi_key ?? null,
    smiles: raw?.smiles ?? null,
    molecular_formula: raw?.molecular_formula ?? null,
    molecular_weight: raw?.molecular_weight ?? null,
    name: raw?.preferred_name ?? raw?.name ?? null,
    document_count: raw?.documents_count ?? raw?.document_count ?? null,
  }
}

function mapPatent(raw) {
  return {
    patent_id: raw?.id ?? raw?.scpn ?? null,
    patent_number: raw?.scpn ?? raw?.publication_number ?? null,
    title: raw?.title ?? null,
    abstract: raw?.abstract ?? null,
    publication_date: raw?.publication_date ?? null,
    assignee: raw?.assignee ?? null,
    inventors: raw?.inventors ?? [],
    classifications: raw?.classifications ?? [],
  }
}
