/**
 * PubChem (PUG REST) service.
 *
 * Mirrors `backend/app/services/pubchem_service.py` + `pubchem_parsing.py`.
 * PubChem exposes 115M compounds, 1.3M bioassays, and rich cross-references.
 *
 * Endpoints used:
 *   - https://pubchem.ncbi.nlm.nih.gov/rest/pug      (data API)
 *   - https://pubchem.ncbi.nlm.nih.gov/rest/pug_view (rich views with sections)
 */

import { httpGet, isCasrn } from './_httpClient.js'

const PUG_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
const VIEW_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view'

const STANDARD_PROPERTIES = [
  'MolecularWeight',
  'MolecularFormula',
  'CanonicalSMILES',
  'IsomericSMILES',
  'InChI',
  'InChIKey',
  'XLogP',
  'ExactMass',
  'TPSA',
  'Complexity',
  'HBondDonorCount',
  'HBondAcceptorCount',
  'RotatableBondCount',
  'HeavyAtomCount',
  'AtomStereoCount',
  'BondStereoCount',
]

/**
 * Search PubChem by compound name and hydrate each CID with full details.
 *
 * @param {string} name
 * @param {number} [limit=20]
 */
export async function searchByName(name, limit = 20) {
  try {
    const result = await httpGet(`${PUG_BASE}/compound/name/${encodeURIComponent(name)}/cids/JSON`, {
      source: 'pubchem.name_to_cid',
    })
    const cids = (result?.IdentifierList?.CID ?? []).slice(0, limit)
    if (cids.length === 0) return { query: name, total_results: 0, compounds: [] }
    const compounds = (await Promise.all(cids.map((cid) => getCompoundByCid(cid)))).filter(Boolean)
    return { query: name, total_results: compounds.length, compounds }
  } catch (err) {
    return {
      query: name,
      total_results: 0,
      compounds: [],
      error: String(err?.message ?? err),
    }
  }
}

/**
 * Search PubChem by chemical structure (SMILES). Supports identity,
 * substructure, and similarity searches.
 *
 * @param {string} smiles
 * @param {'identity'|'substructure'|'similarity'} [search_type='identity']
 */
export async function searchBySmiles(smiles, search_type = 'identity') {
  try {
    let endpoint
    if (search_type === 'substructure') endpoint = 'substructure/smiles'
    else if (search_type === 'similarity') endpoint = 'similarity/smiles'
    else endpoint = 'smiles'
    const result = await httpGet(`${PUG_BASE}/compound/${endpoint}/${encodeURIComponent(smiles)}/cids/JSON`, {
      source: `pubchem.smiles.${search_type}`,
    })
    const cids = (result?.IdentifierList?.CID ?? []).slice(0, 100)
    return {
      query: smiles,
      search_type,
      total_results: cids.length,
      cids,
    }
  } catch (err) {
    return {
      query: smiles,
      total_results: 0,
      cids: [],
      error: String(err?.message ?? err),
    }
  }
}

/**
 * Get compound details by PubChem CID.
 *
 * @param {number|string} cid
 * @returns {Promise<object|null>}
 */
export async function getCompoundByCid(cid) {
  try {
    const data = await httpGet(`${PUG_BASE}/compound/cid/${cid}/JSON`, {
      source: 'pubchem.cid_view',
    })
    const compound = data?.PC_Compounds?.[0]
    if (!compound) return null
    const properties = await getCompoundProperties(cid).catch(() => ({}))
    return buildCompoundRecord(cid, compound, properties)
  } catch {
    return null
  }
}

/**
 * Get physicochemical properties for a CID.
 *
 * @param {number|string} cid
 */
export async function getCompoundProperties(cid) {
  try {
    const data = await httpGet(
      `${PUG_BASE}/compound/cid/${cid}/property/${STANDARD_PROPERTIES.join(',')}/JSON`,
      { source: 'pubchem.properties' },
    )
    return data?.PropertyTable?.Properties?.[0] ?? {}
  } catch (err) {
    return { error: String(err?.message ?? err) }
  }
}

/** All known synonyms for a compound. */
export async function getSynonyms(cid) {
  try {
    const data = await httpGet(`${PUG_BASE}/compound/cid/${cid}/synonyms/JSON`, {
      source: 'pubchem.synonyms',
    })
    return data?.InformationList?.Information?.[0]?.Synonym ?? []
  } catch {
    return []
  }
}

/**
 * Bioassay summary for a compound. PubChem returns a "assaysummary" table
 * with one row per AID; we filter by activity outcome.
 *
 * @param {number|string} cid
 * @param {'active'|'inactive'|'all'} [activity='active']
 * @param {number} [limit=50]
 */
export async function getBioassays(cid, activity = 'active', limit = 50) {
  try {
    const data = await httpGet(`${PUG_BASE}/compound/cid/${cid}/assaysummary/JSON`, {
      source: 'pubchem.assaysummary',
    })
    const table = data?.Table
    if (!table) return { cid, total_results: 0, assays: [] }
    const cols = (table.Columns?.Column ?? []).map(String)
    const rows = (table.Row ?? []).map((r) => Object.fromEntries(cols.map((c, i) => [c, r.Cell?.[i] ?? null])))
    const filtered = rows.filter((r) => {
      if (activity === 'all') return true
      const ao = String(r['Activity Outcome'] ?? '').toLowerCase()
      return activity === 'active' ? ao === 'active' : ao !== 'active'
    })
    return {
      cid,
      total_results: filtered.length,
      assays: filtered.slice(0, limit),
    }
  } catch (err) {
    return { cid, total_results: 0, assays: [], error: String(err?.message ?? err) }
  }
}

/**
 * Get GHS hazard / safety summary via PUG_VIEW. Returns the raw heading
 * structure so the frontend can render badges per hazard class.
 */
export async function getSafetyData(cid) {
  try {
    const data = await httpGet(`${VIEW_BASE}/data/compound/${cid}/JSON`, {
      params: { heading: 'GHS Classification' },
      source: 'pubchem.view.ghs',
    })
    return { cid, ghs_classification: data?.Record ?? {} }
  } catch (err) {
    return { cid, ghs_classification: {}, error: String(err?.message ?? err) }
  }
}

/**
 * Get pharmacology + biochemistry summary via PUG_VIEW.
 */
export async function getPharmacologyData(cid) {
  try {
    const data = await httpGet(`${VIEW_BASE}/data/compound/${cid}/JSON`, {
      params: { heading: 'Pharmacology and Biochemistry' },
      source: 'pubchem.view.pharmacology',
    })
    return { cid, pharmacology: data?.Record ?? {} }
  } catch (err) {
    return { cid, pharmacology: {}, error: String(err?.message ?? err) }
  }
}

/**
 * Cross-references to other databases (RegistryID xrefs include CAS, ChEMBL, etc.).
 */
export async function getCrossReferences(cid) {
  try {
    const data = await httpGet(`${PUG_BASE}/compound/cid/${cid}/xrefs/RegistryID/JSON`, {
      source: 'pubchem.xrefs',
    })
    const info = data?.InformationList?.Information ?? []
    const xrefs = {}
    for (const entry of info) {
      const ids = entry.RegistryID ?? []
      const grouped = {}
      for (const id of ids) {
        const parts = String(id).split(':')
        const namespace = parts.length > 1 ? parts[0] : 'Unknown'
        const value = parts.length > 1 ? parts.slice(1).join(':') : id
        if (!grouped[namespace]) grouped[namespace] = []
        grouped[namespace].push(value)
      }
      Object.assign(xrefs, grouped)
    }
    return { cid, cross_references: xrefs }
  } catch (err) {
    return { cid, cross_references: {}, error: String(err?.message ?? err) }
  }
}

/**
 * Resolve any identifier to a PubChem CID.
 *
 * @param {string} identifier
 * @param {'name'|'smiles'|'inchi'|'inchikey'|'cas'} [id_type='name']
 * @returns {Promise<number|null>}
 */
export async function resolveIdentifier(identifier, id_type = 'name') {
  try {
    const namespace = id_type === 'cas' ? 'name' : id_type
    const result = await httpGet(
      `${PUG_BASE}/compound/${namespace}/${encodeURIComponent(identifier)}/cids/JSON`,
      { source: `pubchem.resolve.${namespace}` },
    )
    return result?.IdentifierList?.CID?.[0] ?? null
  } catch {
    return null
  }
}

/**
 * Cascade through PubChem namespaces to map an arbitrary chemical identifier
 * to all known identifiers (CID, SMILES, InChI, InChIKey, CASRN).
 */
export async function resolveToAllIds(query) {
  try {
    let cid = await resolveIdentifier(query, 'name')
    if (!cid) cid = await resolveIdentifier(query, 'smiles')
    if (!cid) cid = await resolveIdentifier(query, 'inchikey')
    if (!cid) return { query, resolved: false }

    const [properties, synonyms] = await Promise.all([getCompoundProperties(cid), getSynonyms(cid)])
    const casrn = synonyms.find(isCasrn) ?? null
    return {
      query,
      resolved: true,
      pubchem_cid: cid,
      casrn,
      canonical_smiles: properties.CanonicalSMILES ?? null,
      isomeric_smiles: properties.IsomericSMILES ?? null,
      inchi: properties.InChI ?? null,
      inchi_key: properties.InChIKey ?? null,
      molecular_weight: properties.MolecularWeight ?? null,
      molecular_formula: properties.MolecularFormula ?? null,
      preferred_name: synonyms[0] ?? null,
      synonyms: synonyms.slice(0, 25),
    }
  } catch (err) {
    return { query, resolved: false, error: String(err?.message ?? err) }
  }
}

/* -------------------------------------------------------------------------- */
/*  Internal                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Build a unified PubChem compound record from the raw PC_Compound + property
 * payload. Mirrors `pubchem_parsing.build_compound_record`.
 */
function buildCompoundRecord(cid, raw, properties) {
  const propsByLabel = {}
  for (const prop of raw?.props ?? []) {
    const label = prop.urn?.label
    const name = prop.urn?.name
    const key = name ? `${label}.${name}` : label
    if (!key) continue
    const v = prop.value ?? {}
    propsByLabel[key] = v.sval ?? v.fval ?? v.ival ?? v.binary ?? null
  }
  return {
    cid: Number(cid),
    iupac_name: propsByLabel['IUPAC Name.Preferred'] ?? propsByLabel['IUPAC Name'] ?? null,
    canonical_smiles: properties.CanonicalSMILES ?? propsByLabel['SMILES.Canonical'] ?? null,
    isomeric_smiles: properties.IsomericSMILES ?? propsByLabel['SMILES.Isomeric'] ?? null,
    inchi: properties.InChI ?? propsByLabel['InChI.Standard'] ?? null,
    inchi_key: properties.InChIKey ?? propsByLabel['InChIKey.Standard'] ?? null,
    molecular_formula: properties.MolecularFormula ?? propsByLabel['Molecular Formula'] ?? null,
    molecular_weight: properties.MolecularWeight ?? propsByLabel['Molecular Weight'] ?? null,
    exact_mass: properties.ExactMass ?? null,
    xlogp: properties.XLogP ?? null,
    tpsa: properties.TPSA ?? null,
    h_bond_donor_count: properties.HBondDonorCount ?? null,
    h_bond_acceptor_count: properties.HBondAcceptorCount ?? null,
    rotatable_bond_count: properties.RotatableBondCount ?? null,
    heavy_atom_count: properties.HeavyAtomCount ?? null,
    complexity: properties.Complexity ?? null,
  }
}
