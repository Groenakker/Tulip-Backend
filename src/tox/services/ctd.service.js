/**
 * Comparative Toxicogenomics Database (CTD) service.
 *
 * Mirrors `backend/app/services/ctd_service.py`. CTD exposes a public TSV
 * batch-query endpoint at `ctdbase.org/tools/batchQuery.go` returning
 * tab-delimited text. We turn that into JSON for the SPA.
 *
 * No API key required.
 */

import { httpGet } from './_httpClient.js'

const BASE_URL = 'https://ctdbase.org/tools/batchQuery.go'

/**
 * Internal: run a CTD batch query and return parsed rows.
 *
 * @param {object} opts
 * @param {string} opts.inputType  - e.g. 'chem', 'gene', 'disease'
 * @param {string} opts.inputTerms - newline-separated terms
 * @param {string} opts.report     - report type, e.g. 'genes_curated', 'diseases_curated'
 */
async function ctdBatch({ inputType, inputTerms, report }) {
  const tsv = await httpGet(BASE_URL, {
    params: {
      inputType,
      inputTerms,
      report,
      format: 'tsv',
      action: 'Download',
    },
    responseType: 'text',
    source: `ctd.${report}`,
  })
  return parseTsv(tsv)
}

/** Genes interacting with a chemical. */
export async function getChemicalGenes(chemicalName, limit = 100) {
  try {
    const rows = await ctdBatch({
      inputType: 'chem',
      inputTerms: chemicalName,
      report: 'genes_curated',
    })
    return {
      query: chemicalName,
      total_results: rows.length,
      interactions: rows.slice(0, limit).map(mapGeneInteraction),
    }
  } catch (err) {
    return { query: chemicalName, total_results: 0, interactions: [], error: String(err?.message ?? err) }
  }
}

/** Diseases associated with a chemical. */
export async function getChemicalDiseases(chemicalName, limit = 100) {
  try {
    const rows = await ctdBatch({
      inputType: 'chem',
      inputTerms: chemicalName,
      report: 'diseases_curated',
    })
    return {
      query: chemicalName,
      total_results: rows.length,
      associations: rows.slice(0, limit).map(mapDiseaseAssociation),
    }
  } catch (err) {
    return { query: chemicalName, total_results: 0, associations: [], error: String(err?.message ?? err) }
  }
}

/** Pathways affected by a chemical. */
export async function getChemicalPathways(chemicalName, limit = 100) {
  try {
    const rows = await ctdBatch({
      inputType: 'chem',
      inputTerms: chemicalName,
      report: 'pathways_curated',
    })
    return {
      query: chemicalName,
      total_results: rows.length,
      pathways: rows.slice(0, limit).map(mapPathway),
    }
  } catch (err) {
    return { query: chemicalName, total_results: 0, pathways: [], error: String(err?.message ?? err) }
  }
}

/** Gene Ontology enrichment for genes affected by a chemical. */
export async function getGoEnrichment(chemicalName, ontology = 'all', limit = 100) {
  try {
    const rows = await ctdBatch({
      inputType: 'chem',
      inputTerms: chemicalName,
      report: 'go_enriched',
    })
    let filtered = rows
    if (ontology !== 'all') {
      const target = { bp: 'Biological', mf: 'Molecular', cc: 'Cellular' }[ontology.toLowerCase()] ?? ''
      filtered = rows.filter((r) => String(r['Ontology'] ?? '').includes(target))
    }
    return {
      query: chemicalName,
      ontology,
      total_results: filtered.length,
      go_terms: filtered.slice(0, limit),
    }
  } catch (err) {
    return { query: chemicalName, ontology, total_results: 0, go_terms: [], error: String(err?.message ?? err) }
  }
}

/** Phenotype data for chemical-gene interactions. */
export async function getPhenotypeData(chemicalName, limit = 100) {
  try {
    const rows = await ctdBatch({
      inputType: 'chem',
      inputTerms: chemicalName,
      report: 'phenotypes_curated',
    })
    return {
      query: chemicalName,
      total_results: rows.length,
      phenotypes: rows.slice(0, limit),
    }
  } catch (err) {
    return { query: chemicalName, total_results: 0, phenotypes: [], error: String(err?.message ?? err) }
  }
}

/** Chemicals interacting with a gene. */
export async function getGeneChemicalInteractions(geneSymbol, limit = 100) {
  try {
    const rows = await ctdBatch({
      inputType: 'gene',
      inputTerms: geneSymbol,
      report: 'chems_curated',
    })
    return {
      query: geneSymbol,
      total_results: rows.length,
      interactions: rows.slice(0, limit),
    }
  } catch (err) {
    return { query: geneSymbol, total_results: 0, interactions: [], error: String(err?.message ?? err) }
  }
}

/** Diseases associated with a gene. */
export async function getGeneDiseases(geneSymbol, limit = 100) {
  try {
    const rows = await ctdBatch({
      inputType: 'gene',
      inputTerms: geneSymbol,
      report: 'diseases_curated',
    })
    return {
      query: geneSymbol,
      total_results: rows.length,
      diseases: rows.slice(0, limit).map(mapDiseaseAssociation),
    }
  } catch (err) {
    return { query: geneSymbol, total_results: 0, diseases: [], error: String(err?.message ?? err) }
  }
}

/** Chemicals associated with a disease. */
export async function getDiseaseChemicals(diseaseName, limit = 100) {
  try {
    const rows = await ctdBatch({
      inputType: 'disease',
      inputTerms: diseaseName,
      report: 'chems_curated',
    })
    return {
      query: diseaseName,
      total_results: rows.length,
      chemicals: rows.slice(0, limit),
    }
  } catch (err) {
    return { query: diseaseName, total_results: 0, chemicals: [], error: String(err?.message ?? err) }
  }
}

/** Genes associated with a disease. */
export async function getDiseaseGenes(diseaseName, limit = 100) {
  try {
    const rows = await ctdBatch({
      inputType: 'disease',
      inputTerms: diseaseName,
      report: 'genes_curated',
    })
    return {
      query: diseaseName,
      total_results: rows.length,
      genes: rows.slice(0, limit),
    }
  } catch (err) {
    return { query: diseaseName, total_results: 0, genes: [], error: String(err?.message ?? err) }
  }
}

/* -------------------------------------------------------------------------- */
/*  Internal                                                                  */
/* -------------------------------------------------------------------------- */

function parseTsv(tsv) {
  if (!tsv || typeof tsv !== 'string') return []
  const lines = tsv.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  // CTD prefixes header lines with `#`; the last `# ` line is the column header.
  let headerLine = lines.find((line) => line.startsWith('# ') && line.includes('\t'))
  if (!headerLine) headerLine = lines[0]
  const columns = headerLine.replace(/^#\s*/, '').split('\t').map((c) => c.trim())
  const rows = []
  for (const line of lines) {
    if (line.startsWith('#')) continue
    const values = line.split('\t')
    const row = {}
    columns.forEach((col, i) => {
      row[col] = values[i] ?? null
    })
    rows.push(row)
  }
  return rows
}

function mapGeneInteraction(row) {
  return {
    gene_symbol: row['Gene Symbol'] ?? row.GeneSymbol ?? null,
    gene_id: row['Gene ID'] ?? null,
    interaction: row['Interaction'] ?? null,
    interaction_actions: row['Interaction Actions'] ?? null,
    pubmed_ids: (row['Pubmed IDs'] ?? '').split('|').filter(Boolean),
    organism: row['Organism'] ?? null,
  }
}

function mapDiseaseAssociation(row) {
  return {
    disease_name: row['Disease Name'] ?? null,
    disease_id: row['Disease ID'] ?? null,
    direct_evidence: row['Direct Evidence'] ?? null,
    inference_score: row['Inference Score'] != null ? Number(row['Inference Score']) : null,
    inference_gene_symbols: (row['Inference Gene Symbols'] ?? '').split('|').filter(Boolean),
    pubmed_ids: (row['Pubmed IDs'] ?? '').split('|').filter(Boolean),
  }
}

function mapPathway(row) {
  return {
    pathway_name: row['Pathway Name'] ?? null,
    pathway_id: row['Pathway ID'] ?? null,
    inference_gene_symbols: (row['Inference Gene Symbols'] ?? '').split('|').filter(Boolean),
  }
}
