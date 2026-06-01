/**
 * SerpApi web-search endpoints — mirrors `app/api/v1/endpoints/websearch.py`.
 */

import { Router } from 'express'
import * as serpapi from '../../services/serpapi.service.js'
import { asyncRoute, parseIntParam } from '../../utils/routeHelpers.util.js'

const router = Router()

function requireKey(res) {
  if (!serpapi.serpApiKey()) {
    res
      .status(503)
      .json({ detail: 'SerpApi key not configured. Set SERPAPI_KEY environment variable.' })
    return false
  }
  return true
}

router.get(
  '/toxicology',
  asyncRoute(async (req, res) => {
    if (!requireKey(res)) return
    const compound = String(req.query.compound ?? '')
    if (!compound) return res.status(400).json({ detail: 'compound is required' })
    res.json(
      await serpapi.searchToxicologyReports({
        compound_name: compound,
        cas_number: req.query.cas_number ? String(req.query.cas_number) : undefined,
        include_sds: req.query.include_sds !== 'false',
        include_regulatory: req.query.include_regulatory !== 'false',
        include_publications: req.query.include_publications !== 'false',
        num_results: parseIntParam(req.query.num_results, 30, { min: 5, max: 100 }),
      }),
    )
  }),
)

router.get(
  '/regulatory/:report_type',
  asyncRoute(async (req, res) => {
    const valid = ['atsdr', 'iris', 'efsa', 'who', 'iarc', 'ntp', 'fda', 'echa', 'inchem']
    if (!valid.includes(req.params.report_type.toLowerCase())) {
      return res.status(400).json({ detail: `Invalid report type. Valid: ${valid.join(', ')}` })
    }
    if (!requireKey(res)) return
    const compound = String(req.query.compound ?? '')
    if (!compound) return res.status(400).json({ detail: 'compound is required' })
    const results = await serpapi.searchSpecificReportType({
      compound_name: compound,
      report_type: req.params.report_type,
      cas_number: req.query.cas_number ? String(req.query.cas_number) : undefined,
      num_results: parseIntParam(req.query.num_results, 20, { min: 5, max: 50 }),
    })
    res.json({ query: compound, report_type: req.params.report_type.toUpperCase(), total_results: results.length, results })
  }),
)

router.get(
  '/scholar',
  asyncRoute(async (req, res) => {
    if (!requireKey(res)) return
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'query is required' })
    const results = await serpapi.searchGoogleScholar({ query: q, num_results: parseIntParam(req.query.num_results, 20, { min: 5, max: 50 }) })
    res.json({ query: q, report_type: 'Google Scholar', total_results: results.length, results })
  }),
)

router.get(
  '/sds',
  asyncRoute(async (req, res) => {
    if (!requireKey(res)) return
    const compound = String(req.query.compound ?? '')
    if (!compound) return res.status(400).json({ detail: 'compound is required' })
    const cas = req.query.cas_number ? String(req.query.cas_number) : ''
    const query = cas
      ? `"${cas}" "safety data sheet" OR "SDS" filetype:pdf`
      : `"${compound}" "safety data sheet" OR "SDS" filetype:pdf`
    const results = await serpapi.executeSearch(query, parseIntParam(req.query.num_results, 15, { min: 5, max: 30 }))
    res.json({
      query: cas ? `${compound} (${cas})` : compound,
      search_type: 'Safety Data Sheets',
      total_results: results.length,
      results,
    })
  }),
)

router.get('/info', (_req, res) => {
  res.json({
    description: 'Structured Google search for toxicology reports and safety data',
    powered_by: 'SerpApi (Google Search API)',
    configured: Boolean(serpapi.serpApiKey()),
    search_types: {
      toxicology: 'Comprehensive search across all sources',
      regulatory: 'Targeted regulatory agency searches',
      scholar: 'Google Scholar academic publications',
      sds: 'Safety Data Sheets from chemical suppliers',
    },
  })
})

export default router
