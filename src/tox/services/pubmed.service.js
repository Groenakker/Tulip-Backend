/**
 * PubMed (NCBI E-utilities) service.
 *
 * Mirrors `backend/app/services/pubmed_service.py` and the helper modules
 * `pubmed_parsing.py` + `pubmed_query_utils.py`. PubMed exposes a JSON
 * search endpoint (`esearch.fcgi`) and an XML detail endpoint
 * (`efetch.fcgi`), so this module uses `xml2js` to parse the latter.
 *
 * No API key required for low-volume usage; rate limit is 3 req/sec.
 */

import { Parser as XmlParser } from 'xml2js'
import { httpGet } from './_httpClient.js'

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

/** MeSH terms used to bias toxicology-focused queries (subset of Python). */
const TOXICOLOGY_MESH_TERMS = [
  'toxicology',
  'toxicity',
  'risk assessment',
  'toxicokinetics',
  'no-observed-adverse-effect-level',
  'lethal dose',
  'carcinogenicity',
  'genotoxicity',
  'developmental toxicity',
  'reproductive toxicity',
  'neurotoxicity',
  'immunotoxicity',
  'hepatotoxicity',
  'nephrotoxicity',
]

/** Keywords used for relevance scoring after retrieval. */
const TOX_KEYWORD_WEIGHTS = [
  { kw: 'noael', weight: 18 },
  { kw: 'loael', weight: 16 },
  { kw: 'ld50', weight: 12 },
  { kw: 'lc50', weight: 12 },
  { kw: 'bmd', weight: 10 },
  { kw: 'tdi', weight: 8 },
  { kw: 'adi', weight: 8 },
  { kw: 'rfd', weight: 8 },
  { kw: 'carcinog', weight: 10 },
  { kw: 'genotox', weight: 10 },
  { kw: 'mutagen', weight: 8 },
  { kw: 'tolerable intake', weight: 8 },
  { kw: 'risk assessment', weight: 6 },
  { kw: 'toxicology', weight: 5 },
  { kw: 'toxic', weight: 3 },
  { kw: 'safety evaluation', weight: 6 },
  { kw: 'adverse effect', weight: 4 },
]

const xmlParser = new XmlParser({ explicitArray: false, mergeAttrs: true })

/**
 * Run a PubMed esearch + efetch sequence and return parsed articles.
 *
 * @param {object} opts
 * @param {string} opts.query
 * @param {number} [opts.max_results=20]
 * @param {string} [opts.date_from] - `YYYY/MM/DD`
 * @param {string} [opts.date_to] - `YYYY/MM/DD`
 * @param {'relevance'|'pub_date'} [opts.sort='relevance']
 */
export async function searchArticles({
  query,
  max_results = 20,
  date_from,
  date_to,
  sort = 'relevance',
}) {
  try {
    const searchParams = {
      db: 'pubmed',
      term: query,
      retmax: max_results,
      retmode: 'json',
      sort: sort === 'relevance' ? '' : sort,
    }
    if (date_from) {
      searchParams.mindate = date_from
      searchParams.datetype = 'pdat'
    }
    if (date_to) searchParams.maxdate = date_to

    const searchData = await httpGet(`${BASE_URL}/esearch.fcgi`, {
      params: searchParams,
      source: 'pubmed.esearch',
    })

    const idList = searchData?.esearchresult?.idlist ?? []
    const totalCount = Number(searchData?.esearchresult?.count ?? 0)
    if (idList.length === 0) {
      return { query, total_results: 0, articles: [] }
    }

    const articles = await fetchArticlesByPmid(idList)
    return { query, total_results: totalCount, articles }
  } catch (err) {
    return { query, total_results: 0, articles: [], error: String(err?.message ?? err) }
  }
}

/**
 * Fetch full article metadata for a list of PMIDs via `efetch.fcgi`
 * (returns XML; parsed into a simple `{title, authors, abstract,...}` shape).
 *
 * @param {string[]} pmids
 */
export async function fetchArticlesByPmid(pmids) {
  if (!pmids?.length) return []
  const xml = await httpGet(`${BASE_URL}/efetch.fcgi`, {
    params: { db: 'pubmed', id: pmids.join(','), retmode: 'xml' },
    responseType: 'text',
    source: 'pubmed.efetch',
  })
  return parsePubmedXml(xml)
}

/** @param {string[]} pmids */
export async function getArticleMetadata(pmids) {
  try {
    return { articles: await fetchArticlesByPmid(pmids) }
  } catch (err) {
    return { articles: [], error: String(err?.message ?? err) }
  }
}

/**
 * Find related articles for a list of PMIDs via `elink.fcgi`.
 *
 * @param {object} opts
 * @param {string[]} opts.pmids
 * @param {string} [opts.link_type='pubmed_pubmed']
 * @param {number} [opts.max_results]
 */
export async function findRelatedArticles({ pmids, link_type = 'pubmed_pubmed', max_results }) {
  try {
    const data = await httpGet(`${BASE_URL}/elink.fcgi`, {
      params: {
        dbfrom: 'pubmed',
        db: 'pubmed',
        id: pmids.join(','),
        linkname: link_type,
        retmode: 'json',
      },
      source: 'pubmed.elink',
    })
    const related = []
    for (const ls of data?.linksets ?? []) {
      for (const lsdb of ls?.linksetdbs ?? []) {
        related.push(...(lsdb.links ?? []))
      }
    }
    return { related_articles: max_results ? related.slice(0, max_results) : related }
  } catch (err) {
    return { related_articles: [], error: String(err?.message ?? err) }
  }
}

/**
 * Toxicology-focused search: builds a MeSH-biased query, retrieves 3x the
 * requested limit, scores each article, sorts by relevance, and trims.
 * Functional equivalent of `PubMedService.search_toxicology_literature`.
 *
 * @param {object} opts
 * @param {string} opts.compound_name
 * @param {number} [opts.max_results=20]
 * @param {string} [opts.date_from]
 * @param {string} [opts.date_to]
 * @param {boolean} [opts.focus_on_risk_assessment=false]
 * @param {number} [opts.min_relevance_score=10]
 * @param {boolean} [opts.include_prefilter=true]
 */
export async function searchToxicologyLiterature({
  compound_name,
  max_results = 20,
  date_from,
  date_to,
  focus_on_risk_assessment = false,
  min_relevance_score = 10,
  include_prefilter = true,
}) {
  const query = buildToxicologyQuery(compound_name, {
    include_mesh: include_prefilter,
    focus_on_risk_assessment,
  })
  const fetchLimit = Math.min(max_results * 3, 100)
  const result = await searchArticles({
    query,
    max_results: fetchLimit,
    date_from,
    date_to,
    sort: 'relevance',
  })

  const scored = []
  for (const article of result.articles ?? []) {
    const score = calculateRelevanceScore(article, compound_name)
    if (score >= min_relevance_score) {
      scored.push({
        ...article,
        relevance_score: score,
        toxicology_focus: getToxicologyFocus(article),
      })
    }
  }
  scored.sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))

  return {
    query,
    compound_searched: compound_name,
    total_found: result.total_results ?? 0,
    total_relevant: scored.length,
    articles: scored.slice(0, max_results),
    filtering_applied: {
      mesh_prefilter: include_prefilter,
      risk_assessment_focus: focus_on_risk_assessment,
      min_relevance_score,
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Build a toxicology-focused query string with optional MeSH terms.
 *
 * @param {string} compound
 * @param {{ include_mesh?: boolean, focus_on_risk_assessment?: boolean }} [opts]
 */
function buildToxicologyQuery(compound, opts = {}) {
  const parts = [`("${compound}"[Title/Abstract] OR "${compound}"[MeSH Terms])`]
  if (opts.include_mesh) {
    const mesh = TOXICOLOGY_MESH_TERMS.map((t) => `"${t}"[MeSH Terms]`).join(' OR ')
    parts.push(`(${mesh})`)
  }
  if (opts.focus_on_risk_assessment) {
    parts.push('("risk assessment"[Title/Abstract] OR "tolerable intake"[Title/Abstract])')
  }
  parts.push('NOT (review[Publication Type] AND case reports[Publication Type])')
  return parts.join(' AND ')
}

/**
 * Quick toxicology relevance score (0–100). Weighted keyword counts in
 * title + abstract, with a small bonus when the compound name actually
 * appears.
 *
 * @param {Record<string, any>} article
 * @param {string} [compound]
 */
function calculateRelevanceScore(article, compound) {
  const text = `${article.title ?? ''} ${article.abstract ?? ''}`.toLowerCase()
  if (!text.trim()) return 0
  let score = 0
  for (const { kw, weight } of TOX_KEYWORD_WEIGHTS) {
    if (text.includes(kw)) score += weight
  }
  if (compound && text.includes(compound.toLowerCase())) score += 6
  return Math.min(score, 100)
}

/**
 * Categorise an article into a coarse list of toxicology focus areas
 * (e.g. carcinogenicity, hepatotoxicity). Used by the UI to render badges.
 *
 * @param {Record<string, any>} article
 */
function getToxicologyFocus(article) {
  const text = `${article.title ?? ''} ${article.abstract ?? ''}`.toLowerCase()
  const buckets = []
  if (/carcinog|tumour|tumor|neoplasm/.test(text)) buckets.push('carcinogenicity')
  if (/genotox|mutagen/.test(text)) buckets.push('genotoxicity')
  if (/hepato|liver/.test(text)) buckets.push('hepatotoxicity')
  if (/nephro|kidney/.test(text)) buckets.push('nephrotoxicity')
  if (/neurotox|neuro/.test(text)) buckets.push('neurotoxicity')
  if (/reproduc|developmental|teratog/.test(text)) buckets.push('reproductive_developmental')
  if (/immunotox|immune/.test(text)) buckets.push('immunotoxicity')
  if (/noael|loael|bmd|tdi|adi|rfd/.test(text)) buckets.push('reference_value')
  return buckets
}

/**
 * Convert a PubMed eFetch XML payload into a list of article objects.
 * Returns `[{ pmid, title, authors[], abstract, journal, publication_date, doi }]`.
 *
 * @param {string} xmlText
 */
async function parsePubmedXml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return []
  let parsed
  try {
    parsed = await xmlParser.parseStringPromise(xmlText)
  } catch (err) {
    console.warn(`[pubmed] XML parse failed: ${err}`)
    return []
  }
  const set = parsed?.PubmedArticleSet
  if (!set) return []

  const articles = []
  const items = Array.isArray(set.PubmedArticle) ? set.PubmedArticle : [set.PubmedArticle]
  for (const item of items) {
    if (!item) continue
    const citation = item.MedlineCitation ?? {}
    const article = citation.Article ?? {}
    const pmid = typeof citation.PMID === 'string' ? citation.PMID : citation.PMID?._

    // Authors
    const authorList = article.AuthorList?.Author
    const authors = []
    if (authorList) {
      const list = Array.isArray(authorList) ? authorList : [authorList]
      for (const a of list) {
        const last = a.LastName ?? a.CollectiveName ?? ''
        const initials = a.Initials ?? ''
        const full = [last, initials].filter(Boolean).join(' ').trim()
        if (full) authors.push(full)
      }
    }

    // Abstract may be a string or an array of `AbstractText` nodes with labels.
    const abstractNode = article.Abstract?.AbstractText
    let abstract = ''
    if (typeof abstractNode === 'string') {
      abstract = abstractNode
    } else if (Array.isArray(abstractNode)) {
      abstract = abstractNode
        .map((node) => {
          if (typeof node === 'string') return node
          const label = node.Label ?? node.label ?? ''
          const value = node._ ?? node.value ?? ''
          return label ? `${label}: ${value}` : value
        })
        .filter(Boolean)
        .join(' ')
    } else if (abstractNode && typeof abstractNode === 'object') {
      abstract = abstractNode._ ?? ''
    }

    // Publication date (Year/Month/Day or MedlineDate)
    const pd = article.Journal?.JournalIssue?.PubDate ?? {}
    const publicationDate = pd.MedlineDate ?? [pd.Year, pd.Month, pd.Day].filter(Boolean).join('-') ?? null

    // DOI (in PubmedData.ArticleIdList)
    const idList = item.PubmedData?.ArticleIdList?.ArticleId
    let doi = null
    if (idList) {
      const ids = Array.isArray(idList) ? idList : [idList]
      const doiNode = ids.find((id) => (id.IdType ?? id.idtype) === 'doi')
      if (doiNode) doi = doiNode._ ?? doiNode
    }

    articles.push({
      pmid,
      title: article.ArticleTitle?._ ?? article.ArticleTitle ?? '',
      authors,
      abstract,
      journal: article.Journal?.Title ?? null,
      publication_date: publicationDate || null,
      doi,
    })
  }
  return articles
}
