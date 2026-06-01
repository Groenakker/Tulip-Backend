/**
 * Chemical identifier resolution service.
 *
 * Mirrors `backend/app/services/identifier_service.py`. Takes any
 * chemical identifier (name, CAS, SMILES, InChI, InChIKey, ChEMBL,
 * DSSTox) and resolves it across PubChem + CompTox + ChEMBL so the SPA
 * always has a `ResolvedIdentifier` to anchor unified profile views.
 */

import * as pubchem from './pubchem.service.js'
import * as comptox from './comptox.service.js'
import { isCasrn, isInchiKey, looksLikeSmiles } from './_httpClient.js'
import { searchCompoundsChembl } from './chembl.js'

/**
 * Resolve an identifier across sources. Returns `{ ...ids }` plus the
 * resolution path so the UI can show provenance.
 */
export async function resolve(identifier, { resolve_all = true } = {}) {
  const idType = detectType(identifier)
  const path = []
  const sources = []

  let pubchemId = null
  let casrn = null
  let canonicalSmiles = null
  let inchiKey = null
  let preferredName = null
  let molecularFormula = null
  let molecularWeight = null

  const pubchemResolved = await pubchem.resolveToAllIds(identifier)
  sources.push('pubchem')
  path.push(`pubchem.resolveToAllIds (${pubchemResolved.resolved ? 'hit' : 'miss'})`)
  if (pubchemResolved.resolved) {
    pubchemId = pubchemResolved.pubchem_cid ?? null
    casrn = pubchemResolved.casrn ?? null
    canonicalSmiles = pubchemResolved.canonical_smiles ?? null
    inchiKey = pubchemResolved.inchi_key ?? null
    preferredName = pubchemResolved.preferred_name ?? null
    molecularFormula = pubchemResolved.molecular_formula ?? null
    molecularWeight = pubchemResolved.molecular_weight ?? null
  }

  let dtxsid = null
  if (resolve_all) {
    const compoundDetail = casrn
      ? await comptox.searchByCasrn(casrn)
      : await comptox.searchByName(identifier).then((r) => r.substances?.[0] ?? null)
    sources.push('comptox')
    if (compoundDetail) {
      dtxsid = compoundDetail.dtxsid ?? null
      casrn = casrn ?? compoundDetail.cas_number ?? null
      preferredName = preferredName ?? compoundDetail.preferred_name ?? null
      canonicalSmiles = canonicalSmiles ?? compoundDetail.smiles ?? null
      inchiKey = inchiKey ?? compoundDetail.inchi_key ?? null
    }
  }

  let chemblId = null
  if (resolve_all) {
    const chembl = await searchCompoundsChembl(preferredName ?? identifier, 1, undefined)
    sources.push('chembl')
    chemblId = chembl.compounds?.[0]?.chembl_id ?? null
  }

  const resolved = Boolean(pubchemId || dtxsid || chemblId)

  const payload = {
    query: identifier,
    search_type: idType,
    resolved,
    preferred_name: preferredName,
    casrn,
    pubchem_cid: pubchemId,
    dtxsid,
    chembl_id: chemblId,
    canonical_smiles: canonicalSmiles,
    inchi_key: inchiKey,
    molecular_formula: molecularFormula,
    molecular_weight: molecularWeight,
    iupac_name: null,
    synonyms_count: pubchemResolved.synonyms?.length ?? 0,
    sources_consulted: sources,
    resolution_path: path,
  }

  return {
    ...payload,
    to_dict() {
      return payload
    },
  }
}

/** Resolve many identifiers at once. */
export async function batchResolve(identifiers, { resolve_all = false } = {}) {
  const results = await Promise.all(identifiers.map((id) => resolve(id, { resolve_all })))
  return {
    total_requested: identifiers.length,
    total_resolved: results.filter((r) => r.resolved).length,
    results: results.map((r) => r.to_dict()),
  }
}

/** Unified profile: identifier resolution + the most useful upstream payloads. */
export async function getUnifiedProfile(identifier) {
  const resolved = await resolve(identifier, { resolve_all: true })
  const dict = resolved.to_dict()
  const [pubchemDetail, comptoxDetail] = await Promise.all([
    dict.pubchem_cid ? pubchem.getCompoundByCid(dict.pubchem_cid).catch(() => null) : null,
    dict.dtxsid ? comptox.getChemicalDetails(dict.dtxsid).catch(() => null) : null,
  ])
  return {
    identifier: dict,
    pubchem: pubchemDetail,
    comptox: comptoxDetail,
  }
}

/**
 * Map a list of source ids of one type to a target id type. Currently
 * supports `casrn <-> pubchem_cid` and `name -> chembl_id`.
 */
export async function mapIdentifiers({ source_type, source_ids, target_type }) {
  const mapped = await Promise.all(
    source_ids.map(async (id) => {
      const r = await resolve(id, { resolve_all: true })
      const d = r.to_dict()
      return { source: id, target: d[target_type] ?? null }
    }),
  )
  return { source_type, target_type, total: mapped.length, mappings: mapped }
}

/** Validate an identifier — does it match the expected pattern and resolve? */
export async function validateIdentifier(identifier, { expected_type } = {}) {
  const detected = detectType(identifier)
  if (expected_type && detected !== expected_type) {
    return { identifier, valid: false, reason: `Expected ${expected_type}, detected ${detected}` }
  }
  const r = await resolve(identifier, { resolve_all: false })
  return { identifier, valid: r.resolved, detected_type: detected, resolved: r.to_dict() }
}

function detectType(identifier) {
  if (!identifier) return 'unknown'
  if (isCasrn(identifier)) return 'cas'
  if (isInchiKey(identifier)) return 'inchikey'
  if (/^CHEMBL\d+$/i.test(identifier)) return 'chembl_id'
  if (/^DTXSID/i.test(identifier)) return 'dtxsid'
  if (/^InChI=/i.test(identifier)) return 'inchi'
  if (looksLikeSmiles(identifier)) return 'smiles'
  return 'name'
}
