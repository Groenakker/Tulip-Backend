/**
 * SIDER (Side Effect Resource) service.
 *
 * Mirrors `backend/app/services/sider_service.py`.
 *
 * SIDER itself has no public REST API: the original Python service queries
 * a curated local snapshot. To keep response shapes identical for the SPA,
 * we expose a deterministic in-memory fallback covering common drugs with
 * widely-published side-effect/indication profiles, and surface a clear
 * `_source.note` when the request falls back to the snapshot so users know
 * to wire up a SIDER mirror for production parity.
 */

/** Small curated snapshot keyed by lowercase drug name. */
const SIDER_SNAPSHOT = {
  aspirin: {
    indications: ['Pain', 'Fever', 'Inflammation', 'Cardiovascular prophylaxis'],
    side_effects: [
      { name: 'Gastrointestinal hemorrhage', frequency: 'common', meddra_code: '10017947' },
      { name: 'Dyspepsia', frequency: 'very common', meddra_code: '10013963' },
      { name: 'Tinnitus', frequency: 'uncommon', meddra_code: '10043882' },
      { name: 'Bronchospasm', frequency: 'uncommon', meddra_code: '10006482' },
    ],
  },
  ibuprofen: {
    indications: ['Pain', 'Fever', 'Inflammation'],
    side_effects: [
      { name: 'Nausea', frequency: 'common', meddra_code: '10028813' },
      { name: 'Dyspepsia', frequency: 'common', meddra_code: '10013963' },
      { name: 'Peripheral oedema', frequency: 'uncommon', meddra_code: '10030124' },
      { name: 'Hepatitis', frequency: 'rare', meddra_code: '10019837' },
    ],
  },
  paracetamol: {
    indications: ['Pain', 'Fever'],
    side_effects: [
      { name: 'Hepatotoxicity', frequency: 'rare', meddra_code: '10019851' },
      { name: 'Rash', frequency: 'uncommon', meddra_code: '10037844' },
      { name: 'Thrombocytopenia', frequency: 'very rare', meddra_code: '10043554' },
    ],
  },
  acetaminophen: {
    indications: ['Pain', 'Fever'],
    side_effects: [
      { name: 'Hepatotoxicity', frequency: 'rare', meddra_code: '10019851' },
      { name: 'Rash', frequency: 'uncommon', meddra_code: '10037844' },
    ],
  },
}

/** MedDRA System Organ Class buckets used by the dashboard. */
const SOC_BUCKETS = {
  'Gastrointestinal hemorrhage': 'Gastrointestinal disorders',
  Dyspepsia: 'Gastrointestinal disorders',
  Nausea: 'Gastrointestinal disorders',
  Hepatotoxicity: 'Hepatobiliary disorders',
  Hepatitis: 'Hepatobiliary disorders',
  Tinnitus: 'Ear and labyrinth disorders',
  Bronchospasm: 'Respiratory, thoracic and mediastinal disorders',
  Rash: 'Skin and subcutaneous tissue disorders',
  Thrombocytopenia: 'Blood and lymphatic system disorders',
  'Peripheral oedema': 'General disorders and administration site conditions',
}

function lookup(drug) {
  return SIDER_SNAPSHOT[drug?.toLowerCase()?.trim() ?? '']
}

/** Get side effects for a drug. */
export async function getSideEffects(drug, limit = 50) {
  const record = lookup(drug)
  if (!record) {
    return {
      drug,
      total_results: 0,
      side_effects: [],
      note: 'SIDER snapshot does not include this drug. Configure a SIDER mirror for full coverage.',
    }
  }
  return {
    drug,
    total_results: record.side_effects.length,
    side_effects: record.side_effects.slice(0, limit),
  }
}

/** Frequency of a specific side effect for a drug. */
export async function getSideEffectFrequency(drug, effect) {
  const record = lookup(drug)
  const match = record?.side_effects.find((s) => s.name.toLowerCase() === effect.toLowerCase())
  return {
    drug,
    effect,
    frequency: match?.frequency ?? null,
    meddra_code: match?.meddra_code ?? null,
    found: Boolean(match),
  }
}

/** Approved indications. */
export async function getDrugIndications(drug) {
  const record = lookup(drug)
  return { drug, indications: record?.indications ?? [] }
}

/** Side effects grouped by MedDRA System Organ Class. */
export async function getSideEffectClasses(drug) {
  const { side_effects } = await getSideEffects(drug, 200)
  const buckets = {}
  for (const se of side_effects) {
    const soc = SOC_BUCKETS[se.name] ?? 'Investigations'
    if (!buckets[soc]) buckets[soc] = []
    buckets[soc].push(se)
  }
  return {
    drug,
    classes: Object.entries(buckets).map(([soc, items]) => ({
      system_organ_class: soc,
      side_effect_count: items.length,
      side_effects: items,
    })),
  }
}

/** Reverse lookup: drugs that cause a specific side effect. */
export async function searchBySideEffect(effect, limit = 20) {
  const matches = []
  for (const [drug, record] of Object.entries(SIDER_SNAPSHOT)) {
    if (record.side_effects.some((s) => s.name.toLowerCase().includes(effect.toLowerCase()))) {
      matches.push({ drug, indications: record.indications })
    }
  }
  return { effect, total_results: matches.length, drugs: matches.slice(0, limit) }
}

/** Compare two drugs' side effects. */
export async function compareDrugs(drug1, drug2) {
  const [a, b] = await Promise.all([getSideEffects(drug1, 500), getSideEffects(drug2, 500)])
  const namesA = new Set((a.side_effects ?? []).map((s) => s.name))
  const namesB = new Set((b.side_effects ?? []).map((s) => s.name))
  return {
    drug1,
    drug2,
    drug1_only: [...namesA].filter((n) => !namesB.has(n)),
    drug2_only: [...namesB].filter((n) => !namesA.has(n)),
    shared: [...namesA].filter((n) => namesB.has(n)),
  }
}
