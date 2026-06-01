import axios from "axios";
const BASE_URL = "https://www.ebi.ac.uk/chembl/api/data";
async function chemblRequest(endpoint, params) {
  const merged = { format: "json", ...params };
  const { data } = await axios.get(`${BASE_URL}/${endpoint}`, { params: merged, timeout: 4e4 });
  return data;
}
async function searchCompoundsChembl(query, limit, maxPhase) {
  try {
    const params = {
      molecule_synonyms__molecule_synonym__icontains: query,
      limit
    };
    if (maxPhase !== void 0 && maxPhase !== null) params.max_phase = maxPhase;
    const result = await chemblRequest("molecule", params);
    return formatMoleculeResults(query, result);
  } catch {
    try {
      const params = { pref_name__icontains: query, limit };
      if (maxPhase !== void 0 && maxPhase !== null) params.max_phase = maxPhase;
      const result = await chemblRequest("molecule", params);
      return formatMoleculeResults(query, result);
    } catch {
      return { query, total_results: 0, compounds: [] };
    }
  }
}
function formatMoleculeResults(query, result) {
  const compounds = [];
  for (const mol of result.molecules ?? []) {
    const props = mol.molecule_properties ?? {};
    compounds.push({
      chembl_id: mol.molecule_chembl_id,
      pref_name: mol.pref_name,
      molecule_type: mol.molecule_type,
      max_phase: mol.max_phase,
      structure_type: mol.structure_type,
      canonical_smiles: mol.molecule_structures?.canonical_smiles,
      molecular_weight: props.full_mwt,
      alogp: props.alogp
    });
  }
  return {
    query,
    total_results: result.page_meta?.total_count ?? compounds.length,
    compounds
  };
}
async function getMolecule(chemblId) {
  try {
    const mol = await chemblRequest(`molecule/${chemblId}`);
    const props = mol.molecule_properties ?? {};
    const structures = mol.molecule_structures ?? {};
    return {
      chembl_id: mol.molecule_chembl_id,
      pref_name: mol.pref_name,
      molecule_type: mol.molecule_type,
      max_phase: mol.max_phase,
      canonical_smiles: structures.canonical_smiles,
      inchi_key: structures.standard_inchi_key,
      black_box_warning: mol.black_box_warning,
      withdrawn_flag: mol.withdrawn_flag,
      withdrawn_reason: mol.withdrawn_reason,
      properties: {
        molecular_weight: props.full_mwt,
        mw_freebase: props.mw_freebase,
        alogp: props.alogp,
        psa: props.psa,
        hbd: props.hbd,
        hba: props.hba,
        rotatable_bonds: props.rtb,
        aromatic_rings: props.aromatic_rings,
        heavy_atoms: props.heavy_atoms,
        qed_weighted: props.qed_weighted,
        num_ro5_violations: props.num_ro5_violations
      }
    };
  } catch {
    return null;
  }
}
async function getBioactivity(opts) {
  try {
    const params = { limit: opts.limit };
    if (opts.molecule_chembl_id) params.molecule_chembl_id = opts.molecule_chembl_id;
    if (opts.target_chembl_id) params.target_chembl_id = opts.target_chembl_id;
    if (opts.activity_type) params.standard_type = opts.activity_type;
    if (opts.min_pchembl != null) params.pchembl_value__gte = opts.min_pchembl;
    const result = await chemblRequest("activity", params);
    const bioactivities = (result.activities ?? []).map((act) => ({
      activity_id: act.activity_id,
      molecule_chembl_id: act.molecule_chembl_id,
      target_chembl_id: act.target_chembl_id,
      target_pref_name: act.target_pref_name,
      target_organism: act.target_organism,
      standard_type: act.standard_type,
      standard_value: act.standard_value,
      standard_units: act.standard_units,
      pchembl_value: act.pchembl_value,
      assay_type: act.assay_type,
      assay_description: act.assay_description
    }));
    return {
      total_results: result.page_meta?.total_count ?? bioactivities.length,
      bioactivities
    };
  } catch {
    return { total_results: 0, bioactivities: [] };
  }
}
async function getMechanism(moleculeChemblId, limit) {
  try {
    const result = await chemblRequest("mechanism", {
      molecule_chembl_id: moleculeChemblId,
      limit
    });
    return {
      total_results: result.page_meta?.total_count ?? 0,
      mechanisms: result.mechanisms ?? []
    };
  } catch {
    return { total_results: 0, mechanisms: [] };
  }
}
export {
  getBioactivity,
  getMechanism,
  getMolecule,
  searchCompoundsChembl
};
