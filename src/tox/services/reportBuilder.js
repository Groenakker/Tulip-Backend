import { getBioactivity, getMechanism, getMolecule, searchCompoundsChembl } from "./chembl.js";
function regStatus() {
  return {
    is_svhc: false,
    svhc_reason: null,
    svhc_listing_date: null,
    is_endocrine_disruptor: false,
    ed_category: null,
    ed_source: null,
    is_gras: false,
    gras_status: null,
    gras_use: null,
    is_prop65: false,
    prop65_listing_mechanism: null,
    prop65_listing_date: null,
    prop65_endpoints: [],
    is_cmr: false,
    cmr_carcinogenic: null,
    cmr_mutagenic: null,
    cmr_reprotoxic: null,
    cmr_classification: null,
    is_reach_annex_xiv: false,
    annex_xiv_sunset_date: null,
    is_reach_restricted: false,
    restriction_details: null
  };
}
function podIsoSkeleton() {
  return {
    pod_candidates: [],
    qualitative_studies: [],
    selected_pod: null,
    proposed_selected_pod: null,
    selection_rationale: null,
    selection_review_state: "unselected",
    selection_review_note: null,
    top_alternative_candidates: [],
    ttc_reference: {
      cramer_class: "III",
      cramer_description: "MERN clone placeholder TTC scaffold",
      ttc_value: 1.5,
      ttc_mg_kg_day: 0.023,
      has_genotoxic_alerts: false,
      genotoxic_ttc: null,
      applicable: false,
      applicability_note: "TTC not auto-selected in scaffold; configure QSAR/regulatory dossier sources."
    },
    use_ttc_as_fallback: false,
    endpoint_coverage: [],
    endpoint_evidence_map: [],
    coverage_score: 0,
    data_gaps: ["Bring forward legacy FastAPI reach/literature/QSAR ingests for parity"],
    critical_gaps: [],
    uf_guidance: [],
    proposed_uf_guidance: [],
    data_adequacy: "limited",
    confidence_statement: "ChemBL-backed demonstration dossier; extend for production parity.",
    recommended_next_steps: ["Wire REACH/ECHA, publications, Trials, QSAR services"],
    data_sources: ["chembl_activity", "chembl_structure"]
  };
}
async function resolvePrimaryChembl(query) {
  const searched = await searchCompoundsChembl(query, 8, void 0);
  const pick = searched.compounds[0];
  if (!pick?.chembl_id) return null;
  const full = await getMolecule(String(pick.chembl_id));
  if (!full) return null;
  return { chemblId: String(pick.chembl_id), molecule: full };
}
async function buildDemonstrationReport(opts) {
  const query = opts.query.trim();
  const resolved = await resolvePrimaryChembl(query);
  if (!resolved) {
    return emptyReport(query, opts.evaluation_scope, opts.target_route);
  }
  const { chemblId, molecule } = resolved;
  const props = molecule.properties ?? {};
  const [bioSummary, mechanisms] = await Promise.all([
    getBioactivity({ molecule_chembl_id: chemblId, limit: 60 }),
    getMechanism(chemblId, 20)
  ]);
  const mw = Number(props.molecular_weight ?? props.mw_freebase ?? 0) || null;
  const alogp = Number(props.alogp ?? 0);
  const reportCompoundPrimary = {
    chembl_id: chemblId,
    pref_name: molecule.pref_name ?? null,
    molecule_type: molecule.molecule_type ?? null,
    max_phase: molecule.max_phase ?? null,
    structure_type: null,
    canonical_smiles: molecule.canonical_smiles ?? null,
    inchi_key: molecule.inchi_key ?? null,
    black_box_warning: molecule.black_box_warning != null ? Number(molecule.black_box_warning) : null,
    withdrawn_flag: molecule.withdrawn_flag === null || molecule.withdrawn_flag === void 0 ? null : Boolean(molecule.withdrawn_flag),
    withdrawn_reason: molecule.withdrawn_reason ?? null,
    properties: {
      molecular_weight: mw,
      mw_freebase: props.mw_freebase != null ? Number(props.mw_freebase) : null,
      alogp: props.alogp != null ? Number(props.alogp) : null,
      psa: props.psa != null ? Number(props.psa) : null,
      hbd: props.hbd != null ? Number(props.hbd) : null,
      hba: props.hba != null ? Number(props.hba) : null,
      rotatable_bonds: props.rotatable_bonds != null ? Number(props.rotatable_bonds) : props.rtb != null ? Number(props.rtb) : null,
      aromatic_rings: props.aromatic_rings != null ? Number(props.aromatic_rings) : null,
      heavy_atoms: props.heavy_atoms != null ? Number(props.heavy_atoms) : null,
      qed_weighted: props.qed_weighted != null ? Number(props.qed_weighted) : null,
      num_ro5_violations: props.num_ro5_violations != null ? Number(props.num_ro5_violations) : null
    }
  };
  const admet = {
    properties: {
      molecular_weight: Number(mw ?? 0),
      alogp,
      hbd: Number(props.hbd ?? 0),
      hba: Number(props.hba ?? 0),
      psa: Number(props.psa ?? 0),
      rotatable_bonds: Number(reportCompoundPrimary.properties.rotatable_bonds ?? 0),
      aromatic_rings: reportCompoundPrimary.properties.aromatic_rings,
      heavy_atoms: reportCompoundPrimary.properties.heavy_atoms,
      qed: reportCompoundPrimary.properties.qed_weighted
    },
    drug_likeness: {
      lipinski_pass: true,
      lipinski_violations: 0,
      lipinski_details: [],
      veber_pass: true,
      lead_like: true
    },
    absorption_prediction: "Heuristic scaffold (ChemBL physicochemistry only)",
    bbb_penetration: "Not predicted in scaffold"
  };
  const podAssessment = {
    suggested_noael: null,
    suggested_loael: null,
    confidence: bioSummary.total_results > 10 ? "medium" : "low",
    data_sources: ["ChEMBL activity"],
    endpoint_summary: [],
    dose_response_data: [],
    critical_effects: [],
    echa_endpoints: []
  };
  const bioactivityAlerts = bioSummary.bioactivities.filter((row) => Number(row.pchembl_value ?? 0) >= 7).slice(0, 8).map((row) => ({
    target: String(row.target_pref_name ?? "Unknown"),
    potency: `${row.standard_value ?? "?"} ${row.standard_units ?? ""}`.trim(),
    type: String(row.standard_type ?? ""),
    significance: String(row.pchembl_value ?? "")
  }));
  return {
    query,
    evaluation_context: {
      target_route: opts.target_route ?? null,
      device_contact_category: null,
      contact_duration_category: null,
      contact_duration_days: null,
      patient_population: null,
      body_weight_kg: null,
      utilization_factor: null,
      context_complete: (opts.evaluation_scope ?? "compound") === "compound",
      missing_fields: opts.evaluation_scope === "device" ? [
        "device_contact_category",
        "contact_duration_category",
        "contact_duration_days",
        "patient_population",
        "body_weight_kg",
        "utilization_factor"
      ] : []
    },
    resolved_identifiers: {
      search_type: "name",
      resolved: true,
      preferred_name: reportCompoundPrimary.pref_name,
      casrn: null,
      pubchem_cid: null,
      dtxsid: null,
      chembl_id: chemblId,
      canonical_smiles: reportCompoundPrimary.canonical_smiles,
      inchi_key: reportCompoundPrimary.inchi_key,
      molecular_formula: null,
      molecular_weight: mw,
      iupac_name: null,
      synonyms_count: 0,
      sources_consulted: ["chembl"],
      resolution_path: ["chembl_synonym_then_pref"]
    },
    summary: {
      compounds_found: 1,
      literature_count: 0,
      trials_count: 0,
      has_bioactivity: bioSummary.total_results > 0,
      has_admet: true,
      has_echa_data: false,
      echa_endpoints_count: 0,
      has_pod_data: bioSummary.total_results > 0,
      pod_confidence: podAssessment.confidence,
      has_toxtree_predictions: false,
      toxtree_cramer_class: null,
      toxtree_mutagenicity: null,
      has_websearch_results: false,
      regulatory_reports_count: 0,
      sds_count: 0
    },
    toxicity_profile: {
      risk_level: bioactivityAlerts.length ? "elevated" : "low",
      key_findings: [
        `${bioSummary.total_results} ChEMBL activity rows fetched`,
        mechanisms.total_results ? `${mechanisms.total_results} mechanism mappings` : "No mechanisms returned"
      ],
      target_concerns: bioactivityAlerts.slice(0, 6).map((a) => ({
        target: a.target,
        concern: `High pChEMBL highlight (${a.significance})`,
        potency: a.potency,
        activity_type: a.type
      })),
      property_flags: mw && mw > 500 ? ["Molecular weight > 500 Da (Lipinski context)"] : []
    },
    compounds: {
      primary: reportCompoundPrimary,
      related: [],
      all_matches: 1
    },
    pod_assessment: podAssessment,
    pod_assessment_iso: podIsoSkeleton(),
    bioactivity: bioSummary,
    admet,
    echa_data: null,
    mechanisms,
    literature: [],
    clinical_trials: [],
    safety_signals: {
      bioactivity_alerts: bioactivityAlerts,
      clinical_signals: [],
      overall_assessment: bioactivityAlerts.length ? `${bioactivityAlerts.length} potency highlights from ChEMBL slice` : "No potency highlights exceeding scaffold threshold"
    },
    toxtree_predictions: null,
    web_search_results: null,
    ai_summary: {
      compound_name: String(reportCompoundPrimary.pref_name ?? query),
      compound_class: "ChemBL-resolved scaffold",
      chemical_family: "Unclassified (extend ingests)",
      executive_summary: `${chemblId} assembled from ChemBL chemistry + bioactivity. Attach legacy dossier ingest for regulatory parity.`,
      compound_description: `Structure from ChemBL (${chemblId}). Populate literature, Trials, QSAR, REACH for ISO-aligned dossiers.`,
      key_characteristics: [
        mw != null ? `MW \u2248 ${mw.toFixed(1)} Da` : "MW n/a",
        `ALogP \u2248 ${Number.isFinite(alogp) ? alogp.toFixed(2) : String(alogp)}`
      ],
      regulatory_status: regStatus(),
      tox_signals: [],
      safety_concerns: bioactivityAlerts.length > 0 ? ["Review potency highlights flagged from ChemBL slice"] : [],
      favorable_findings: ["ChemBL exposes structure + assay landscape"],
      overall_risk: bioactivityAlerts.length ? "elevated" : "low",
      risk_rationale: bioactivityAlerts.length ? "Elevated potency in sampled slice" : "No strong potency slice hits",
      data_coverage_score: 35,
      data_sources_used: ["ChemBL"],
      data_gaps: ["REACH dossiers", "PubMed / Europe PMC", "ClinicalTrials.gov", "QSAR models"],
      recommendations: ["Layer remaining FastAPI dossier collaborators behind Express services"],
      llm_executive_summary: void 0,
      llm_detailed_assessment: void 0,
      llm_recommendations: void 0,
      llm_compound_overview: void 0,
      llm_assessment_outcomes: void 0
    },
    read_across_relationships: [],
    family_suggestion: null,
    data_completeness: null,
    read_across_suggestions: null,
    reach_database: null,
    pubchem_data: null,
    comptox_data: null
  };
}
function emptyReport(query, evaluation_scope, target_route) {
  const ctxComplete = (evaluation_scope ?? "compound") === "compound";
  return {
    query,
    evaluation_context: {
      target_route: target_route ?? null,
      device_contact_category: null,
      contact_duration_category: null,
      contact_duration_days: null,
      patient_population: null,
      body_weight_kg: null,
      utilization_factor: null,
      context_complete: ctxComplete,
      missing_fields: evaluation_scope === "device" ? [
        "device_contact_category",
        "contact_duration_category",
        "contact_duration_days",
        "patient_population",
        "body_weight_kg",
        "utilization_factor"
      ] : []
    },
    resolved_identifiers: {
      search_type: "name",
      resolved: false,
      preferred_name: null,
      casrn: null,
      pubchem_cid: null,
      dtxsid: null,
      chembl_id: null,
      canonical_smiles: null,
      inchi_key: null,
      molecular_formula: null,
      molecular_weight: null,
      iupac_name: null,
      synonyms_count: 0,
      sources_consulted: ["chembl"],
      resolution_path: ["chembl_synonym_then_pref"]
    },
    summary: {
      compounds_found: 0,
      literature_count: 0,
      trials_count: 0,
      has_bioactivity: false,
      has_admet: false,
      has_echa_data: false,
      echa_endpoints_count: 0,
      has_pod_data: false,
      pod_confidence: "low",
      has_toxtree_predictions: false,
      toxtree_cramer_class: null,
      toxtree_mutagenicity: null,
      has_websearch_results: false,
      regulatory_reports_count: 0,
      sds_count: 0
    },
    toxicity_profile: {
      risk_level: "insufficient_data",
      key_findings: ["ChemBL synonym/pref lookup returned no molecule"],
      target_concerns: [],
      property_flags: []
    },
    pod_assessment: {
      suggested_noael: null,
      suggested_loael: null,
      confidence: "low",
      data_sources: [],
      endpoint_summary: [],
      dose_response_data: [],
      critical_effects: [],
      echa_endpoints: []
    },
    pod_assessment_iso: podIsoSkeleton(),
    bioactivity: { total_results: 0, bioactivities: [] },
    admet: null,
    echa_data: null,
    mechanisms: null,
    literature: [],
    clinical_trials: [],
    safety_signals: {
      bioactivity_alerts: [],
      clinical_signals: [],
      overall_assessment: "No molecule resolved \u2014 expand identifiers / spelling"
    },
    toxtree_predictions: null,
    web_search_results: null,
    ai_summary: {
      error: "MERN scaffold: compound not resolved via ChemBL",
      note: query
    },
    compounds: { primary: null, related: [], all_matches: 0 }
  };
}
export {
  buildDemonstrationReport,
  resolvePrimaryChembl
};
