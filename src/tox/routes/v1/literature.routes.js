/**
 * Literature endpoints — PubMed + bioRxiv / medRxiv.
 *
 * Mirrors `app/api/v1/endpoints/literature.py`. Supports unified search,
 * direct PubMed lookups by PMID, preprint lookups by DOI, and category
 * listings. Auth is intentionally omitted per project scope.
 */

import { Router } from 'express'
import * as pubmed from '../../services/pubmed.service.js'
import * as biorxiv from '../../services/biorxiv.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

/**
 * GET /literature/search
 * Combined search across PubMed and bioRxiv/medRxiv.
 */
router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const query = String(req.query.query ?? '').trim()
    if (!query) return res.status(400).json({ detail: 'Missing required query parameter `query`' })

    const sources = String(req.query.sources ?? 'pubmed,biorxiv')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const limit = parseIntParam(req.query.limit, 20, { min: 1, max: 100 })
    const dateFrom = req.query.date_from ? String(req.query.date_from) : undefined
    const dateTo = req.query.date_to ? String(req.query.date_to) : undefined

    const results = []
    let pubmedCount = 0
    let preprintCount = 0

    if (sources.includes('pubmed')) {
      const pubmedDateFrom = dateFrom ? dateFrom.replace(/-/g, '/') : undefined
      const pubmedDateTo = dateTo ? dateTo.replace(/-/g, '/') : undefined
      const r = await pubmed.searchArticles({
        query,
        max_results: limit,
        date_from: pubmedDateFrom,
        date_to: pubmedDateTo,
      })
      for (const article of r.articles ?? []) {
        results.push({
          id: `pubmed:${article.pmid}`,
          title: article.title,
          authors: article.authors,
          publication_date: article.publication_date,
          abstract: article.abstract,
          source: 'pubmed',
          url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
          doi: article.doi,
        })
      }
      pubmedCount = r.articles?.length ?? 0
    }

    if (sources.includes('biorxiv')) {
      const r = await biorxiv.searchPreprints({ server: 'biorxiv', date_from: dateFrom, date_to: dateTo, limit })
      for (const p of r.preprints ?? []) {
        results.push({
          id: `biorxiv:${p.doi}`,
          title: p.title,
          authors: p.authors,
          publication_date: p.publication_date,
          abstract: p.abstract,
          source: 'biorxiv',
          url: p.url,
          doi: p.doi,
        })
      }
      preprintCount += r.preprints?.length ?? 0
    }

    if (sources.includes('medrxiv')) {
      const r = await biorxiv.searchPreprints({ server: 'medrxiv', date_from: dateFrom, date_to: dateTo, limit })
      for (const p of r.preprints ?? []) {
        results.push({
          id: `medrxiv:${p.doi}`,
          title: p.title,
          authors: p.authors,
          publication_date: p.publication_date,
          abstract: p.abstract,
          source: 'medrxiv',
          url: `https://www.medrxiv.org/content/${p.doi}`,
          doi: p.doi,
        })
      }
      preprintCount += r.preprints?.length ?? 0
    }

    res.json({
      query,
      total_results: results.length,
      pubmed_count: pubmedCount,
      preprint_count: preprintCount,
      results,
    })
  }),
)

/** GET /literature/pubmed/:pmid */
router.get(
  '/pubmed/:pmid',
  asyncRoute(async (req, res) => {
    const { articles } = await pubmed.getArticleMetadata([req.params.pmid])
    if (!articles?.length) {
      return res.status(404).json({ detail: `Article ${req.params.pmid} not found` })
    }
    res.json(articles[0])
  }),
)

/**
 * GET /literature/preprint/*doi
 * DOIs contain slashes (e.g. 10.1101/2024.01.02.123456) so we use the
 * Express 5 named-wildcard syntax `*doi`; the segments after `preprint/`
 * are reassembled into a single DOI string.
 */
router.get(
  '/preprint/*doi',
  asyncRoute(async (req, res) => {
    const raw = req.params.doi
    const doi = Array.isArray(raw) ? raw.join('/') : String(raw ?? '')
    const server = String(req.query.server ?? 'biorxiv')
    const r = await biorxiv.getPreprint(doi, server)
    if (!r) return res.status(404).json({ detail: `Preprint ${doi} not found` })
    res.json(r)
  }),
)

/** GET /literature/categories */
router.get(
  '/categories',
  asyncRoute(async (_req, res) => {
    res.json({ categories: await biorxiv.getCategories() })
  }),
)

/** POST /literature/related — find related PubMed articles for a list of PMIDs */
router.post(
  '/related',
  asyncRoute(async (req, res) => {
    const pmids = Array.isArray(req.body?.pmids) ? req.body.pmids : []
    const max = parseIntParam(req.body?.max_results, undefined)
    res.json(await pubmed.findRelatedArticles({ pmids, max_results: max }))
  }),
)

/** GET /literature/toxicology-search — toxicology-focused PubMed search */
router.get(
  '/toxicology-search',
  asyncRoute(async (req, res) => {
    const compound = String(req.query.compound ?? '').trim()
    if (!compound) return res.status(400).json({ detail: 'Missing required query parameter `compound`' })
    res.json(
      await pubmed.searchToxicologyLiterature({
        compound_name: compound,
        max_results: parseIntParam(req.query.max_results, 20, { min: 1, max: 100 }),
        date_from: req.query.date_from ? String(req.query.date_from) : undefined,
        date_to: req.query.date_to ? String(req.query.date_to) : undefined,
        focus_on_risk_assessment: req.query.focus_on_risk_assessment === 'true',
        min_relevance_score: Number(req.query.min_relevance_score ?? 10),
        include_prefilter: req.query.include_prefilter !== 'false',
      }),
    )
  }),
)

export default router
