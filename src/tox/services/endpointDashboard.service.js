/**
 * Endpoint-organised toxicity dashboard.
 *
 * Mirrors `backend/app/services/endpoint_dashboard.py`. Aggregates data
 * from ECHA, ChEMBL, Toxtree, FAERS, IRIS, IARC, CTD, and SIDER into a
 * dashboard organised by ISO 10993-1 biological evaluation categories.
 */

import * as identifier from './identifier.service.js'
import * as echa from './echa.service.js'
import * as toxtree from './toxtree.service.js'
import * as openfda from './openfda.service.js'
import * as iris from './iris.service.js'
import * as iarc from './iarc.service.js'
import * as ctd from './ctd.service.js'
import * as sider from './sider.service.js'
import { getBioactivity } from './chembl.js'
import { gatherSources } from '../utils/routeHelpers.util.js'

/** ISO 10993 reference for each endpoint category. */
export const ISO_REFERENCES = {
  cytotoxicity: 'ISO 10993-5',
  sensitization: 'ISO 10993-10',
  irritation: 'ISO 10993-10/23',
  systemic_toxicity: 'ISO 10993-11',
  subchronic_toxicity: 'ISO 10993-11',
  chronic_toxicity: 'ISO 10993-11',
  genotoxicity: 'ISO 10993-3',
  carcinogenicity: 'ISO 10993-3',
  reproductive_toxicity: 'ISO 10993-3',
  hemocompatibility: 'ISO 10993-4',
  implantation: 'ISO 10993-6',
  pyrogenicity: 'ISO 10993-11',
}

/** Friendly display names for the UI. */
export const DISPLAY_NAMES = {
  cytotoxicity: 'Cytotoxicity',
  sensitization: 'Sensitization',
  irritation: 'Irritation / Intracutaneous Reactivity',
  systemic_toxicity: 'Acute Systemic Toxicity',
  subchronic_toxicity: 'Subchronic / Subacute Toxicity',
  chronic_toxicity: 'Chronic Toxicity',
  genotoxicity: 'Genotoxicity',
  carcinogenicity: 'Carcinogenicity',
  reproductive_toxicity: 'Reproductive / Developmental Toxicity',
  hemocompatibility: 'Hemocompatibility',
  implantation: 'Implantation',
  pyrogenicity: 'Pyrogenicity',
}

/** Generate the dashboard for a compound. */
export async function generateDashboard(query, opts = {}) {
  const {
    include_echa = true,
    include_toxtree = true,
    include_chembl = true,
    include_faers = true,
    include_iris = true,
    include_iarc = true,
    include_ctd = true,
    include_sider = true,
  } = opts

  const resolved = await identifier.resolve(query, { resolve_all: true })
  const ids = resolved.to_dict()
  const name = ids.preferred_name ?? query
  const cas = ids.casrn
  const smiles = ids.canonical_smiles

  const tasks = []
  if (include_echa) tasks.push({ name: 'echa', run: () => echa.getToxicityEndpoints({ cas_number: cas, substance_name: name }) })
  if (include_chembl) tasks.push({ name: 'chembl', run: () => fetchChembl(ids.chembl_id, name) })
  if (include_toxtree && smiles) {
    tasks.push({ name: 'toxtree', run: () => toxtree.predictAll(smiles, name) })
  }
  if (include_faers) tasks.push({ name: 'faers', run: () => openfda.getReactionCounts(name, 30) })
  if (include_iris) tasks.push({ name: 'iris', run: () => iris.getChemicalAssessment(cas ?? name) })
  if (include_iarc) tasks.push({ name: 'iarc', run: () => iarc.getClassification(name) })
  if (include_ctd) {
    tasks.push({
      name: 'ctd',
      run: async () => {
        const [diseases, genes] = await Promise.all([
          ctd.getChemicalDiseases(name, 20).catch(() => null),
          ctd.getChemicalGenes(name, 20).catch(() => null),
        ])
        return {
          disease_associations: diseases?.associations ?? [],
          gene_interactions: genes?.interactions ?? [],
        }
      },
    })
  }
  if (include_sider) tasks.push({ name: 'sider', run: () => sider.getSideEffects(name) })

  const sources = await gatherSources(tasks)

  // Build the endpoint summary
  const categories = buildCategorySummaries(sources)

  return {
    compound: { name, cas, dtxsid: ids.dtxsid, chembl_id: ids.chembl_id, smiles },
    resolved_identifiers: { query, ...ids },
    categories,
    source_statuses: sources,
    compliance: assessCompliance(categories),
  }
}

/** List endpoint categories with their ISO refs (used by `/categories`). */
export function listCategories() {
  return Object.keys(ISO_REFERENCES).map((id) => ({
    id,
    display_name: DISPLAY_NAMES[id],
    iso_reference: ISO_REFERENCES[id],
  }))
}

/* -------------------------------------------------------------------------- */

async function fetchChembl(chemblId, name) {
  if (!chemblId) return null
  try {
    return await getBioactivity({ molecule_chembl_id: chemblId, limit: 50 })
  } catch {
    return null
  }
}

function buildCategorySummaries(sources) {
  const cats = {}
  for (const id of Object.keys(ISO_REFERENCES)) {
    cats[id] = {
      id,
      display_name: DISPLAY_NAMES[id],
      iso_reference: ISO_REFERENCES[id],
      has_data: false,
      data_quality: 'no_data',
      findings: [],
    }
  }

  // Toxtree contributions
  const tt = sources.toxtree?.value
  if (tt) {
    cats.genotoxicity.has_data = true
    cats.genotoxicity.findings.push({ source: 'Toxtree', summary: `Mutagenicity prediction: ${tt.mutagenicity?.prediction}` })
    cats.carcinogenicity.has_data = true
    cats.carcinogenicity.findings.push({
      source: 'Toxtree',
      summary: `Carcinogen alert: ${tt.carcinogenicity?.is_carcinogen ? 'yes' : 'no'}`,
    })
    cats.sensitization.has_data = true
    cats.sensitization.findings.push({
      source: 'Toxtree',
      summary: `Skin sensitiser: ${tt.skin_sensitization?.is_sensitizer ? 'yes' : 'no'}`,
    })
    cats.irritation.has_data = true
    cats.irritation.findings.push({
      source: 'Toxtree',
      summary: `Skin irritant: ${tt.skin_irritation?.is_irritant ? 'yes' : 'no'}`,
    })
  }

  // ECHA contributions
  const ec = sources.echa?.value
  if (Array.isArray(ec)) {
    for (const ep of ec) {
      const bucket =
        ep.study_type?.includes('Carcinogenicity') ? 'carcinogenicity'
        : ep.study_type?.includes('Reproductive') ? 'reproductive_toxicity'
        : ep.study_type?.includes('Repeated') ? 'subchronic_toxicity'
        : ep.study_type?.includes('Acute') ? 'systemic_toxicity'
        : 'systemic_toxicity'
      cats[bucket].has_data = true
      cats[bucket].findings.push({
        source: 'ECHA REACH',
        summary: `${ep.endpoint_type} ${ep.value} ${ep.unit} (${ep.species}, ${ep.route})`,
      })
    }
  }

  // IRIS / IARC
  if (sources.iris?.value) {
    cats.chronic_toxicity.has_data = true
    cats.chronic_toxicity.findings.push({ source: 'EPA IRIS', summary: 'Reference dose available' })
  }
  if (sources.iarc?.value) {
    cats.carcinogenicity.has_data = true
    cats.carcinogenicity.findings.push({
      source: 'IARC',
      summary: `Classification: ${sources.iarc.value.group} (${sources.iarc.value.description})`,
    })
  }

  // FAERS — clinical adverse events feed into systemic toxicity
  if (sources.faers?.value) {
    cats.systemic_toxicity.has_data = true
    cats.systemic_toxicity.findings.push({
      source: 'FDA FAERS',
      summary: `${sources.faers.value.reactions?.length ?? 0} adverse-event reactions reported`,
    })
  }

  // Assign data_quality
  for (const c of Object.values(cats)) {
    c.data_quality = c.findings.length >= 2 ? 'multi_source' : c.findings.length === 1 ? 'single_source' : 'no_data'
  }
  return cats
}

/** Compliance indicators per ISO 10993-1 contact-duration category. */
function assessCompliance(categories) {
  const required = {
    limited_contact: ['cytotoxicity', 'sensitization', 'irritation'],
    prolonged_contact: ['cytotoxicity', 'sensitization', 'irritation', 'systemic_toxicity', 'genotoxicity'],
    permanent_contact: [
      'cytotoxicity',
      'sensitization',
      'irritation',
      'systemic_toxicity',
      'genotoxicity',
      'chronic_toxicity',
      'carcinogenicity',
      'reproductive_toxicity',
    ],
  }
  const out = {}
  for (const [contactType, reqs] of Object.entries(required)) {
    const missing = reqs.filter((r) => !categories[r]?.has_data)
    out[contactType] = {
      required_endpoints: reqs,
      satisfied: missing.length === 0,
      missing_endpoints: missing,
    }
  }
  return out
}
