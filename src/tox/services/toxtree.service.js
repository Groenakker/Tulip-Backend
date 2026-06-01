/**
 * Toxtree QSAR predictions service.
 *
 * Mirrors `backend/app/services/toxtree_service.py` + `toxtree_estimators.py`.
 *
 * Toxtree itself is a desktop Java tool. The Python service ran it
 * indirectly via the AMBIT REST API. AMBIT can sometimes be unreliable,
 * so the Python implementation also fell back to a SMARTS-pattern
 * estimator. We reproduce both behaviours in JS:
 *
 *   - When `AMBIT_API_BASE` is configured we POST to it (`/algorithm/...`).
 *   - Otherwise we use a lightweight built-in estimator that classifies
 *     compounds via simple regex/substring SMILES heuristics. Results are
 *     marked `prediction_source: 'heuristic'` so the UI can show a badge.
 *
 * The shapes returned here match the FastAPI `*PredictionResponse`
 * Pydantic models 1:1 so React components don't change.
 */

import { httpPost } from './_httpClient.js'

function ambitBase() {
  return process.env.AMBIT_API_BASE?.replace(/\/+$/, '') || null
}

/**
 * Run every available prediction module for a SMILES string.
 *
 * @param {string} smiles
 * @param {string|null} [compoundName]
 */
export async function predictAll(smiles, compoundName = null) {
  const [cramer, mutagenicity, carcinogenicity, skinSens, skinIrr, eyeIrr] = await Promise.all([
    predictCramer(smiles),
    predictMutagenicity(smiles),
    predictCarcinogenicity(smiles),
    predictSkinSensitization(smiles),
    predictSkinIrritation(smiles),
    predictEyeIrritation(smiles),
  ])
  return {
    smiles,
    compound_name: compoundName,
    cramer,
    mutagenicity,
    carcinogenicity,
    skin_sensitization: skinSens,
    skin_irritation: skinIrr,
    eye_irritation: eyeIrr,
    prediction_source: ambitBase() ? 'Toxtree/AMBIT' : 'heuristic',
  }
}

/* -------------------------------------------------------------------------- */
/*  Module predictors                                                         */
/* -------------------------------------------------------------------------- */

export async function predictCramer(smiles) {
  const live = await callAmbit('Cramer', smiles)
  if (live) {
    const cls = String(live.cramer_class ?? live['Cramer rules'] ?? 'III').replace(/^Class\s*/i, '')
    return classifyCramer(cls, smiles, true)
  }
  // Heuristic: heteroatom-heavy or alert-bearing structures bump the class.
  const cls = heuristicCramerClass(smiles)
  return classifyCramer(cls, smiles, false)
}

export async function predictMutagenicity(smiles) {
  const live = await callAmbit('Ames', smiles)
  if (live) {
    return shapeMutagenicity(live.prediction ?? 'Inconclusive', live.alerts ?? [], true)
  }
  const alerts = detectAlerts(smiles, MUTAGEN_ALERTS)
  return shapeMutagenicity(alerts.length ? 'Positive' : 'Negative', alerts, false)
}

export async function predictCarcinogenicity(smiles) {
  const live = await callAmbit('ISSCAN', smiles)
  if (live) {
    const isCarcinogen = Boolean(live.is_carcinogen)
    return shapeCarcinogenicity(isCarcinogen, live.alerts ?? [], true)
  }
  const alerts = detectAlerts(smiles, CARCINOGEN_ALERTS)
  return shapeCarcinogenicity(alerts.length > 0, alerts, false)
}

export async function predictSkinSensitization(smiles) {
  const live = await callAmbit('SkinSensitisation', smiles)
  if (live) return shapeSkinSensitization(live, true)
  const alerts = detectAlerts(smiles, SKIN_SENS_ALERTS)
  return {
    is_sensitizer: alerts.length > 0,
    reactivity_domain: alerts[0]?.domain ?? 'none',
    mechanism: alerts[0]?.mechanism ?? null,
    structural_alerts: alerts,
    potency_class: alerts.length ? 'moderate' : null,
    confidence: 'low',
  }
}

export async function predictSkinIrritation(smiles) {
  const live = await callAmbit('SkinIrritation', smiles)
  if (live) return shapeIrritation(live, true)
  const alerts = detectAlerts(smiles, IRRITATION_ALERTS)
  return shapeIrritation({ is_irritant: alerts.length > 0, severity: alerts.length ? 'Mild' : 'Non-irritant', alerts }, false)
}

export async function predictEyeIrritation(smiles) {
  const live = await callAmbit('EyeIrritation', smiles)
  if (live) return shapeIrritation(live, true)
  const alerts = detectAlerts(smiles, IRRITATION_ALERTS)
  return shapeIrritation({ is_irritant: alerts.length > 0, severity: alerts.length ? 'Moderate' : 'Non-irritant', alerts }, false)
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

async function callAmbit(algorithm, smiles) {
  const base = ambitBase()
  if (!base) return null
  try {
    const result = await httpPost(`${base}/algorithm/${algorithm}`, { smiles }, {
      source: `ambit.${algorithm}`,
      timeout: 45_000,
    })
    return result ?? null
  } catch {
    return null
  }
}

/** Cramer classification — Class I/II/III decision tree (very abridged heuristic). */
function heuristicCramerClass(smiles) {
  if (!smiles) return 'III'
  const s = smiles
  // Highly reactive / known toxic substructures => Class III
  if (/N\(=O\)=O|N\+\(=O\)\[O-\]/.test(s)) return 'III' // nitro
  if (/c1ccc[nH]c1|c1cccs1|c1ccon1/.test(s)) return 'III' // heteroaromatics
  if (/N=N|N#N/.test(s)) return 'III'                     // azo / diazo
  if (/Cl|Br|I/.test(s) && /C\(=O\)|C=O/.test(s)) return 'III' // acyl halide-like
  // Simple aliphatic / common biological molecules => Class I
  if (/^[CcNnOo()0-9]+$/.test(s) && s.length < 30) return 'I'
  return 'II'
}

function classifyCramer(cls, smiles, fromLive) {
  const ttc = { I: 1800, II: 540, III: 90 }
  const description = {
    I: 'Low toxicity (Cramer Class I)',
    II: 'Intermediate (Cramer Class II)',
    III: 'High concern (Cramer Class III)',
  }
  return {
    cramer_class: cls,
    cramer_class_description: description[cls] ?? description.III,
    decision_path: [`Heuristic SMILES analysis: ${smiles}`],
    structural_features: [],
    ttc_value: ttc[cls] ?? 90,
    confidence: fromLive ? 'high' : 'low',
  }
}

function shapeMutagenicity(prediction, alerts, fromLive) {
  return {
    prediction,
    structural_alerts: alerts.map(mapAlert),
    alert_count: alerts.length,
    confidence: fromLive ? 'high' : 'low',
    benigni_bossa_rules: alerts.filter((a) => a.source === 'benigni_bossa').map((a) => a.name),
  }
}

function shapeCarcinogenicity(isCarcinogen, alerts, fromLive) {
  const genotoxic = alerts.some((a) => a.genotoxic)
  return {
    is_carcinogen: isCarcinogen,
    genotoxic_carcinogen: isCarcinogen && genotoxic,
    nongenotoxic_carcinogen: isCarcinogen && !genotoxic,
    structural_alerts: alerts.map(mapAlert),
    iss_rules_triggered: alerts.map((a) => a.name),
    confidence: fromLive ? 'high' : 'low',
  }
}

function shapeSkinSensitization(raw, fromLive) {
  return {
    is_sensitizer: Boolean(raw.is_sensitizer),
    reactivity_domain: raw.reactivity_domain ?? 'unknown',
    mechanism: raw.mechanism ?? null,
    structural_alerts: (raw.alerts ?? []).map(mapAlert),
    potency_class: raw.potency_class ?? null,
    confidence: fromLive ? 'high' : 'low',
  }
}

function shapeIrritation(raw, fromLive) {
  return {
    is_irritant: Boolean(raw.is_irritant),
    severity: raw.severity ?? null,
    structural_alerts: (raw.alerts ?? []).map(mapAlert),
    confidence: fromLive ? 'high' : 'low',
  }
}

function mapAlert(a) {
  return {
    name: a.name ?? a.label ?? 'alert',
    description: a.description ?? null,
    pattern: a.smarts ?? a.pattern ?? null,
    domain: a.domain ?? null,
    genotoxic: a.genotoxic ?? null,
  }
}

/* Substructure alerts used by the heuristic estimator. The patterns are
   simple regex over SMILES, not real SMARTS — they're intentionally
   conservative and only used as a fallback. */
const MUTAGEN_ALERTS = [
  { name: 'aromatic_nitro', pattern: 'c[N+](=O)[O-]', genotoxic: true, source: 'benigni_bossa' },
  { name: 'azo_group', pattern: 'N=N', genotoxic: true, source: 'benigni_bossa' },
  { name: 'alkyl_halide', pattern: '[CH2,CH3][Cl,Br,I]', genotoxic: true, source: 'benigni_bossa' },
  { name: 'hydrazine', pattern: 'N-N', genotoxic: true, source: 'benigni_bossa' },
  { name: 'epoxide', pattern: 'C1OC1', genotoxic: true, source: 'benigni_bossa' },
]

const CARCINOGEN_ALERTS = [
  { name: 'aromatic_amine', pattern: 'cN', genotoxic: true },
  { name: 'aromatic_nitro', pattern: 'c[N+](=O)[O-]', genotoxic: true },
  { name: 'nitrosamine', pattern: 'N-N=O', genotoxic: true },
]

const SKIN_SENS_ALERTS = [
  { name: 'michael_acceptor', pattern: 'C=CC(=O)', domain: 'Michael acceptor', mechanism: 'Michael addition' },
  { name: 'aldehyde', pattern: 'C=O', domain: 'Schiff base', mechanism: 'Schiff base formation' },
  { name: 'acyl_halide', pattern: 'C(=O)Cl', domain: 'Acylation', mechanism: 'Acylation' },
  { name: 'alkyl_halide', pattern: 'C[Cl,Br,I]', domain: 'SN2', mechanism: 'SN2 reaction' },
]

const IRRITATION_ALERTS = [
  { name: 'strong_acid', pattern: 'C(=O)O' },
  { name: 'amine', pattern: 'N' },
  { name: 'sulfonate', pattern: 'S(=O)(=O)O' },
]

function detectAlerts(smiles, table) {
  if (!smiles) return []
  return table
    .filter((a) => smilesContains(smiles, a.pattern))
    .map((a) => ({ ...a, smarts: a.pattern }))
}

/**
 * Best-effort "does this SMILES contain this substructure" check. We turn
 * the canonical SMARTS-ish pattern into a tolerant regex and search the
 * SMILES string. This is not chemically rigorous; it's meant to keep the
 * heuristic predictor cheap and dependency-free.
 */
function smilesContains(smiles, pattern) {
  if (!pattern) return false
  let regexSource = pattern
    // [Cl,Br,I] -> [ClBrI] for a regex (best-effort)
    .replace(/\[([^\]]+)\]/g, (_, body) => `[${body.replace(/,/g, '')}]`)
  try {
    return new RegExp(regexSource, 'i').test(smiles)
  } catch {
    return smiles.includes(pattern)
  }
}
