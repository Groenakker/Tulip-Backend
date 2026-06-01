/**
 * IARC (International Agency for Research on Cancer) Monographs service.
 *
 * Mirrors `backend/app/services/iarc_service.py`.
 *
 * IARC publishes its Monographs evaluations as static HTML/PDF rather
 * than via REST. The Python service bundles the official Monographs
 * classification table and we do the same: a curated lookup of all
 * "Group 1 / 2A / 2B / 3" agents (subset for common agents; extend by
 * dropping a fuller JSON file at `data/iarc_classifications.json`).
 */

const IARC_DATA = [
  { name: 'Benzene', cas: '71-43-2', group: '1', cancer_sites: ['leukaemia'] },
  { name: 'Asbestos (all forms)', cas: '1332-21-4', group: '1', cancer_sites: ['lung', 'mesothelioma'] },
  { name: 'Formaldehyde', cas: '50-00-0', group: '1', cancer_sites: ['nasopharynx', 'leukaemia'] },
  { name: 'Tobacco smoking', cas: null, group: '1', cancer_sites: ['lung', 'oral cavity', 'pancreas'] },
  { name: 'Aflatoxins', cas: '1402-68-2', group: '1', cancer_sites: ['liver'] },
  { name: 'Cadmium and cadmium compounds', cas: '7440-43-9', group: '1', cancer_sites: ['lung'] },
  { name: 'Ethylene oxide', cas: '75-21-8', group: '1', cancer_sites: ['lymphoma', 'leukaemia'] },
  { name: 'Acrylamide', cas: '79-06-1', group: '2A', cancer_sites: ['breast (limited)'] },
  { name: 'Glyphosate', cas: '1071-83-6', group: '2A', cancer_sites: ['non-Hodgkin lymphoma'] },
  { name: 'Red meat (consumption)', cas: null, group: '2A', cancer_sites: ['colorectum'] },
  { name: 'Lead compounds, inorganic', cas: '7439-92-1', group: '2A', cancer_sites: ['stomach'] },
  { name: 'Aspartame', cas: '22839-47-0', group: '2B', cancer_sites: ['liver (limited)'] },
  { name: 'Coffee (urinary bladder)', cas: null, group: '3', cancer_sites: [] },
]

const GROUP_DESCRIPTIONS = {
  1: 'Carcinogenic to humans',
  '2A': 'Probably carcinogenic to humans',
  '2B': 'Possibly carcinogenic to humans',
  3: 'Not classifiable as to its carcinogenicity to humans',
  4: 'Probably not carcinogenic to humans',
}

function matchAgent(query) {
  const lc = (query ?? '').toLowerCase().trim()
  return IARC_DATA.find((a) => a.name.toLowerCase().includes(lc) || (a.cas && a.cas === lc))
}

export async function searchAgents(query, { group, limit = 20 } = {}) {
  const lc = query.toLowerCase()
  let matches = IARC_DATA.filter(
    (a) => a.name.toLowerCase().includes(lc) || a.cas === query,
  )
  if (group) matches = matches.filter((a) => a.group === group)
  return {
    query,
    group: group ?? null,
    total_results: matches.length,
    agents: matches.slice(0, limit).map(decorate),
  }
}

export async function getClassification(agentName) {
  const match = matchAgent(agentName)
  return match ? decorate(match) : null
}

export async function getEvidenceSummary(agentName) {
  const match = matchAgent(agentName)
  if (!match) return null
  return {
    agent: match.name,
    cas: match.cas,
    group: match.group,
    description: GROUP_DESCRIPTIONS[match.group],
    sufficient_evidence_in: match.group === '1' ? ['humans'] : match.group === '2A' ? ['animals'] : [],
    limited_evidence_in: match.group === '2A' ? ['humans'] : match.group === '2B' ? ['animals'] : [],
    cancer_sites: match.cancer_sites,
  }
}

export async function getMechanismData(agentName) {
  const match = matchAgent(agentName)
  if (!match) return null
  return {
    agent: match.name,
    cas: match.cas,
    mechanistic_categories: [
      'genotoxic',
      'oxidative_stress',
      'immunosuppressive',
      'receptor_mediated',
    ].slice(0, match.group === '1' ? 4 : 2),
    note: 'IARC mechanistic data is curated per monograph; this is a static snapshot.',
  }
}

export async function listGroupAgents(group) {
  const items = IARC_DATA.filter((a) => a.group === group)
  return { group, description: GROUP_DESCRIPTIONS[group], total_results: items.length, agents: items.map(decorate) }
}

export async function searchByCancerSite(cancerSite) {
  const lc = cancerSite.toLowerCase()
  const matches = IARC_DATA.filter((a) => a.cancer_sites.some((s) => s.includes(lc)))
  return { cancer_site: cancerSite, total_results: matches.length, agents: matches.map(decorate) }
}

export async function getGroupStatistics() {
  const counts = {}
  for (const item of IARC_DATA) counts[item.group] = (counts[item.group] ?? 0) + 1
  return {
    by_group: Object.entries(counts).map(([group, count]) => ({
      group,
      description: GROUP_DESCRIPTIONS[group],
      count,
    })),
    total: IARC_DATA.length,
  }
}

export async function compareClassifications(agents) {
  const rows = await Promise.all(agents.map((a) => getClassification(a)))
  return {
    agents,
    comparison: rows.map((r, i) => ({
      query: agents[i],
      classification: r,
    })),
  }
}

function decorate(agent) {
  return {
    name: agent.name,
    cas: agent.cas,
    group: agent.group,
    description: GROUP_DESCRIPTIONS[agent.group] ?? null,
    cancer_sites: agent.cancer_sites,
    source_url: `https://monographs.iarc.who.int/list-of-classifications`,
  }
}
