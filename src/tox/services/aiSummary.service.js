/**
 * AI / LLM summary service.
 *
 * Mirrors `backend/app/services/ai_summary_service.py` +
 * `llm_summary_service.py`. The Python implementations used Anthropic
 * Claude when `ANTHROPIC_API_KEY` was configured and fell back to a
 * deterministic template-based summary otherwise.
 *
 * We follow the same contract here:
 *   - If `ANTHROPIC_API_KEY` is set we POST to `https://api.anthropic.com/v1/messages`.
 *   - Otherwise we render a structured summary from the dossier payload.
 */

import { httpPost } from './_httpClient.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'

/**
 * Generate an executive summary, detailed assessment and recommendations
 * for a compound dossier. `dossier` is the same JSON the
 * `/reports/generate` endpoint already builds (see `reportBuilder.js`).
 *
 * @param {object} dossier
 */
export async function generateSummary(dossier) {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (key) {
    try {
      return await callAnthropic(dossier, key)
    } catch (err) {
      // Surface failure mode but still return a deterministic summary so
      // the SPA renders something.
      return { ...templateSummary(dossier), llm_error: String(err?.message ?? err) }
    }
  }
  return templateSummary(dossier)
}

/* -------------------------------------------------------------------------- */

async function callAnthropic(dossier, apiKey) {
  const prompt = buildPrompt(dossier)
  const data = await httpPost(
    ANTHROPIC_URL,
    {
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      source: 'anthropic.summary',
      timeout: 60_000,
    },
  )
  const text = data?.content?.[0]?.text ?? ''
  return {
    ...templateSummary(dossier),
    llm_executive_summary: extractSection(text, 'Executive summary'),
    llm_detailed_assessment: extractSection(text, 'Detailed assessment'),
    llm_recommendations: extractSection(text, 'Recommendations'),
    llm_compound_overview: extractSection(text, 'Compound overview'),
    llm_assessment_outcomes: extractSection(text, 'Outcomes'),
  }
}

function buildPrompt(dossier) {
  const summary = dossier.summary ?? {}
  const ai = dossier.ai_summary ?? {}
  return [
    'You are a toxicology assistant. Summarise the following dossier in five labelled sections:',
    '1. Compound overview',
    '2. Executive summary',
    '3. Detailed assessment',
    '4. Outcomes',
    '5. Recommendations',
    '',
    'Use plain English, cite data sources where applicable, and stay under 350 words per section.',
    '',
    `Compound: ${ai.compound_name ?? dossier.query}`,
    `Data coverage: ${summary.compounds_found ?? 0} compounds, ${summary.literature_count ?? 0} literature hits, ${summary.trials_count ?? 0} trials.`,
    `Bioactivity rows: ${dossier.bioactivity?.total_results ?? 0}.`,
    `Risk flags: ${JSON.stringify(dossier.toxicity_profile ?? {}, null, 2)}`,
    `PoD assessment confidence: ${dossier.pod_assessment?.confidence ?? 'unknown'}.`,
  ].join('\n')
}

function extractSection(text, label) {
  if (!text) return null
  const re = new RegExp(`(?:^|\\n)\\s*(?:\\d+\\.|##?|\\*\\*?)?\\s*${label}.*?\\n([\\s\\S]+?)(?=\\n\\s*(?:\\d+\\.|##?|\\*\\*?)?\\s*(?:Compound overview|Executive summary|Detailed assessment|Outcomes|Recommendations)|$)`, 'i')
  const match = re.exec(text)
  return match ? match[1].trim() : null
}

/**
 * Deterministic fallback summary used when no LLM is available. Surfaces
 * the same fields the SPA expects (matches `ai_summary` shape from the
 * existing `reportBuilder.js`).
 */
function templateSummary(dossier) {
  const ai = dossier.ai_summary ?? {}
  const risk = dossier.toxicity_profile?.risk_level ?? 'low'
  return {
    compound_name: ai.compound_name ?? dossier.query,
    compound_class: ai.compound_class ?? 'Unclassified',
    chemical_family: ai.chemical_family ?? null,
    executive_summary:
      ai.executive_summary ??
      `Automated dossier for ${ai.compound_name ?? dossier.query}. Overall risk level assessed as ${risk}.`,
    compound_description:
      ai.compound_description ??
      'Compound description derived from upstream identifier-resolution sources (PubChem, ChEMBL, CompTox).',
    key_characteristics: ai.key_characteristics ?? [],
    regulatory_status: ai.regulatory_status ?? null,
    tox_signals: ai.tox_signals ?? [],
    safety_concerns: ai.safety_concerns ?? [],
    favorable_findings: ai.favorable_findings ?? [],
    overall_risk: risk,
    risk_rationale: ai.risk_rationale ?? 'Derived from upstream data coverage and bioactivity scan.',
    data_coverage_score: ai.data_coverage_score ?? scoreCoverage(dossier),
    data_sources_used: ai.data_sources_used ?? sourceCoverage(dossier),
    data_gaps: ai.data_gaps ?? [],
    recommendations: ai.recommendations ?? [
      'Layer in REACH IUCLID dump for full PoD coverage',
      'Configure ANTHROPIC_API_KEY for LLM-authored narratives',
    ],
  }
}

function scoreCoverage(dossier) {
  let score = 0
  if (dossier.bioactivity?.total_results) score += 15
  if (dossier.literature?.length) score += 15
  if (dossier.clinical_trials?.length) score += 10
  if (dossier.toxtree_predictions) score += 10
  if (dossier.echa_data) score += 20
  if (dossier.pubchem_data) score += 10
  if (dossier.comptox_data) score += 10
  return Math.min(score, 100)
}

function sourceCoverage(dossier) {
  const sources = ['ChemBL']
  if (dossier.pubchem_data) sources.push('PubChem')
  if (dossier.comptox_data) sources.push('CompTox')
  if (dossier.echa_data) sources.push('ECHA')
  if (dossier.literature?.length) sources.push('PubMed/bioRxiv')
  if (dossier.clinical_trials?.length) sources.push('ClinicalTrials.gov')
  if (dossier.toxtree_predictions) sources.push('Toxtree')
  return sources
}
