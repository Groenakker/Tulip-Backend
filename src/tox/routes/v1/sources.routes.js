/**
 * Sources / reference-registry endpoints — mirrors
 * `app/api/v1/endpoints/sources.py` + the contents of
 * `app.data.source_registry.REFERENCE_SOURCE_REGISTRY`.
 *
 * The registry lists every upstream data source the SPA can resolve a
 * reference value from. Keeping it server-side means the React side can
 * render `_source.source` badges without hard-coding the list.
 */

import { Router } from 'express'

const router = Router()

/**
 * Bundled reference-source registry. Mirrors the Python registry's
 * shape: each source has an id, display name, organisation, URL, and
 * tags indicating what data categories it provides.
 */
const REFERENCE_SOURCE_REGISTRY = {
  iris: {
    id: 'iris',
    name: 'EPA IRIS',
    organisation: 'US Environmental Protection Agency',
    url: 'https://cfpub.epa.gov/ncea/iris/',
    categories: ['reference_dose', 'cancer_slope_factor', 'chronic_toxicity'],
    jurisdictions: ['US'],
  },
  iarc: {
    id: 'iarc',
    name: 'IARC Monographs',
    organisation: 'International Agency for Research on Cancer',
    url: 'https://monographs.iarc.who.int/',
    categories: ['carcinogenicity_classification'],
    jurisdictions: ['Global'],
  },
  efsa: {
    id: 'efsa',
    name: 'EFSA OpenFoodTox',
    organisation: 'European Food Safety Authority',
    url: 'https://www.efsa.europa.eu/en/microstrategy/openfoodtox',
    categories: ['adi', 'arfd', 'genotoxicity', 'food_safety'],
    jurisdictions: ['EU'],
  },
  echa: {
    id: 'echa',
    name: 'ECHA CHEM / REACH',
    organisation: 'European Chemicals Agency',
    url: 'https://chem.echa.europa.eu/',
    categories: ['noael', 'loael', 'reach_registration'],
    jurisdictions: ['EU'],
  },
  pubchem: {
    id: 'pubchem',
    name: 'PubChem',
    organisation: 'NCBI',
    url: 'https://pubchem.ncbi.nlm.nih.gov/',
    categories: ['identifiers', 'physchem_properties', 'bioassays'],
    jurisdictions: ['US'],
  },
  chembl: {
    id: 'chembl',
    name: 'ChEMBL',
    organisation: 'EMBL-EBI',
    url: 'https://www.ebi.ac.uk/chembl/',
    categories: ['bioactivity', 'mechanism', 'admet'],
    jurisdictions: ['EU'],
  },
  comptox: {
    id: 'comptox',
    name: 'EPA CompTox Chemicals Dashboard',
    organisation: 'US EPA NCCT',
    url: 'https://comptox.epa.gov/dashboard',
    categories: ['toxcast', 'expocast', 'hazard'],
    jurisdictions: ['US'],
  },
  ctd: {
    id: 'ctd',
    name: 'Comparative Toxicogenomics Database',
    organisation: 'NCSU',
    url: 'https://ctdbase.org/',
    categories: ['gene_interactions', 'disease_associations', 'pathways'],
    jurisdictions: ['US'],
  },
  faers: {
    id: 'faers',
    name: 'FDA FAERS (openFDA)',
    organisation: 'US FDA',
    url: 'https://open.fda.gov/data/faers/',
    categories: ['adverse_events', 'post_marketing_surveillance'],
    jurisdictions: ['US'],
  },
  sider: {
    id: 'sider',
    name: 'SIDER',
    organisation: 'EMBL Heidelberg',
    url: 'http://sideeffects.embl.de/',
    categories: ['side_effects', 'indications'],
    jurisdictions: ['Global'],
  },
  aopwiki: {
    id: 'aopwiki',
    name: 'AOP-Wiki',
    organisation: 'OECD',
    url: 'https://aopwiki.org/',
    categories: ['adverse_outcome_pathways', 'mechanistic'],
    jurisdictions: ['Global'],
  },
  pubmed: {
    id: 'pubmed',
    name: 'PubMed',
    organisation: 'NCBI',
    url: 'https://pubmed.ncbi.nlm.nih.gov/',
    categories: ['literature'],
    jurisdictions: ['Global'],
  },
  clinicaltrials: {
    id: 'clinicaltrials',
    name: 'ClinicalTrials.gov',
    organisation: 'US NLM',
    url: 'https://clinicaltrials.gov/',
    categories: ['clinical_trials', 'endpoints'],
    jurisdictions: ['Global'],
  },
  toxtree: {
    id: 'toxtree',
    name: 'Toxtree / AMBIT',
    organisation: 'EU JRC',
    url: 'https://toxtree.sourceforge.net/',
    categories: ['qsar', 'cramer', 'structural_alerts'],
    jurisdictions: ['EU'],
  },
}

router.get('/reference-registry', (_req, res) => {
  res.json({
    sources: Object.values(REFERENCE_SOURCE_REGISTRY),
    total_sources: Object.keys(REFERENCE_SOURCE_REGISTRY).length,
  })
})

export default router
