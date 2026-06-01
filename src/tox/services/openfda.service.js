/**
 * openFDA / FAERS service.
 *
 * Mirrors `backend/app/services/openfda_service.py`. openFDA exposes
 * FAERS adverse event reports through Elasticsearch-like queries on
 * https://api.fda.gov/drug/event.json.
 *
 * No API key required for ≤240 req/min; an `OPENFDA_API_KEY` env var
 * raises the limit to 120k/day.
 */

import { httpGet } from './_httpClient.js'

const BASE_URL = 'https://api.fda.gov/drug/event.json'

function apiKey() {
  return process.env.OPENFDA_API_KEY?.trim() || undefined
}

/**
 * Search adverse event reports for a drug.
 *
 * @param {object} opts
 * @param {string} opts.drug_name
 * @param {number} [opts.limit=100]
 * @param {boolean|null} [opts.serious]
 */
export async function searchAdverseEvents({ drug_name, limit = 100, serious = null }) {
  try {
    const searchClauses = [
      `(patient.drug.medicinalproduct:"${drug_name}" OR patient.drug.openfda.generic_name:"${drug_name}" OR patient.drug.openfda.brand_name:"${drug_name}")`,
    ]
    if (serious === true) searchClauses.push('serious:1')
    else if (serious === false) searchClauses.push('serious:2')

    const data = await httpGet(BASE_URL, {
      params: { search: searchClauses.join(' AND '), limit: Math.min(limit, 100), api_key: apiKey() },
      source: 'openfda.search',
    })
    return {
      drug: drug_name,
      total_results: data?.meta?.results?.total ?? 0,
      reports: (data?.results ?? []).map(mapReport),
    }
  } catch (err) {
    return { drug: drug_name, total_results: 0, reports: [], error: String(err?.message ?? err) }
  }
}

/** Count adverse reactions for a drug, sorted by frequency. */
export async function getReactionCounts(drug, limit = 25) {
  try {
    const data = await httpGet(BASE_URL, {
      params: {
        search: `(patient.drug.medicinalproduct:"${drug}" OR patient.drug.openfda.generic_name:"${drug}")`,
        count: 'patient.reaction.reactionmeddrapt.exact',
        limit,
        api_key: apiKey(),
      },
      source: 'openfda.count_reactions',
    })
    const results = data?.results ?? []
    const total = results.reduce((sum, r) => sum + (r.count ?? 0), 0)
    const reactions = results.map((r) => ({
      term: r.term,
      count: r.count,
      percentage: total ? Number(((r.count / total) * 100).toFixed(2)) : 0,
    }))
    return { drug, total_reports_analyzed: total, reactions }
  } catch (err) {
    return { drug, total_reports_analyzed: 0, reactions: [], error: String(err?.message ?? err) }
  }
}

/** Serious-outcome breakdown for a drug (deaths, hospitalisations, etc.). */
export async function getOutcomeStatistics(drug) {
  try {
    const data = await httpGet(BASE_URL, {
      params: {
        search: `(patient.drug.medicinalproduct:"${drug}" OR patient.drug.openfda.generic_name:"${drug}")`,
        count: 'patient.reaction.reactionoutcome',
        api_key: apiKey(),
      },
      source: 'openfda.outcomes',
    })
    const codes = {
      1: 'recovered',
      2: 'recovering',
      3: 'not_recovered',
      4: 'recovered_with_sequelae',
      5: 'fatal',
      6: 'unknown',
    }
    const outcomes = {}
    for (const row of data?.results ?? []) {
      outcomes[codes[row.term] ?? `code_${row.term}`] = row.count
    }
    return { drug, outcomes }
  } catch (err) {
    return { drug, outcomes: {}, error: String(err?.message ?? err) }
  }
}

/** Age / sex demographics. */
export async function getDemographics(drug) {
  try {
    const [age, sex] = await Promise.all([
      httpGet(BASE_URL, {
        params: {
          search: `(patient.drug.medicinalproduct:"${drug}")`,
          count: 'patient.patientonsetage',
          api_key: apiKey(),
        },
        source: 'openfda.demo.age',
      }).catch(() => null),
      httpGet(BASE_URL, {
        params: {
          search: `(patient.drug.medicinalproduct:"${drug}")`,
          count: 'patient.patientsex',
          api_key: apiKey(),
        },
        source: 'openfda.demo.sex',
      }).catch(() => null),
    ])
    return {
      drug,
      ages: age?.results ?? [],
      sex: (sex?.results ?? []).map((s) => ({
        sex: { 0: 'unknown', 1: 'male', 2: 'female' }[s.term] ?? `code_${s.term}`,
        count: s.count,
      })),
    }
  } catch (err) {
    return { drug, ages: [], sex: [], error: String(err?.message ?? err) }
  }
}

/** Time series of reports (year-month). */
export async function getTimeSeries(drug, dateField = 'receivedate') {
  try {
    const data = await httpGet(BASE_URL, {
      params: {
        search: `(patient.drug.medicinalproduct:"${drug}")`,
        count: dateField,
        api_key: apiKey(),
      },
      source: `openfda.timeseries.${dateField}`,
    })
    return { drug, series: data?.results ?? [] }
  } catch (err) {
    return { drug, series: [], error: String(err?.message ?? err) }
  }
}

/** Drugs frequently co-mentioned with this drug in adverse events. */
export async function getDrugInteractions(drug, limit = 20) {
  try {
    const data = await httpGet(BASE_URL, {
      params: {
        search: `(patient.drug.medicinalproduct:"${drug}")`,
        count: 'patient.drug.openfda.generic_name.exact',
        limit: limit + 1,
        api_key: apiKey(),
      },
      source: 'openfda.interactions',
    })
    const interactions = (data?.results ?? [])
      .filter((r) => r.term?.toLowerCase() !== drug.toLowerCase())
      .slice(0, limit)
    return { drug, co_mentioned_drugs: interactions }
  } catch (err) {
    return { drug, co_mentioned_drugs: [], error: String(err?.message ?? err) }
  }
}

/** Search by reaction term. */
export async function searchByReaction(reaction, limit = 100) {
  try {
    const data = await httpGet(BASE_URL, {
      params: {
        search: `patient.reaction.reactionmeddrapt:"${reaction}"`,
        limit: Math.min(limit, 100),
        api_key: apiKey(),
      },
      source: 'openfda.by_reaction',
    })
    return {
      reaction,
      total_results: data?.meta?.results?.total ?? 0,
      reports: (data?.results ?? []).map(mapReport),
    }
  } catch (err) {
    return { reaction, total_results: 0, reports: [], error: String(err?.message ?? err) }
  }
}

/** Drugs most associated with a reaction. */
export async function getDrugsForReaction(reaction, limit = 20) {
  try {
    const data = await httpGet(BASE_URL, {
      params: {
        search: `patient.reaction.reactionmeddrapt:"${reaction}"`,
        count: 'patient.drug.openfda.generic_name.exact',
        limit,
        api_key: apiKey(),
      },
      source: 'openfda.drugs_for_reaction',
    })
    return { reaction, drugs: data?.results ?? [] }
  } catch (err) {
    return { reaction, drugs: [], error: String(err?.message ?? err) }
  }
}

/* -------------------------------------------------------------------------- */

function mapReport(raw) {
  return {
    safetyreportid: raw?.safetyreportid ?? null,
    receivedate: raw?.receivedate ?? null,
    serious: raw?.serious === '1',
    seriousness: {
      death: raw?.seriousnessdeath === '1',
      hospitalization: raw?.seriousnesshospitalization === '1',
      life_threatening: raw?.seriousnesslifethreatening === '1',
      disabling: raw?.seriousnessdisabling === '1',
      congenital_anomaly: raw?.seriousnesscongenitalanomali === '1',
    },
    patient_sex: { 1: 'male', 2: 'female' }[raw?.patient?.patientsex] ?? 'unknown',
    patient_age: raw?.patient?.patientonsetage ?? null,
    reactions: (raw?.patient?.reaction ?? []).map((r) => r.reactionmeddrapt).filter(Boolean),
    drugs: (raw?.patient?.drug ?? []).map((d) => d.medicinalproduct).filter(Boolean),
  }
}
