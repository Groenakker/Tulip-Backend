/**
 * Extractables & Leachables (E&L) curated chemical library.
 *
 * Mirrors `backend/app/services/el_library.py`. Provides a curated set
 * of chemicals frequently encountered in medical-device extractables /
 * leachables assessments, with pre-populated TDI, ADI, RfD, Cramer
 * class, IARC group, and material associations.
 *
 * Extend the `LIBRARY` constant with more entries from the Python
 * implementation as needed.
 */

const LIBRARY = [
  {
    casrn: '117-81-7',
    name: 'Bis(2-ethylhexyl) phthalate (DEHP)',
    synonyms: ['DEHP', 'Diethylhexyl phthalate'],
    category: 'Plasticizer',
    materials: ['PVC'],
    reference_values: [
      { type: 'TDI', value: 0.05, unit: 'mg/kg bw/day', basis: 'EFSA 2019' },
    ],
    cramer_class: 'III',
    ttc_value: 90,
    iarc_group: '2B',
    mutagenicity_concern: false,
    carcinogenicity_concern: true,
    reproductive_concern: true,
    regulatory_notes: ['Reproductive toxicant — restricted under REACH Annex XVII'],
  },
  {
    casrn: '128-37-0',
    name: 'Butylated hydroxytoluene (BHT)',
    synonyms: ['BHT'],
    category: 'Antioxidant',
    materials: ['Polyethylene', 'Polypropylene', 'Polyurethane'],
    reference_values: [
      { type: 'ADI', value: 0.25, unit: 'mg/kg bw/day', basis: 'EFSA 2012' },
    ],
    cramer_class: 'II',
    ttc_value: 540,
    iarc_group: '3',
    mutagenicity_concern: false,
    carcinogenicity_concern: false,
    reproductive_concern: false,
    regulatory_notes: ['Approved food contact antioxidant'],
  },
  {
    casrn: '7440-50-8',
    name: 'Copper',
    synonyms: ['Cu'],
    category: 'Metal Ion',
    materials: ['Stainless Steel', 'Brass'],
    reference_values: [
      { type: 'RfD', value: 0.04, unit: 'mg/kg bw/day', basis: 'EPA IRIS' },
    ],
    cramer_class: 'III',
    ttc_value: 90,
    iarc_group: '3',
    mutagenicity_concern: false,
    carcinogenicity_concern: false,
    reproductive_concern: false,
    regulatory_notes: ['Essential element; limit per ICH Q3D'],
  },
  {
    casrn: '79-06-1',
    name: 'Acrylamide',
    synonyms: ['Prop-2-enamide'],
    category: 'Residual Monomer',
    materials: ['Polyacrylamide'],
    reference_values: [
      { type: 'BMDL10', value: 0.17, unit: 'mg/kg bw/day', basis: 'EFSA 2015' },
    ],
    cramer_class: 'III',
    ttc_value: 0.0025,
    iarc_group: '2A',
    mutagenicity_concern: true,
    carcinogenicity_concern: true,
    reproductive_concern: true,
    regulatory_notes: ['Genotoxic carcinogen — TTC genotoxic threshold applies'],
  },
  {
    casrn: '50-00-0',
    name: 'Formaldehyde',
    synonyms: ['Methanal'],
    category: 'Degradation Product',
    materials: ['Polyoxymethylene', 'PUR'],
    reference_values: [
      { type: 'RfC', value: 9.83e-3, unit: 'mg/m3', basis: 'ATSDR' },
    ],
    cramer_class: 'III',
    ttc_value: 90,
    iarc_group: '1',
    mutagenicity_concern: true,
    carcinogenicity_concern: true,
    reproductive_concern: false,
    regulatory_notes: ['Known human carcinogen (IARC Group 1)'],
  },
]

const BY_CAS = new Map(LIBRARY.map((e) => [e.casrn, e]))

/** Search by name or CAS, optionally filtered by category or material. */
export function search(query, { category, material } = {}) {
  const lc = query.toLowerCase().trim()
  return LIBRARY.filter((e) => {
    const matches =
      e.casrn === query ||
      e.name.toLowerCase().includes(lc) ||
      e.synonyms.some((s) => s.toLowerCase().includes(lc))
    if (!matches) return false
    if (category && e.category.toLowerCase() !== category.toLowerCase()) return false
    if (material && !e.materials.map((m) => m.toLowerCase()).includes(material.toLowerCase())) return false
    return true
  })
}

export function getByCas(cas) {
  return BY_CAS.get(cas) ?? null
}

export function listByCategory(category) {
  return LIBRARY.filter((e) => e.category.toLowerCase() === category.toLowerCase())
}

export function listByMaterial(material) {
  return LIBRARY.filter((e) =>
    e.materials.map((m) => m.toLowerCase()).includes(material.toLowerCase()),
  )
}

export function listCategories() {
  return [...new Set(LIBRARY.map((e) => e.category))].sort()
}

export function listMaterials() {
  const materials = new Set()
  LIBRARY.forEach((e) => e.materials.forEach((m) => materials.add(m)))
  return [...materials].sort()
}

export function getStatistics() {
  const byCategory = {}
  let mut = 0
  let carc = 0
  let repro = 0
  for (const e of LIBRARY) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1
    if (e.mutagenicity_concern) mut++
    if (e.carcinogenicity_concern) carc++
    if (e.reproductive_concern) repro++
  }
  return {
    total_chemicals: LIBRARY.length,
    by_category: byCategory,
    mutagenicity_concerns: mut,
    carcinogenicity_concerns: carc,
    reproductive_concerns: repro,
  }
}

export function listWithConcerns(concern_type) {
  switch (concern_type.toLowerCase()) {
    case 'mutagenicity':
      return LIBRARY.filter((e) => e.mutagenicity_concern)
    case 'carcinogenicity':
      return LIBRARY.filter((e) => e.carcinogenicity_concern)
    case 'reproductive':
      return LIBRARY.filter((e) => e.reproductive_concern)
    default:
      return []
  }
}
