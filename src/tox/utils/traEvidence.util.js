export function emptyEvidence(projectId, assignmentId, a) {
  const compoundId = a?.compound_id ?? 0
  const compoundName = a?.compound_name ?? 'Compound'
  return {
    project_id: projectId,
    assignment_id: assignmentId,
    compound_id: compoundId,
    compound_name: compoundName,
    cas_number: a?.compound_cas ?? null,
    smiles_available: Boolean(a?.smiles),
    search_support: {
      compound_name_query: compoundName,
      cas_query: a?.compound_cas ?? null,
      smiles_query: null,
      services: ['chembl'],
    },
    direct_read_across: {
      strict_candidate_count: 0,
      strict_candidate_preview: [],
      fallback_candidate_count: 0,
      selected_fallback_tier: null,
      fallback_candidate_preview: [],
      error: 'MERN scaffold',
    },
    family_bridge: {
      transferable_candidates_count: 0,
      transferable_candidates: [],
      families: [],
    },
    external_enrichment: {
      searched: false,
      min_similarity: 0,
      candidate_count: 0,
      pod_backed_candidate_count: 0,
      candidates: [],
    },
    current_resolution: {
      ttc_fallback_reviewed: false,
      targeted_testing_plan_documented: false,
    },
    recommended_path: 'extend_mern_server',
    recommended_actions: ['Wire read-across + evidence services from legacy backend'],
  }
}
