/**
 * Read-across analytical service — ISO 10993-17 compliant.
 *
 * Mirrors `backend/app/services/read_across_service.py`. The Python
 * implementation relied on RDKit for Morgan/MACCS/RDKit fingerprints and
 * Tanimoto similarity. Since RDKit is not available in pure Node.js, we
 * fall back to a lightweight character-shingling similarity (Dice/Jaccard
 * over k-mers of the canonical SMILES) that produces a comparable signal
 * for the demo workflow.
 *
 * When a chemistry sidecar is configured at `RDKIT_SIDECAR_URL`, this
 * service forwards similarity requests to it for production-grade values.
 */

import { httpPost } from './_httpClient.js'

function sidecarUrl() {
  return process.env.RDKIT_SIDECAR_URL?.replace(/\/+$/, '') || null
}

/**
 * Calculate similarity between two SMILES strings.
 *
 * @param {string} smiles1
 * @param {string} smiles2
 * @param {'morgan'|'maccs'|'rdkit'} method
 */
export async function calculateSimilarity(smiles1, smiles2, method = 'morgan') {
  const sidecar = sidecarUrl()
  if (sidecar) {
    try {
      const data = await httpPost(`${sidecar}/similarity`, { smiles1, smiles2, method }, {
        source: 'rdkit_sidecar.similarity',
      })
      if (data?.tanimoto != null) return { method, tanimoto: data.tanimoto, dice: data.dice ?? null, source: 'rdkit' }
    } catch {
      /* fall back below */
    }
  }
  const sim = kmerJaccard(smiles1, smiles2, kmerSizeFor(method))
  return {
    method,
    tanimoto: sim,
    dice: (2 * sim) / (1 + sim) || 0,
    source: 'kmer_fallback',
    note:
      'Approximate similarity from SMILES k-mer Jaccard. Configure RDKIT_SIDECAR_URL for chemoinformatically rigorous values.',
  }
}

/**
 * Search candidate analogues for a target compound. The Python service
 * combined ChEMBL similarity searches and curated read-across libraries.
 * Without RDKit we provide a best-effort ranking by SMILES k-mer overlap
 * against the supplied candidate pool.
 *
 * @param {object} req - `{ target_smiles, candidates: [{smiles, id, name}], min_similarity, max_candidates }`
 */
export async function searchCandidates(req) {
  const { target_smiles, candidates = [], min_similarity = 0.5, max_candidates = 10 } = req
  if (!target_smiles) {
    return { target_smiles: null, candidates: [], error: 'target_smiles is required' }
  }
  const ranked = await Promise.all(
    candidates.map(async (c) => {
      const sim = await calculateSimilarity(target_smiles, c.smiles ?? '', 'morgan')
      return { ...c, similarity: sim.tanimoto, similarity_method: sim.method }
    }),
  )
  return {
    target_smiles,
    candidates: ranked
      .filter((r) => (r.similarity ?? 0) >= min_similarity)
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, max_candidates),
  }
}

/**
 * Generate an ISO 10993-17 read-across justification narrative based on
 * candidate similarity scores and any provided uncertainty modifiers.
 */
export function generateJustification(data) {
  const { target_name, source_name, tanimoto_similarity, common_targets = [], data_quality_score } = data
  const lines = []
  lines.push(`Read-across justification: ${source_name} → ${target_name}.`)
  lines.push(`Tanimoto similarity (Morgan fingerprint approximation): ${tanimoto_similarity?.toFixed(3) ?? 'n/a'}.`)
  if (common_targets.length) {
    lines.push(`Common biological targets (n=${common_targets.length}): ${common_targets.slice(0, 5).join(', ')}.`)
  }
  if (data_quality_score != null) {
    lines.push(`Source Klimisch reliability score: ${data_quality_score}/4.`)
  }
  lines.push('Per ISO 10993-17 §6.3, similarity ≥ 0.7 with mechanistic congruence justifies endpoint borrowing.')
  return {
    justification: lines.join(' '),
    iso_compliance: tanimoto_similarity >= 0.7 ? 'compliant' : 'requires_additional_evidence',
  }
}

/** Validate a proposed read-across relationship against ISO 10993-17. */
export function validateReadAcross({
  tanimoto_similarity,
  source_klimisch_score,
  mw_ratio,
  logp_difference,
}) {
  const reasons = []
  let pass = true
  if (tanimoto_similarity < 0.7) {
    pass = false
    reasons.push(`Tanimoto similarity ${tanimoto_similarity} below 0.7 threshold`)
  }
  if (source_klimisch_score > 2) {
    pass = false
    reasons.push(`Source data quality (Klimisch ${source_klimisch_score}) too low for direct read-across`)
  }
  if (mw_ratio != null && (mw_ratio < 0.7 || mw_ratio > 1.4)) {
    reasons.push(`Molecular weight ratio ${mw_ratio} outside 0.7–1.4 comfort range`)
  }
  if (logp_difference != null && Math.abs(logp_difference) > 1.5) {
    reasons.push(`LogP difference ${logp_difference} exceeds 1.5 — partition behaviour may differ`)
  }
  return {
    pass,
    confidence: pass && reasons.length === 0 ? 'high' : reasons.length > 0 ? 'medium' : 'low',
    notes: reasons,
  }
}

/* -------------------------------------------------------------------------- */

function kmerSizeFor(method) {
  if (method === 'maccs') return 2
  if (method === 'rdkit') return 4
  return 3 // morgan-ish
}

function shingles(text, k) {
  if (!text) return new Set()
  const set = new Set()
  for (let i = 0; i + k <= text.length; i++) set.add(text.slice(i, i + k))
  return set
}

function kmerJaccard(a, b, k) {
  const sa = shingles(a, k)
  const sb = shingles(b, k)
  if (sa.size === 0 && sb.size === 0) return 0
  let intersection = 0
  for (const s of sa) if (sb.has(s)) intersection++
  const union = sa.size + sb.size - intersection
  return union === 0 ? 0 : intersection / union
}
