/**
 * TG-GATEs toxicogenomics service.
 *
 * Mirrors `backend/app/services/tggates_service.py`. TG-GATEs is a
 * curated rat-liver/kidney gene-expression database. There is no
 * public live REST API: the Python service shipped a snapshot of the
 * compound catalog + signature summaries. We bundle the same shape so
 * the React SPA `/toxicogenomics/*` UI remains functional.
 *
 * Replace `TGGATES_COMPOUNDS` with a richer dataset (or wire to a
 * local mirror) when full parity is required.
 */

/** Per-compound TG-GATEs snapshot. */
const TGGATES_COMPOUNDS = {
  'acetaminophen': {
    name: 'Acetaminophen',
    cas: '103-90-2',
    is_hepatotoxicant: true,
    mechanism: 'NAPQI-mediated centrilobular hepatocyte necrosis',
    signatures: {
      Liver: { Low: { up: ['CYP2E1'], down: ['ALB'] }, High: { up: ['HMOX1', 'GADD45A'], down: ['ALB', 'PCK1'] } },
      Kidney: { High: { up: ['HMOX1'], down: [] } },
    },
    pathologies: ['centrilobular necrosis', 'hepatocyte single-cell necrosis'],
  },
  'cyclosporin a': {
    name: 'Cyclosporin A',
    cas: '59865-13-3',
    is_hepatotoxicant: false,
    mechanism: 'Calcineurin inhibition; nephrotoxic at high dose',
    signatures: { Kidney: { High: { up: ['HMOX1', 'CCL2'], down: ['SLC22A6'] } } },
    pathologies: ['proximal tubular injury'],
  },
  'phenobarbital': {
    name: 'Phenobarbital',
    cas: '50-06-6',
    is_hepatotoxicant: true,
    mechanism: 'CAR activation; CYP2B induction; non-genotoxic carcinogen (rodent)',
    signatures: { Liver: { High: { up: ['CYP2B1', 'CYP2B2'], down: [] } } },
    pathologies: ['hepatocellular hypertrophy'],
  },
}

function find(name) {
  return TGGATES_COMPOUNDS[name?.toLowerCase()?.trim() ?? ''] ?? null
}

export async function searchCompound(query, limit = 20) {
  const lc = query.toLowerCase()
  const items = Object.entries(TGGATES_COMPOUNDS)
    .filter(([k, e]) => k.includes(lc) || e.name.toLowerCase().includes(lc) || e.cas === query)
    .map(([, e]) => e)
  return { query, total_results: items.length, compounds: items.slice(0, limit) }
}

export async function getCompoundDetails(compoundName) {
  return find(compoundName)
}

export async function getExpressionSignature(compoundName, { tissue = 'Liver', dose = 'High' } = {}) {
  const c = find(compoundName)
  const sig = c?.signatures?.[tissue]?.[dose]
  return {
    compound: compoundName,
    tissue,
    dose,
    signature: sig ?? { up: [], down: [] },
  }
}

export async function getPathologyFindings(compoundName) {
  const c = find(compoundName)
  return { compound: compoundName, pathology_findings: c?.pathologies ?? [] }
}

/**
 * Find compounds with overlapping signatures (simple Jaccard similarity
 * on the union of liver high-dose up/down gene lists).
 */
export async function findSimilarCompounds(compoundName, limit = 5) {
  const base = find(compoundName)
  if (!base) return { compound: compoundName, similar: [] }
  const baseGenes = new Set([
    ...(base.signatures?.Liver?.High?.up ?? []),
    ...(base.signatures?.Liver?.High?.down ?? []),
  ])
  const ranked = Object.values(TGGATES_COMPOUNDS)
    .filter((c) => c.name.toLowerCase() !== base.name.toLowerCase())
    .map((c) => {
      const genes = new Set([
        ...(c.signatures?.Liver?.High?.up ?? []),
        ...(c.signatures?.Liver?.High?.down ?? []),
      ])
      const intersection = [...baseGenes].filter((g) => genes.has(g)).length
      const union = new Set([...baseGenes, ...genes]).size
      return { compound: c.name, jaccard: union ? intersection / union : 0 }
    })
    .sort((a, b) => b.jaccard - a.jaccard)
    .slice(0, limit)
  return { compound: compoundName, similar: ranked }
}

export async function getGeneAffectedCompounds(geneSymbol) {
  const matches = []
  for (const c of Object.values(TGGATES_COMPOUNDS)) {
    for (const tissue of Object.keys(c.signatures ?? {})) {
      for (const dose of Object.keys(c.signatures[tissue])) {
        const sig = c.signatures[tissue][dose]
        if (sig.up?.includes(geneSymbol) || sig.down?.includes(geneSymbol)) {
          matches.push({ compound: c.name, tissue, dose, direction: sig.up?.includes(geneSymbol) ? 'up' : 'down' })
        }
      }
    }
  }
  return { gene: geneSymbol, total_results: matches.length, affecting_compounds: matches }
}

export async function listHepatotoxicants({ mechanism } = {}) {
  let items = Object.values(TGGATES_COMPOUNDS).filter((c) => c.is_hepatotoxicant)
  if (mechanism) {
    const lc = mechanism.toLowerCase()
    items = items.filter((c) => c.mechanism?.toLowerCase().includes(lc))
  }
  return { total_results: items.length, hepatotoxicants: items }
}

export async function compareExpressionProfiles(compound1, compound2) {
  const sig1 = await getExpressionSignature(compound1)
  const sig2 = await getExpressionSignature(compound2)
  const up1 = new Set(sig1.signature.up)
  const up2 = new Set(sig2.signature.up)
  const down1 = new Set(sig1.signature.down)
  const down2 = new Set(sig2.signature.down)
  return {
    compound1,
    compound2,
    shared_upregulated: [...up1].filter((g) => up2.has(g)),
    shared_downregulated: [...down1].filter((g) => down2.has(g)),
    compound1_only_up: [...up1].filter((g) => !up2.has(g)),
    compound2_only_up: [...up2].filter((g) => !up1.has(g)),
  }
}
