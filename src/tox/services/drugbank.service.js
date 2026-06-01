/**
 * DrugBank service.
 *
 * Mirrors `backend/app/services/drugbank_service.py`. The free DrugBank
 * Open Data dump exposes drug name + DBID; the licensed REST API offers
 * full pharmacology. We honour both modes:
 *
 *   - When `DRUGBANK_API_KEY` is set, hit https://api.drugbank.com
 *   - Otherwise return data sourced from the open vocab + a friendly note
 *     telling clients to wire up the licensed key.
 */

import { httpGet } from './_httpClient.js'

const OPEN_BASE = 'https://go.drugbank.com'
const COMMERCIAL_BASE = 'https://api.drugbank.com/v1'

function apiKey() {
  return process.env.DRUGBANK_API_KEY?.trim() || undefined
}

/** Search DrugBank for a drug. */
export async function searchDrug(query, limit = 20) {
  if (!apiKey()) {
    // Open Data endpoint returns a public search page (HTML); we return a
    // lightweight payload pointing back to the search URL so the UI can still
    // render an actionable result without a licensed key.
    return {
      query,
      total_results: 0,
      drugs: [],
      mode: 'open-data',
      note: 'Set DRUGBANK_API_KEY to enable rich drug lookups; open data limits us to redirecting to https://go.drugbank.com.',
      url: `${OPEN_BASE}/drugs?query=${encodeURIComponent(query)}`,
    }
  }
  try {
    const data = await httpGet(`${COMMERCIAL_BASE}/drug_names`, {
      params: { q: query, fuzzy: 'true' },
      headers: { Authorization: apiKey() },
      source: 'drugbank.search',
    })
    const drugs = (data?.drug_names ?? data ?? []).slice(0, limit).map(mapDrugSummary)
    return { query, total_results: drugs.length, drugs }
  } catch (err) {
    return { query, total_results: 0, drugs: [], error: String(err?.message ?? err) }
  }
}

/** Full drug detail. */
export async function getDrug(drugbankId) {
  return callCommercial(`drugs/${drugbankId}.json`).then((data) => (data ? mapDrugDetail(data) : null))
}

/** Drug-target interactions. */
export async function getDrugTargets(drugbankId) {
  const data = await callCommercial(`drugs/${drugbankId}/targets.json`)
  return wrap(drugbankId, 'targets', data?.targets ?? data)
}

/** Drug-drug interactions. */
export async function getDrugInteractions(drugbankId) {
  const data = await callCommercial(`drugs/${drugbankId}/drug_interactions.json`)
  return wrap(drugbankId, 'interactions', data?.drug_interactions ?? data)
}

/** Pharmacokinetics. */
export async function getPharmacokinetics(drugbankId) {
  const data = await callCommercial(`drugs/${drugbankId}/pharmacokinetics.json`)
  return wrap(drugbankId, 'pharmacokinetics', data ?? null)
}

/** Food-drug interactions. */
export async function getFoodInteractions(drugbankId) {
  const data = await callCommercial(`drugs/${drugbankId}/food_interactions.json`)
  return wrap(drugbankId, 'food_interactions', data?.food_interactions ?? data)
}

/** Metabolising enzymes. */
export async function getEnzymes(drugbankId) {
  const data = await callCommercial(`drugs/${drugbankId}/enzymes.json`)
  return wrap(drugbankId, 'enzymes', data?.enzymes ?? data)
}

/** Drug transporters. */
export async function getTransporters(drugbankId) {
  const data = await callCommercial(`drugs/${drugbankId}/transporters.json`)
  return wrap(drugbankId, 'transporters', data?.transporters ?? data)
}

/** Pathways. */
export async function getPathways(drugbankId) {
  const data = await callCommercial(`drugs/${drugbankId}/pathways.json`)
  return wrap(drugbankId, 'pathways', data?.pathways ?? data)
}

/** Search drugs by target name. */
export async function searchByTarget(targetName, limit = 20) {
  if (!apiKey()) {
    return {
      target: targetName,
      total_results: 0,
      drugs: [],
      mode: 'open-data',
      note: 'Set DRUGBANK_API_KEY for target-to-drug lookups.',
    }
  }
  try {
    const data = await httpGet(`${COMMERCIAL_BASE}/targets`, {
      params: { q: targetName, limit },
      headers: { Authorization: apiKey() },
      source: 'drugbank.targets_search',
    })
    return { target: targetName, total_results: (data ?? []).length, drugs: data?.drugs ?? [] }
  } catch (err) {
    return { target: targetName, total_results: 0, drugs: [], error: String(err?.message ?? err) }
  }
}

/* -------------------------------------------------------------------------- */
/*  Internal                                                                  */
/* -------------------------------------------------------------------------- */

async function callCommercial(path) {
  if (!apiKey()) {
    return {
      mode: 'open-data',
      note: 'DRUGBANK_API_KEY not configured; returning empty payload.',
    }
  }
  try {
    return await httpGet(`${COMMERCIAL_BASE}/${path}`, {
      headers: { Authorization: apiKey() },
      source: `drugbank.${path}`,
    })
  } catch (err) {
    return { error: String(err?.message ?? err) }
  }
}

function wrap(drugbankId, key, value) {
  if (value && typeof value === 'object' && (value.mode || value.error)) {
    return { drugbank_id: drugbankId, [key]: [], ...value }
  }
  return { drugbank_id: drugbankId, [key]: value ?? [] }
}

function mapDrugSummary(raw) {
  return {
    drugbank_id: raw?.drugbank_id ?? raw?.id ?? null,
    name: raw?.name ?? raw?.preferred_name ?? null,
    cas_number: raw?.cas_number ?? null,
    synonyms: raw?.synonyms ?? [],
  }
}

function mapDrugDetail(raw) {
  return {
    ...mapDrugSummary(raw),
    description: raw?.description ?? null,
    indication: raw?.indication ?? null,
    mechanism_of_action: raw?.mechanism_of_action ?? null,
    toxicity: raw?.toxicity ?? null,
    metabolism: raw?.metabolism ?? null,
    half_life: raw?.half_life ?? null,
    routes: raw?.routes ?? [],
    groups: raw?.groups ?? [],
    categories: raw?.categories ?? [],
  }
}
