/**
 * SerpApi-backed web search service.
 *
 * Mirrors `backend/app/services/serpapi_service.py`. Requires a SerpApi
 * key (free tier permits 100 searches/month). Without a key the
 * endpoints respond with HTTP 503 and a clear message so the SPA can
 * render a "configure SerpApi" CTA.
 */

import { httpGet } from './_httpClient.js'

const SERP_BASE = 'https://serpapi.com/search.json'

/** Returns the key from env vars; missing key is treated as "not configured". */
export function serpApiKey() {
  return process.env.SERPAPI_KEY?.trim() || process.env.SERP_API_KEY?.trim() || null
}

/** Pre-built `site:` operators per regulatory body. */
const REGULATORY_SITES = {
  atsdr: ['site:atsdr.cdc.gov'],
  iris: ['site:cfpub.epa.gov/ncea/iris', 'site:epa.gov/iris'],
  efsa: ['site:efsa.europa.eu'],
  who: ['site:inchem.org', 'site:who.int'],
  iarc: ['site:monographs.iarc.fr', 'site:monographs.iarc.who.int'],
  ntp: ['site:ntp.niehs.nih.gov'],
  fda: ['site:fda.gov'],
  echa: ['site:echa.europa.eu'],
  inchem: ['site:inchem.org'],
}

/** Categorised toxicology web search. */
export async function searchToxicologyReports({
  compound_name,
  cas_number,
  include_sds = true,
  include_regulatory = true,
  include_publications = true,
  num_results = 30,
}) {
  const key = serpApiKey()
  if (!key) return notConfigured('toxicology')

  const baseQuery = cas_number ? `"${compound_name}" "${cas_number}"` : `"${compound_name}"`
  const buckets = {
    regulatory_reports: [],
    safety_data_sheets: [],
    scientific_publications: [],
    echa_results: [],
    other_results: [],
  }
  let total = 0

  // Regulatory queries
  if (include_regulatory) {
    const reg = await execSearch(`${baseQuery} (site:atsdr.cdc.gov OR site:epa.gov OR site:efsa.europa.eu OR site:fda.gov)`, num_results)
    buckets.regulatory_reports = reg.map(scoreResult)
    total += reg.length
    const echa = await execSearch(`${baseQuery} site:echa.europa.eu`, Math.min(num_results, 15))
    buckets.echa_results = echa.map(scoreResult)
    total += echa.length
  }

  // SDS
  if (include_sds) {
    const sds = await execSearch(`${baseQuery} "safety data sheet" OR SDS filetype:pdf`, Math.min(num_results, 15))
    buckets.safety_data_sheets = sds.map(scoreResult)
    total += sds.length
  }

  // Publications
  if (include_publications) {
    const pubs = await execSearch(`${baseQuery} site:pubmed.ncbi.nlm.nih.gov OR site:sciencedirect.com`, num_results)
    buckets.scientific_publications = pubs.map(scoreResult)
    total += pubs.length
  }

  return {
    query: compound_name,
    total_results: total,
    ...buckets,
    search_metadata: {
      compound: compound_name,
      cas_number,
      provider: 'SerpApi',
    },
  }
}

export async function searchSpecificReportType({ compound_name, report_type, cas_number, num_results = 20 }) {
  const key = serpApiKey()
  if (!key) return []
  const sites = REGULATORY_SITES[report_type.toLowerCase()] ?? []
  const baseQuery = cas_number ? `"${compound_name}" "${cas_number}"` : `"${compound_name}"`
  const fullQuery = sites.length ? `${baseQuery} (${sites.join(' OR ')})` : baseQuery
  const results = await execSearch(fullQuery, num_results)
  return results.map(scoreResult)
}

export async function searchGoogleScholar({ query, num_results = 20 }) {
  const key = serpApiKey()
  if (!key) return []
  const data = await httpGet(SERP_BASE, {
    params: { engine: 'google_scholar', q: query, num: num_results, api_key: key },
    source: 'serpapi.scholar',
  }).catch(() => null)
  return (data?.organic_results ?? []).map((r, i) => scoreResult({ ...r, position: i + 1 }))
}

/** Public re-export of the underlying search call (used by the SDS endpoint). */
export async function executeSearch(query, num) {
  return execSearch(query, num).then((res) => res.map(scoreResult))
}

/* -------------------------------------------------------------------------- */

async function execSearch(query, num) {
  const key = serpApiKey()
  if (!key) return []
  try {
    const data = await httpGet(SERP_BASE, {
      params: { engine: 'google', q: query, num, api_key: key },
      source: 'serpapi.google',
    })
    return data?.organic_results ?? []
  } catch {
    return []
  }
}

function scoreResult(r) {
  const link = r.link ?? ''
  let category = 'other'
  if (/atsdr|epa|efsa|fda|echa|who|iarc/.test(link)) category = 'regulatory'
  else if (/pubmed|sciencedirect|springer|wiley|nature/.test(link)) category = 'publication'
  else if (/safetydatasheet|\.pdf$/i.test(link) && /sds|msds/i.test(link)) category = 'sds'
  return {
    title: r.title ?? '',
    link,
    snippet: r.snippet ?? '',
    source: new URL(link.startsWith('http') ? link : `https://${link}`).hostname,
    position: r.position ?? 0,
    result_type: r.type ?? 'organic',
    date: r.date ?? null,
    file_type: link.endsWith('.pdf') ? 'pdf' : null,
    relevance_score: r.score ?? 0,
    category,
  }
}

function notConfigured(kind) {
  return {
    query: '',
    total_results: 0,
    [kind === 'toxicology' ? 'regulatory_reports' : 'results']: [],
    error: 'SerpApi key not configured. Set SERPAPI_KEY in the server env to enable web search.',
  }
}
