/**
 * ClinicalTrials.gov v2 REST API service.
 *
 * Mirrors `backend/app/services/clinical_trials_service.py`. The v2 API
 * (https://clinicaltrials.gov/api/v2/studies) returns rich JSON describing
 * each trial; this module flattens the most relevant fields into the same
 * shape the FastAPI layer used so the React `/clinical/*` UI keeps working.
 */

import { httpGet } from './_httpClient.js'

const BASE_URL = 'https://clinicaltrials.gov/api/v2'

/**
 * Search clinical trials by condition, intervention, status, and phase.
 *
 * @param {object} opts
 * @param {string} [opts.condition]
 * @param {string} [opts.intervention]
 * @param {string[]} [opts.status]
 * @param {string[]} [opts.phase]
 * @param {number} [opts.page_size=20]
 * @param {boolean} [opts.count_total=true]
 */
export async function searchTrials({
  condition,
  intervention,
  status,
  phase,
  page_size = 20,
  count_total = true,
} = {}) {
  try {
    const params = buildSearchParams({ condition, intervention, status, phase, page_size, count_total })
    const data = await httpGet(`${BASE_URL}/studies`, { params, source: 'clinicaltrials.studies' })
    const trials = (data?.studies ?? []).map(mapTrialSummary)
    return {
      total_results: data?.totalCount ?? trials.length,
      trials,
    }
  } catch (err) {
    return { total_results: 0, trials: [], error: String(err?.message ?? err) }
  }
}

/** Detailed trial view by NCT id. */
export async function getTrialDetails(nctId) {
  try {
    const data = await httpGet(`${BASE_URL}/studies/${nctId}`, { source: 'clinicaltrials.study' })
    return data ? mapTrialDetail(data) : null
  } catch {
    return null
  }
}

/** Search trials by sponsor name. */
export async function searchBySponsor({ sponsor_name, condition, phase, status, page_size = 20 }) {
  const filter = ['AREA[LeadSponsorName]', `"${sponsor_name}"`].join('')
  const params = buildSearchParams({ condition, status, phase, page_size, count_total: true })
  params['query.lead'] = filter
  try {
    const data = await httpGet(`${BASE_URL}/studies`, { params, source: 'clinicaltrials.sponsor' })
    return {
      total_results: data?.totalCount ?? 0,
      trials: (data?.studies ?? []).map(mapTrialSummary),
    }
  } catch (err) {
    return { total_results: 0, trials: [], error: String(err?.message ?? err) }
  }
}

/** Aggregate endpoints (primary/secondary/other) across matching trials. */
export async function analyzeEndpoints({ condition, nct_id, phase, page_size = 50 }) {
  try {
    if (nct_id) {
      const trial = await getTrialDetails(nct_id)
      return {
        primary_endpoints: trial?.primary_outcomes ?? [],
        secondary_endpoints: trial?.secondary_outcomes ?? [],
        other_endpoints: [],
      }
    }
    const search = await searchTrials({ condition, phase, page_size, count_total: false })
    const primaries = []
    const secondaries = []
    for (const t of search.trials) {
      ;(t.primary_outcomes ?? []).forEach((e) => primaries.push(e))
      ;(t.secondary_outcomes ?? []).forEach((e) => secondaries.push(e))
    }
    return {
      primary_endpoints: dedupeAndCount(primaries),
      secondary_endpoints: dedupeAndCount(secondaries),
      other_endpoints: [],
    }
  } catch (err) {
    return {
      primary_endpoints: [],
      secondary_endpoints: [],
      other_endpoints: [],
      error: String(err?.message ?? err),
    }
  }
}

/** Search by eligibility criteria (sex, age, keywords). */
export async function searchByEligibility({ condition, min_age, max_age, sex, eligibility_keywords, page_size = 20 }) {
  const params = buildSearchParams({ condition, page_size, count_total: true })
  if (sex) params['query.eligibility'] = `sex=${sex}`
  if (eligibility_keywords) {
    params['query.eligibility'] = [params['query.eligibility'], eligibility_keywords]
      .filter(Boolean)
      .join(' AND ')
  }
  try {
    const data = await httpGet(`${BASE_URL}/studies`, { params, source: 'clinicaltrials.eligibility' })
    return {
      total_results: data?.totalCount ?? 0,
      trials: (data?.studies ?? []).map(mapTrialSummary),
    }
  } catch (err) {
    return { total_results: 0, trials: [], error: String(err?.message ?? err) }
  }
}

/* -------------------------------------------------------------------------- */
/*  Internal                                                                  */
/* -------------------------------------------------------------------------- */

function buildSearchParams({ condition, intervention, status, phase, page_size, count_total }) {
  const params = { format: 'json', pageSize: Math.min(page_size, 100), countTotal: count_total }
  if (condition) params['query.cond'] = condition
  if (intervention) params['query.intr'] = intervention
  if (status?.length) params['filter.overallStatus'] = status.join(',')
  if (phase?.length) params['filter.advanced'] = phase.map((p) => `AREA[Phase]${p}`).join(' OR ')
  return params
}

function mapTrialSummary(raw) {
  const protocol = raw?.protocolSection ?? {}
  const identification = protocol.identificationModule ?? {}
  const statusMod = protocol.statusModule ?? {}
  const sponsorMod = protocol.sponsorCollaboratorsModule ?? {}
  const designMod = protocol.designModule ?? {}
  const condMod = protocol.conditionsModule ?? {}
  const armsMod = protocol.armsInterventionsModule ?? {}
  const outcomeMod = protocol.outcomesModule ?? {}
  return {
    nct_id: identification.nctId,
    title: identification.briefTitle ?? '',
    status: statusMod.overallStatus,
    phase: (designMod.phases ?? []).join(', ') || null,
    conditions: condMod.conditions ?? [],
    interventions: (armsMod.interventions ?? []).map((i) => i.name ?? i.type).filter(Boolean),
    sponsor: sponsorMod.leadSponsor?.name ?? null,
    start_date: statusMod.startDateStruct?.date ?? null,
    enrollment: designMod.enrollmentInfo?.count ?? null,
    primary_outcomes: (outcomeMod.primaryOutcomes ?? []).map((o) => o.measure ?? o.description ?? ''),
    secondary_outcomes: (outcomeMod.secondaryOutcomes ?? []).map((o) => o.measure ?? o.description ?? ''),
  }
}

function mapTrialDetail(raw) {
  const summary = mapTrialSummary(raw)
  const protocol = raw?.protocolSection ?? {}
  const eligibility = protocol.eligibilityModule ?? {}
  const contacts = protocol.contactsLocationsModule ?? {}
  return {
    ...summary,
    official_title: protocol.identificationModule?.officialTitle ?? null,
    study_type: protocol.designModule?.studyType ?? null,
    completion_date: protocol.statusModule?.completionDateStruct?.date ?? null,
    enrollment_type: protocol.designModule?.enrollmentInfo?.type ?? null,
    eligibility: {
      minimum_age: eligibility.minimumAge ?? null,
      maximum_age: eligibility.maximumAge ?? null,
      sex: eligibility.sex ?? null,
      healthy_volunteers: eligibility.healthyVolunteers ?? null,
      criteria: eligibility.eligibilityCriteria ?? null,
    },
    collaborators: (protocol.sponsorCollaboratorsModule?.collaborators ?? []).map((c) => c.name),
    locations: (contacts.locations ?? []).map((loc) => ({
      facility: loc.facility ?? null,
      city: loc.city ?? null,
      country: loc.country ?? null,
    })),
    contacts: contacts.centralContacts ?? [],
  }
}

function dedupeAndCount(items) {
  const map = new Map()
  for (const item of items) {
    if (!item) continue
    map.set(item, (map.get(item) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([endpoint, count]) => ({ endpoint, count }))
}
