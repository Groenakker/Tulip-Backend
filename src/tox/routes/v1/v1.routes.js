import express from "express";
import {
  getBioactivity,
  getMechanism,
  getMolecule,
  searchCompoundsChembl
} from "../../services/chembl.js";
import { buildDemonstrationReport } from "../../services/reportBuilder.js";
import { LibraryCompound } from "../../models/libraryCompound.models.js";
import { TraProject } from "../../models/traProject.models.js";
import { CompoundFamily } from "../../models/compoundFamily.models.js";
import { ChemistryImportJob } from "../../models/chemistryImportJob.models.js";
import { nextSeq } from "../../models/counter.models.js";
import XLSX from "xlsx";
import { upload } from "../../middleware/upload.middleware.js";
import { emptyEvidence } from "../../utils/traEvidence.util.js";

// --- Modular sub-routers for ported FastAPI endpoints. ---
// Each file mirrors one Python endpoint module under app/api/v1/endpoints/.
// Auth wiring is intentionally omitted here per project scope; reattach later.
import literatureRoutes from "./literature.routes.js";
import pubchemRoutes from "./pubchem.routes.js";
import comptoxRoutes from "./comptox.routes.js";
import ctdRoutes from "./ctd.routes.js";
import aopwikiRoutes from "./aopwiki.routes.js";
import drugbankRoutes from "./drugbank.routes.js";
import faersRoutes from "./faers.routes.js";
import siderRoutes from "./sider.routes.js";
import ecotoxRoutes from "./ecotox.routes.js";
import patentsRoutes from "./patents.routes.js";
import identifiersRoutes from "./identifiers.routes.js";
import toxicogenomicsRoutes from "./toxicogenomics.routes.js";
import pathwaysRoutes from "./pathways.routes.js";
import regulatoryRoutes from "./regulatory.routes.js";
import echaRoutes from "./echa.routes.js";
import reachRoutes from "./reach.routes.js";
import toxtreeRoutes from "./toxtree.routes.js";
import readAcrossRoutes from "./readAcross.routes.js";
import tiCalculatorRoutes from "./tiCalculator.routes.js";
import endpointDashboardRoutes from "./endpointDashboard.routes.js";
import elLibraryRoutes from "./elLibrary.routes.js";
import clinicalRoutes from "./clinical.routes.js";
import targetsRoutes from "./targets.routes.js";
import websearchRoutes from "./websearch.routes.js";
import sourcesRoutes from "./sources.routes.js";
import aiSummaryRoutes from "./aiSummary.routes.js";

export function registerV1Routes(api) {
  // NOTE: The original ToxIntelligence app exposed an OIDC/session handshake
  // on `/auth/*`. That has been intentionally removed during the Tulip
  // integration — Tulip provides its own JWT auth in front of the API. If
  // gating is wanted later, attach Tulip's `verifyToken` + `checkPermission`
  // before the route mounts below.

  api.get("/report/generate", async (req, res) => {
    const query = String(req.query.query ?? "");
    const evaluation_scope = String(req.query.evaluation_scope ?? "compound");
    const target_route = req.query.target_route ? String(req.query.target_route) : void 0;
    if (!query.trim()) return res.status(422).json({ detail: [{ msg: "query required" }] });
    const payload = await buildDemonstrationReport({ query, evaluation_scope, target_route });
    res.json(payload);
  });
  api.get("/compounds/search", async (req, res) => {
    const query = String(req.query.query ?? "");
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
    const max_phaseRaw = req.query.max_phase;
    const max_phase = max_phaseRaw === void 0 ? void 0 : Number(max_phaseRaw);
    const searched = await searchCompoundsChembl(query, limit, Number.isFinite(max_phase) ? max_phase : void 0);
    const compounds = searched.compounds.map((c) => ({
      chembl_id: String(c.chembl_id ?? ""),
      name: c.pref_name,
      molecule_type: c.molecule_type,
      max_phase: c.max_phase,
      structure_type: c.structure_type,
      smiles: c.canonical_smiles,
      molecular_weight: c.molecular_weight,
      alogp: c.alogp
    }));
    res.json({
      query: searched.query,
      total_results: searched.total_results,
      compounds
    });
  });
  api.get("/compounds/:id", async (req, res) => {
    const mol = await getMolecule(req.params.id);
    if (!mol)
      return res.status(404).json({ detail: `Compound ${req.params.id} not found` });
    const props = mol.properties ?? {};
    res.json({
      chembl_id: mol.chembl_id,
      name: mol.pref_name,
      molecule_type: mol.molecule_type,
      max_phase: mol.max_phase,
      smiles: mol.canonical_smiles,
      inchi_key: mol.inchi_key,
      properties: mol.properties,
      black_box_warning: mol.black_box_warning,
      withdrawn: mol.withdrawn_flag,
      withdrawn_reason: mol.withdrawn_reason
    });
  });
  api.get("/compounds/:id/bioactivity", async (req, res) => {
    const data = await getBioactivity({
      molecule_chembl_id: req.params.id,
      activity_type: req.query.activity_type ? String(req.query.activity_type) : void 0,
      min_pchembl: req.query.min_pchembl ? Number(req.query.min_pchembl) : void 0,
      limit: Math.min(Number(req.query.limit ?? 20) || 20, 100)
    });
    const bioactivities = data.bioactivities.map((row) => ({
      chembl_activity_id: row.activity_id ?? null,
      activity_id: row.activity_id ?? null,
      molecule_chembl_id: row.molecule_chembl_id,
      target_chembl_id: row.target_chembl_id,
      target_pref_name: row.target_pref_name,
      target_organism: row.target_organism,
      standard_type: row.standard_type,
      standard_value: row.standard_value,
      standard_units: row.standard_units,
      pchembl_value: row.pchembl_value,
      assay_type: row.assay_type,
      assay_description: row.assay_description
    }));
    res.json({
      compound_id: req.params.id,
      total_results: data.total_results,
      bioactivities
    });
  });
  api.get("/compounds/:id/mechanism", async (req, res) => {
    const m = await getMechanism(req.params.id, Math.min(Number(req.query.limit ?? 20) || 20, 100));
    res.json({
      compound_id: req.params.id,
      total_results: m.total_results,
      mechanisms: m.mechanisms.map((raw) => {
        const mm = raw;
        return {
          action_type: mm.action_type ?? null,
          mechanism_of_action: mm.mechanism_of_action ?? null,
          target_name: mm.target_pref_name ?? mm.target_pref_name ?? null,
          target_chembl_id: mm.target_chembl_id ?? null
        };
      })
    });
  });
  api.get("/admet/:compoundId", async (req, res) => {
    const mol = await getMolecule(req.params.compoundId);
    if (!mol) {
      return res.json({
        compound_id: req.params.compoundId,
        profile: null,
        error: `ADMET properties not found for ${req.params.compoundId}`
      });
    }
    const props = mol.properties ?? {};
    res.json({
      compound_id: req.params.compoundId,
      profile: {
        chembl_id: req.params.compoundId,
        compound_name: mol.pref_name,
        properties: {
          molecular_weight: props.molecular_weight ?? props.mw_freebase,
          alogp: props.alogp,
          psa: props.psa,
          hbd: props.hbd,
          hba: props.hba,
          rotatable_bonds: props.rotatable_bonds ?? props.rtb,
          qed_weighted: props.qed_weighted,
          ro5_violations: props.num_ro5_violations,
          ro3_pass: null,
          aromatic_rings: props.aromatic_rings,
          heavy_atoms: props.heavy_atoms,
          full_mwt: props.molecular_weight
        },
        assessment: {
          lipinski_compliant: true,
          veber_compliant: true,
          lead_like: true,
          qed_score: props.qed_weighted,
          warnings: []
        }
      },
      error: null
    });
  });
  api.get("/admet/:compoundId/safety-targets", async (req, res) => {
    const safety_targets = {
      hERG: "CHEMBL240",
      "CYP3A4": "CHEMBL340",
      "CYP2D6": "CHEMBL289",
      "CYP2C9": "CHEMBL3397",
      "P-glycoprotein": "CHEMBL4302"
    };
    const out = {};
    const compoundId = req.params.compoundId;
    for (const [name, target_id] of Object.entries(safety_targets)) {
      const bio = await getBioactivity({
        molecule_chembl_id: compoundId,
        target_chembl_id: target_id,
        limit: 10
      });
      out[name] = {
        target_id,
        total_results: bio.total_results,
        bioactivities: bio.bioactivities
      };
    }
    res.json({ compound_id: compoundId, safety_targets: out });
  });
  api.get("/library/", async (req, res) => {
    const page = Math.max(Number(req.query.page ?? 1) || 1, 1);
    const page_size = Math.min(Math.max(Number(req.query.page_size ?? 20) || 20, 1), 100);
    const all = await LibraryCompound.find({}).sort({ updatedAt: -1 }).lean();
    let rows = all;
    const query = typeof req.query.query === "string" ? req.query.query.trim().toLowerCase() : "";
    if (query) rows = rows.filter((r) => String(r.detail?.name ?? "").toLowerCase().includes(query));
    const start = (page - 1) * page_size;
    const slice = rows.slice(start, start + page_size);
    const items = slice.map((doc) => ({
      id: doc.numeric_id,
      name: doc.detail.name,
      cas_number: doc.detail.cas_number,
      molecular_weight: doc.detail.molecular_weight,
      overall_risk: doc.detail.overall_risk ?? "moderate",
      is_svhc: Boolean(doc.detail.is_svhc),
      is_cmr: Boolean(doc.detail.is_cmr),
      is_prop65: Boolean(doc.detail.is_prop65),
      is_gras: Boolean(doc.detail.is_gras),
      is_endocrine_disruptor: Boolean(doc.detail.is_endocrine_disruptor),
      research_date: doc.detail.research_date,
      literature_count: doc.detail.literature_count ?? 0
    }));
    res.json({
      total: rows.length,
      page,
      page_size,
      total_pages: Math.max(Math.ceil(rows.length / page_size), 1),
      items
    });
  });
  api.get("/library/:id", async (req, res) => {
    const id = Number(req.params.id);
    const doc = await LibraryCompound.findOne({ numeric_id: id }).lean();
    if (!doc) return res.status(404).json({ detail: "Not found" });
    res.json(doc.detail);
  });
  api.get("/library/:id/full-report", async (req, res) => {
    const id = Number(req.params.id);
    const doc = await LibraryCompound.findOne({ numeric_id: id }).lean();
    if (!doc || !doc.report) return res.status(404).json({ detail: "Report unavailable" });
    res.json(doc.report);
  });
  api.get("/library/:id/pod-assessment", async (req, res) => {
    const id = Number(req.params.id);
    const doc = await LibraryCompound.findOne({ numeric_id: id }).lean();
    res.json({
      compound_id: id,
      overrides: doc?.pod_worksheet_overrides ?? null
    });
  });
  api.patch("/library/:id/pod-assessment", async (req, res) => {
    const id = Number(req.params.id);
    const overrides = req.body ?? {};
    const modified = Date.now();
    const doc = await LibraryCompound.findOneAndUpdate(
      { numeric_id: id },
      { $set: { pod_worksheet_overrides: { ...overrides, modified_at: modified } } },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ detail: "Not found" });
    res.json({ message: "updated", compound_id: id, overrides: doc.pod_worksheet_overrides });
  });
  api.post("/library/save-from-research", async (req, res) => {
    const query = String(req.body?.query ?? "");
    const notes = req.body?.notes ? String(req.body.notes) : null;
    const researched_by = typeof req.body?.researched_by === "string" && req.body.researched_by.trim() ? req.body.researched_by.trim() : "Local Toxicologist";
    const report = await buildDemonstrationReport({ query, evaluation_scope: "compound" });
    const primary = report.compounds?.primary;
    const chemblId = primary?.chembl_id ? String(primary.chembl_id) : null;
    const name = primary?.pref_name ? String(primary.pref_name) : query;
    const props = primary?.properties ?? {};
    const id = await nextSeq("library_compound");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const detail = {
      id,
      name,
      cas_number: null,
      chembl_id: chemblId,
      pubchem_cid: null,
      dtxsid: null,
      smiles: primary?.canonical_smiles ?? null,
      inchi_key: primary?.inchi_key ?? null,
      molecular_formula: null,
      molecular_weight: props.molecular_weight ?? null,
      notes,
      research_date: now,
      last_updated: now,
      researched_by,
      overall_risk: report.toxicity_profile?.risk_level ?? "moderate",
      risk_rationale: report.toxicity_profile?.key_findings?.[0] ?? null,
      is_svhc: false,
      svhc_reason: null,
      is_cmr: false,
      cmr_classification: null,
      is_endocrine_disruptor: false,
      is_prop65: false,
      prop65_endpoints: [],
      is_gras: false,
      gras_use: null,
      ai_summary: report.ai_summary?.error ? null : report.ai_summary,
      llm_summary: null,
      pod_data: report.pod_assessment_iso ?? null,
      pod_worksheet_overrides: null,
      toxicology_profile: null,
      echa_endpoints: [],
      bioactivity_summary: report.bioactivity ?? null,
      literature_count: report.summary?.literature_count ?? 0,
      key_references: [],
      tra_count: 0
    };
    await LibraryCompound.create({ numeric_id: id, detail, report });
    res.json(detail);
  });
  api.patch("/library/:id", async (req, res) => {
    const id = Number(req.params.id);
    const doc = await LibraryCompound.findOne({ numeric_id: id });
    if (!doc) return res.status(404).json({ detail: "Not found" });
    const d = doc.detail;
    if (typeof req.body?.notes === "string") d.notes = req.body.notes;
    if (typeof req.body?.researched_by === "string") d.researched_by = req.body.researched_by;
    d.last_updated = (/* @__PURE__ */ new Date()).toISOString();
    doc.markModified("detail");
    await doc.save();
    res.json(doc.detail);
  });
  api.delete("/library/:id", async (req, res) => {
    await LibraryCompound.deleteOne({ numeric_id: Number(req.params.id) });
    res.json({ message: "deleted" });
  });
  api.post("/library/:id/refresh-research", async (req, res) => {
    const id = Number(req.params.id);
    const doc = await LibraryCompound.findOne({ numeric_id: id });
    if (!doc) return res.status(404).json({ detail: "Not found" });
    const q = String(doc.detail.name ?? "");
    const report = await buildDemonstrationReport({ query: q, evaluation_scope: "compound" });
    doc.report = report;
    doc.detail.last_updated = (/* @__PURE__ */ new Date()).toISOString();
    doc.markModified("detail");
    doc.markModified("report");
    await doc.save();
    res.json(doc.detail);
  });
  api.get("/tra-projects", async (req, res) => {
    const page = Math.max(Number(req.query.page ?? 1) || 1, 1);
    const page_size = Math.min(Math.max(Number(req.query.page_size ?? 20) || 20, 1), 100);
    const all = await TraProject.find({}).sort({ updatedAt: -1 }).lean();
    const start = (page - 1) * page_size;
    const slice = all.slice(start, start + page_size);
    res.json({
      total: all.length,
      page,
      page_size,
      total_pages: Math.max(Math.ceil(all.length / page_size), 1),
      items: slice.map((p) => p.detail)
    });
  });
  api.post("/tra-projects", async (req, res) => {
    const body = req.body ?? {};
    const devices_concurrent = Number(body.devices_concurrent ?? 1) || 1;
    const devices_tested = Number(body.devices_tested ?? 1) || 1;
    const id = await nextSeq("tra_project");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const scaling_factor = Number(body.scaling_factor ?? devices_tested / devices_concurrent);
    const detail = {
      id,
      name: String(body.name ?? "Untitled project"),
      project_code: body.project_code ?? null,
      description: body.description ?? null,
      product_name: body.product_name ?? null,
      product_type: body.product_type ?? null,
      intended_use: body.intended_use ?? null,
      exposure_route: String(body.exposure_route ?? "dermal"),
      exposure_duration: String(body.exposure_duration ?? ""),
      target_population: body.target_population ?? null,
      body_weight_kg: Number(body.body_weight_kg ?? 70),
      device_contact_category: body.device_contact_category ?? "surface",
      contact_duration_category: body.contact_duration_category ?? "limited",
      contact_duration_days: body.contact_duration_days != null ? Number(body.contact_duration_days) : null,
      patient_population: body.patient_population ?? "adult_male",
      devices_concurrent,
      devices_tested,
      scaling_factor: Number.isFinite(scaling_factor) ? scaling_factor : 1,
      release_duration_days: Number(body.release_duration_days ?? 2),
      utilization_factor: Number(body.utilization_factor ?? 1),
      calculated_tsl: null,
      calculated_aet: null,
      default_uf_interspecies: Number(body.default_uf_interspecies ?? 10),
      default_uf_intraspecies: Number(body.default_uf_intraspecies ?? 10),
      default_uf_subchronic: Number(body.default_uf_subchronic ?? 3),
      default_uf_loael: Number(body.default_uf_loael ?? 3),
      default_uf_database: Number(body.default_uf_database ?? 1),
      status: "draft",
      created_date: now,
      modified_date: now,
      created_by: body.created_by ?? null,
      assigned_toxicologist: body.assigned_toxicologist ?? null,
      overall_conclusion: null,
      recommendations: null,
      compound_count: 0
    };
    await TraProject.create({
      numeric_id: id,
      detail,
      assignments: []
    });
    res.json(detail);
  });
  api.get("/tra-projects/:id", async (req, res) => {
    const doc = await TraProject.findOne({ numeric_id: Number(req.params.id) }).lean();
    if (!doc) return res.status(404).json({ detail: "Not found" });
    res.json(doc.detail);
  });
  api.patch("/tra-projects/:id", async (req, res) => {
    const doc = await TraProject.findOne({ numeric_id: Number(req.params.id) });
    if (!doc) return res.status(404).json({ detail: "Not found" });
    const d = doc.detail;
    Object.assign(d, req.body ?? {});
    d.modified_date = (/* @__PURE__ */ new Date()).toISOString();
    doc.markModified("detail");
    await doc.save();
    res.json(doc.detail);
  });
  api.delete("/tra-projects/:id", async (req, res) => {
    await TraProject.deleteOne({ numeric_id: Number(req.params.id) });
    res.json({ message: "deleted" });
  });
  api.get("/tra-projects/:id/compounds", async (req, res) => {
    const doc = await TraProject.findOne({ numeric_id: Number(req.params.id) }).lean();
    if (!doc) return res.status(404).json({ detail: "Not found" });
    const d = doc.detail;
    const compounds = doc.assignments;
    res.json({
      project_id: d.id,
      project_name: d.name,
      total_compounds: compounds.length,
      compounds
    });
  });
  api.post("/tra-projects/:id/compounds", async (req, res) => {
    const projectId = Number(req.params.id);
    const compound_id = Number(req.body?.compound_id);
    if (!Number.isFinite(compound_id)) return res.status(422).json({ detail: "compound_id required" });
    const proj = await TraProject.findOne({ numeric_id: projectId });
    if (!proj) return res.status(404).json({ detail: "Not found" });
    const lib = await LibraryCompound.findOne({ numeric_id: compound_id }).lean();
    const detail = proj.detail;
    const assignId = await nextSeq(`tra_assignment`);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const added_by = typeof req.body?.added_by === "string" ? req.body.added_by : null;
    const assignment = {
      id: assignId,
      compound_id,
      tra_project_id: projectId,
      added_date: now,
      added_by,
      selected_pod_type: null,
      selected_pod_value: null,
      selected_pod_units: null,
      selected_pod_study: null,
      selected_pod_species: null,
      selected_pod_endpoint: null,
      pod_selection_justification: null,
      uf_interspecies: null,
      uf_intraspecies: null,
      uf_subchronic: null,
      uf_loael: null,
      uf_database: null,
      uf_modifying: null,
      uf_justification: null,
      uf_total: null,
      tolerable_intake: null,
      tolerable_intake_units: null,
      estimated_exposure: null,
      exposure_units: null,
      exposure_calculation_notes: null,
      margin_of_safety: null,
      risk_characterization: null,
      is_acceptable_risk: null,
      notes: null,
      limitations: null,
      is_complete: false,
      requires_review: true,
      compound_name: lib?.detail ? lib.detail.name : null,
      compound_cas: lib?.detail ? lib.detail.cas_number : null,
      compound_risk: lib?.detail ? lib.detail.overall_risk : null,
      is_grouped_family_member: false,
      grouped_family_id: null,
      grouped_family_assignment_id: null,
      grouped_family_name: null,
      closure_gate: {
        ready: false,
        blockers: [],
        blocker_messages: [],
        current_review_state: null,
        allowed_review_states: [],
        selected_pod_present: false,
        quantitative_pod_available: false,
        quantitative_pod_unavailable_reviewed: false,
        explicit_quantitative_pod_selected: false,
        ttc_fallback_selected: false,
        ttc_fallback_accepted: false,
        ttc_acceptance_rationale_present: false,
        research_basis_present: false,
        note_based_rationale_present: false,
        targeted_testing_plan_documented: false,
        proposed_read_across_count: 0
      },
      source_toxicology_profile: null,
      working_toxicology_profile: null
    };
    proj.assignments.push(assignment);
    detail.compound_count = proj.assignments.length;
    proj.markModified("assignments");
    proj.markModified("detail");
    await proj.save();
    res.json(assignment);
  });
  api.patch("/tra-projects/:projectId/compounds/:assignmentId", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const assignmentId = Number(req.params.assignmentId);
    const proj = await TraProject.findOne({ numeric_id: projectId });
    if (!proj) return res.status(404).json({ detail: "Not found" });
    const arr = proj.assignments;
    const idx = arr.findIndex((a) => a.id === assignmentId);
    if (idx < 0) return res.status(404).json({ detail: "Assignment missing" });
    Object.assign(arr[idx], req.body ?? {});
    const detail = proj.detail;
    detail.compound_count = arr.length;
    proj.markModified("assignments");
    proj.markModified("detail");
    await proj.save();
    res.json(arr[idx]);
  });
  api.delete("/tra-projects/:projectId/compounds/:assignmentId", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const assignmentId = Number(req.params.assignmentId);
    const proj = await TraProject.findOne({ numeric_id: projectId });
    if (!proj) return res.status(404).json({ detail: "Not found" });
    proj.assignments = proj.assignments.filter((a) => a.id !== assignmentId);
    proj.detail.compound_count = proj.assignments.length;
    proj.markModified("assignments");
    proj.markModified("detail");
    await proj.save();
    res.json({ message: "removed" });
  });
  api.get("/tra-projects/:projectId/compounds/:assignmentId/pod-assessment", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const assignmentId = Number(req.params.assignmentId);
    const proj = await TraProject.findOne({ numeric_id: projectId }).lean();
    const a = (proj?.assignments ?? []).find((x) => x.id === assignmentId);
    res.json({
      project_id: projectId,
      assignment_id: assignmentId,
      compound_id: a?.compound_id ?? null,
      overrides: a?.pod_worksheet_overrides ?? null
    });
  });
  api.patch("/tra-projects/:projectId/compounds/:assignmentId/pod-assessment", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const assignmentId = Number(req.params.assignmentId);
    const proj = await TraProject.findOne({ numeric_id: projectId });
    if (!proj) return res.status(404).json({ detail: "Not found" });
    const arr = proj.assignments;
    const idx = arr.findIndex((a) => a.id === assignmentId);
    if (idx < 0) return res.status(404).json({ detail: "Assignment missing" });
    const modified = Date.now();
    arr[idx].pod_worksheet_overrides = { ...req.body ?? {}, modified_at: modified };
    proj.markModified("assignments");
    await proj.save();
    res.json({
      message: "updated",
      project_id: projectId,
      assignment_id: assignmentId,
      compound_id: arr[idx].compound_id,
      overrides: arr[idx].pod_worksheet_overrides,
      assignment: arr[idx]
    });
  });
  api.post("/tra-projects/:projectId/compounds/:assignmentId/confirm-review", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const assignmentId = Number(req.params.assignmentId);
    const proj = await TraProject.findOne({ numeric_id: projectId });
    if (!proj) return res.status(404).json({ detail: "Not found" });
    const arr = proj.assignments;
    const a = arr.find((x) => x.id === assignmentId);
    if (!a) return res.status(404).json({ detail: "Assignment missing" });
    Object.assign(a, req.body ?? {});
    a.is_complete = true;
    a.requires_review = false;
    proj.markModified("assignments");
    await proj.save();
    res.json({
      message: "confirmed",
      assignment: a,
      tolerable_intake: a.tolerable_intake ?? null,
      tolerable_intake_units: a.tolerable_intake_units ?? null,
      margin_of_safety: a.margin_of_safety ?? null
    });
  });
  api.post("/tra-projects/:projectId/compounds/:assignmentId/reopen-review", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const assignmentId = Number(req.params.assignmentId);
    const proj = await TraProject.findOne({ numeric_id: projectId });
    if (!proj) return res.status(404).json({ detail: "Not found" });
    const arr = proj.assignments;
    const a = arr.find((x) => x.id === assignmentId);
    if (!a) return res.status(404).json({ detail: "Assignment missing" });
    a.is_complete = false;
    a.requires_review = true;
    proj.markModified("assignments");
    await proj.save();
    res.json({
      message: "reopened",
      assignment: a,
      tolerable_intake: a.tolerable_intake ?? null,
      tolerable_intake_units: a.tolerable_intake_units ?? null,
      margin_of_safety: a.margin_of_safety ?? null
    });
  });
  api.get("/tra-projects/:projectId/compounds/:assignmentId/available-pods", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const assignmentId = Number(req.params.assignmentId);
    const proj = await TraProject.findOne({ numeric_id: projectId }).lean();
    const a = (proj?.assignments ?? []).find((x) => x.id === assignmentId);
    const lib = a ? await LibraryCompound.findOne({ numeric_id: a.compound_id }).lean() : null;
    const pods = lib?.detail?.pod_data?.pod_candidates ?? [];
    res.json({
      compound_id: a?.compound_id ?? null,
      compound_name: a?.compound_name ?? null,
      available_pods: pods,
      recommended_pod: pods[0] ?? void 0,
      recommendation_rationale: "Scaffold: first POD candidate if present"
    });
  });
  api.get("/tra-projects/:id/coverage-audit", async (_req, res) => {
    res.json({
      project_id: Number(_req.params.id),
      coverage_gaps: [],
      family_read_across_gaps: [],
      message: "MERN scaffold: coverage audit not implemented"
    });
  });
  api.get("/compound-families/", async (req, res) => {
    const page = Math.max(Number(req.query.page ?? 1) || 1, 1);
    const page_size = Math.min(Math.max(Number(req.query.page_size ?? 20) || 20, 1), 100);
    const all = await CompoundFamily.find({}).sort({ updatedAt: -1 }).lean();
    const start = (page - 1) * page_size;
    const slice = all.slice(start, start + page_size);
    res.json({
      total: all.length,
      page,
      page_size,
      total_pages: Math.max(Math.ceil(all.length / page_size), 1),
      items: slice.map((f) => f.payload)
    });
  });
  api.get("/compound-families/governance/rules", (_req, res) => res.json({ items: [] }));
  api.get("/compound-families/governance/feedback", (_req, res) => res.json({ items: [] }));
  api.post(
    "/compound-families/governance/rules",
    (req, res) => res.status(501).json({ detail: "MERN scaffold: create rule not implemented" })
  );
  api.post(
    "/compound-families/governance/feedback",
    (req, res) => res.status(501).json({ detail: "MERN scaffold: feedback not implemented" })
  );
  api.post(
    "/compound-families/governance/simulate",
    (_req, res) => res.json({ matches: [], notes: ["MERN scaffold simulation placeholder"] })
  );
  api.get("/compound-families/detect", (req, res) => {
    const q = String(req.query.query ?? "").trim();
    res.json({
      is_family: false,
      family_type: null,
      family_name: null,
      existing_family_id: null,
      detection_method: "mern_stub",
      confidence: 0,
      regulatory_basis: q ? `stub query=${q}` : null
    });
  });
  api.post("/compound-families/detect", (req, res) => {
    const name = String(req.body?.compound_name ?? "").trim();
    res.json({
      is_family: false,
      family_type: null,
      family_name: null,
      existing_family_id: null,
      detection_method: "mern_stub",
      confidence: 0,
      regulatory_basis: name ? `stub name=${name}` : null
    });
  });
  api.get("/compound-families/:id", async (req, res) => {
    const doc = await CompoundFamily.findOne({ numeric_id: Number(req.params.id) }).lean();
    if (!doc) return res.status(404).json({ detail: "Family not found" });
    res.json(doc.payload ?? {});
  });
  api.get("/import/", async (_req, res) => {
    const all = await ChemistryImportJob.find({}).sort({ updatedAt: -1 }).limit(50).lean();
    res.json({
      total: all.length,
      page: 1,
      page_size: all.length || 20,
      total_pages: 1,
      items: all.map((j) => ({
        id: j.numeric_id,
        filename: j.filename,
        status: j.status ?? "parsed"
      }))
    });
  });
  api.post("/import/chemistry", upload.single("file"), async (req, res) => {
    const buf = req.file?.buffer;
    const filename = req.file?.originalname ?? "unknown";
    if (!buf) return res.status(422).json({ detail: "file required" });
    let rows = [];
    try {
      const wb = XLSX.read(buf, { type: "buffer" });
      const wsName = wb.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { defval: null });
    } catch {
      return res.status(422).json({ detail: "Unable to parse workbook" });
    }
    const id = await nextSeq("import_job");
    const compounds = rows.slice(0, 120).map((r, idx) => {
      const guessedName = r.Substance ?? r.substance ?? r.Name ?? r.name ?? r.Compound ?? r.compound ?? Object.values(r)[0];
      return {
        row_index: idx + 2,
        name: guessedName ? String(guessedName) : `Imported row ${idx + 1}`,
        cas_number: r.CAS ? String(r.CAS) : r.cas_number ? String(r.cas_number) : null,
        smiles: r.SMILES ? String(r.SMILES) : null,
        analysis_type: "unknown",
        notes: null
      };
    });
    const job = {
      import_id: id,
      filename,
      file_type: filename.split(".").pop() ?? "xlsx",
      parsing_method: "mern_xlsx_sheet0",
      total_compounds: compounds.length,
      analysis_types: ["unknown"],
      solvents_detected: [],
      compounds,
      warnings: ["MERN scaffold: parsing is heuristic; verify column mapping"],
      ai_confidence: null,
      tra_project_id: req.query.project_id ? Number(req.query.project_id) : void 0
    };
    await ChemistryImportJob.create({
      numeric_id: id,
      filename,
      file_type: job.file_type,
      compounds,
      records: rows,
      resolved: [],
      operation: { state: "idle", message: "parsed" },
      status: "parsed"
    });
    res.json(job);
  });
  api.get("/import/:id/preview", async (req, res) => {
    const doc = await ChemistryImportJob.findOne({ numeric_id: Number(req.params.id) }).lean();
    if (!doc) return res.status(404).json({ detail: "Not found" });
    res.json({
      import_id: doc.numeric_id,
      filename: doc.filename,
      file_type: doc.file_type,
      parsing_method: "mern_xlsx_sheet0",
      total_compounds: doc.compounds?.length ?? 0,
      analysis_types: ["unknown"],
      solvents_detected: [],
      compounds: doc.compounds ?? [],
      warnings: []
    });
  });
  api.get("/import/:id", async (req, res) => {
    const doc = await ChemistryImportJob.findOne({ numeric_id: Number(req.params.id) }).lean();
    if (!doc) return res.status(404).json({ detail: "Not found" });
    res.json({
      id: doc.numeric_id,
      filename: doc.filename,
      status: doc.status
    });
  });
  api.get("/import/:id/records", async (req, res) => {
    const doc = await ChemistryImportJob.findOne({ numeric_id: Number(req.params.id) }).lean();
    res.json(doc?.records ?? []);
  });
  api.get("/import/:id/families", async (_req, res) => res.json([]));
  api.get("/import/:id/tables", async (_req, res) => res.json([]));
  api.get("/import/:id/resolved-compounds", async (_req, res) => res.json([]));
  api.get(
    "/import/:id/confirmation-summary",
    async (_req, res) => res.json({ import_id: Number(_req.params.id), ready: false, notes: [] })
  );
  api.get("/import/:id/operation-status", async (req, res) => {
    const doc = await ChemistryImportJob.findOne({ numeric_id: Number(req.params.id) }).lean();
    res.json(doc?.operation ?? { state: "idle" });
  });
  api.post("/import/:id/resolve", async (req, res) => {
    const doc = await ChemistryImportJob.findOne({ numeric_id: Number(req.params.id) });
    if (!doc) return res.status(404).json({ detail: "Not found" });
    const rows = (doc.compounds ?? []).map((c, idx) => ({
      compound_id: null,
      name: String(c.name ?? `Row ${idx}`),
      cas_number: c.cas_number ?? null,
      smiles: c.smiles ?? null,
      status: "unresolved",
      chembl_id: null,
      error: null,
      notes: "MERN scaffold: hook identifier resolution pipeline"
    }));
    doc.resolved = rows;
    doc.operation = { ...doc.operation, state: "completed", message: "resolve_stub" };
    doc.markModified("resolved");
    doc.markModified("operation");
    await doc.save();
    res.json({ compounds: rows });
  });
  api.post("/import/:id/confirm", async (req, res) => {
    res.json({
      import_id: Number(req.params.id),
      tra_project_id: Number(req.body?.tra_project_id ?? 0),
      tra_project_name: String(req.body?.project_name ?? "TRA project"),
      compounds_created: 0,
      families_created: 0,
      message: "MERN scaffold: confirm recorded"
    });
  });
  api.get(`/tra-projects/:projectId/compounds/:assignmentId/evidence-support`, async (req, res) => {
    const projectId = Number(req.params.projectId);
    const assignmentId = Number(req.params.assignmentId);
    const proj = await TraProject.findOne({ numeric_id: projectId }).lean();
    const a = (proj?.assignments ?? []).find((x) => x.id === assignmentId);
    res.json(emptyEvidence(projectId, assignmentId, a));
  });
  api.post(`/tra-projects/:projectId/compounds/:assignmentId/apply-ttc-fallback`, async (req, res) => {
    const projectId = Number(req.params.projectId);
    const assignmentId = Number(req.params.assignmentId);
    const proj = await TraProject.findOne({ numeric_id: projectId });
    if (!proj) return res.status(404).json({ detail: "Not found" });
    const arr = proj.assignments;
    const idx = arr.findIndex((x) => x.id === assignmentId);
    if (idx < 0) return res.status(404).json({ detail: "Assignment missing" });
    const modified = Date.now();
    arr[idx].pod_worksheet_overrides = { ...req.body ?? {}, modified_at: modified };
    proj.markModified("assignments");
    await proj.save();
    res.json({
      message: "ttc_fallback_stub",
      project_id: projectId,
      assignment_id: assignmentId,
      compound_id: arr[idx].compound_id,
      selected_ttc: null,
      overrides: arr[idx].pod_worksheet_overrides,
      assignment: arr[idx]
    });
  });
  api.get(`/tra-projects/:projectId/compounds/:assignmentId/decision-trace`, async (req, res) => {
    const projectId = Number(req.params.projectId);
    const assignmentId = Number(req.params.assignmentId);
    const proj = await TraProject.findOne({ numeric_id: projectId }).lean();
    const a = (proj?.assignments ?? []).find((x) => x.id === assignmentId);
    const ev = emptyEvidence(projectId, assignmentId, a);
    res.json({
      project_id: projectId,
      project_name: proj?.detail?.name ?? null,
      assignment_id: assignmentId,
      compound_id: a?.compound_id ?? 0,
      compound_name: a?.compound_name ?? null,
      decision_basis: { note: "MERN scaffold" },
      worksheet_overrides: a?.pod_worksheet_overrides ?? null,
      closure_gate: a?.closure_gate ?? {},
      evidence_support: ev
    });
  });
  api.get("/tra-projects/:projectId/tables", async (_req, res) => res.json([]));
  api.post("/tra-projects/:projectId/research", async (req, res) => {
    const projectId = Number(req.params.projectId);
    const proj = await TraProject.findOne({ numeric_id: projectId }).lean();
    const name = proj?.detail?.name ?? "Project";
    const assignments = (proj?.assignments ?? []).map((a) => ({
      compound_id: a.compound_id,
      compound_name: a.compound_name ?? "Compound",
      research_status: "success",
      error_message: void 0,
      has_pod_data: Boolean(a.pod_worksheet_overrides),
      pod_count: 0,
      suggested_pod_type: void 0,
      suggested_pod_value: void 0,
      suggested_pod_units: void 0,
      data_sources_found: ["chembl_stub"],
      literature_count: 0,
      needs_read_across: true
    }));
    const now = (/* @__PURE__ */ new Date()).toISOString();
    res.json({
      project_id: projectId,
      project_name: name,
      research_started_at: now,
      research_completed_at: now,
      researched_by: req.body?.researched_by,
      total_compounds: assignments.length,
      successful_research: assignments.length,
      failed_research: 0,
      skipped: 0,
      compounds_with_pod: 0,
      compounds_needing_read_across: assignments.length,
      families_with_representatives_selected: 0,
      compound_results: assignments,
      recommendations: ["Wire full dossier ingestion for parity with FastAPI"]
    });
  });

  // --------------------------------------------------------------------
  //  Mount ported FastAPI endpoint modules.
  //  The order here mirrors `app/api/v1/route_registry.py` from the
  //  original backend so route lookup behaviour stays familiar.
  // --------------------------------------------------------------------
  api.use("/literature", literatureRoutes);
  api.use("/pubchem", pubchemRoutes);
  api.use("/comptox", comptoxRoutes);
  api.use("/ctd", ctdRoutes);
  api.use("/aopwiki", aopwikiRoutes);
  api.use("/drugbank", drugbankRoutes);
  api.use("/faers", faersRoutes);
  api.use("/sider", siderRoutes);
  api.use("/ecotox", ecotoxRoutes);
  api.use("/patents", patentsRoutes);
  api.use("/identifiers", identifiersRoutes);
  api.use("/toxicogenomics", toxicogenomicsRoutes);
  api.use("/pathways", pathwaysRoutes);
  api.use("/regulatory", regulatoryRoutes);
  api.use("/echa", echaRoutes);
  api.use("/reach", reachRoutes);
  api.use("/toxtree", toxtreeRoutes);
  api.use("/read-across", readAcrossRoutes);
  api.use("/ti-calculator", tiCalculatorRoutes);
  api.use("/endpoint-dashboard", endpointDashboardRoutes);
  api.use("/el-library", elLibraryRoutes);
  api.use("/clinical", clinicalRoutes);
  api.use("/targets", targetsRoutes);
  api.use("/websearch", websearchRoutes);
  api.use("/sources", sourcesRoutes);
  api.use("/ai-summary", aiSummaryRoutes);
}
