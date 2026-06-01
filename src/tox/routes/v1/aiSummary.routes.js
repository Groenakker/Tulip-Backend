/**
 * AI / LLM summary endpoints — mirrors `app/api/v1/endpoints/ai_summary.py`
 * + `llm_summary.py`. The Python service exposed both a "summary" and
 * "narrative" endpoint; we consolidate them here.
 */

import { Router } from 'express'
import { generateSummary } from '../../services/aiSummary.service.js'
import { asyncRoute } from '../../utils/routeHelpers.util.js'

const router = Router()

/**
 * POST /ai-summary/generate
 * Body: a dossier payload as built by the existing `reportBuilder.js`.
 * Returns: `{ ai_summary: { ... } }` augmented with LLM sections when
 * an Anthropic API key is configured.
 */
router.post(
  '/generate',
  asyncRoute(async (req, res) => {
    const dossier = req.body ?? {}
    if (!dossier || typeof dossier !== 'object') {
      return res.status(400).json({ detail: 'Body must be a dossier object (use /reports/generate to build one).' })
    }
    res.json({ ai_summary: await generateSummary(dossier) })
  }),
)

/**
 * GET /ai-summary/status
 * Whether an LLM provider is configured. The SPA uses this to decide
 * whether to render the "Generate narrative" button.
 */
router.get('/status', (_req, res) => {
  res.json({
    llm_configured: Boolean(process.env.ANTHROPIC_API_KEY),
    provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : null,
    fallback: 'deterministic_template',
  })
})

export default router
