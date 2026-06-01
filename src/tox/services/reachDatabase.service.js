/**
 * REACH local-database service.
 *
 * Mirrors `backend/app/services/reach_database_service.py`. The Python
 * version expected the operator to bulk-load IUCLID 6 XML dumps into a
 * local SQL database before any query worked, and surfaced a clear
 * "not initialised" 503 until that happened.
 *
 * We replicate that contract here. If a future operator wires up a Mongo
 * collection of REACH studies (or hosts a sidecar that proxies an indexed
 * IUCLID extract), they can flip `process.env.REACH_DATABASE_READY=true`
 * and inject loader functions; until then we honestly return the
 * "not initialized" payload the SPA already knows how to render.
 */

import { ChemistryImportJob } from '../models/chemistryImportJob.models.js' // eslint-disable-line no-unused-vars

const READY = () => String(process.env.REACH_DATABASE_READY ?? '').toLowerCase() === 'true'

/** Stats payload — mirrors `REACHDatabaseService.get_database_stats`. */
export function getDatabaseStats() {
  if (!READY()) {
    return {
      initialized: false,
      substance_count: 0,
      study_count: 0,
      last_update: null,
      database_size_mb: 0,
      note: 'Set REACH_DATABASE_READY=true once you mirror the IUCLID 6 REACH dump.',
    }
  }
  return {
    initialized: true,
    substance_count: 0,
    study_count: 0,
    last_update: new Date().toISOString(),
    database_size_mb: 0,
    note: 'Connect a queryable REACH study collection in this service.',
  }
}

/** Query studies by CAS. Returns an empty list when DB is not initialised. */
export async function queryByCas({ cas_number, study_types, endpoint_types, limit = 50 }) {
  if (!READY()) return []
  // Hook for the loaded data. Replace with a Mongo lookup once you persist studies.
  return []
}

/** Query studies by substance name. */
export async function queryByName({ substance_name, study_types, endpoint_types, limit = 50 }) {
  if (!READY()) return []
  return []
}

/**
 * Point-of-Departure values per study type, ISO 10993-17 compliant shape.
 * When DB is not initialised, we surface a clear "no data" payload.
 */
export async function getPodValues({ cas_number, substance_name } = {}) {
  if (!READY()) {
    return {
      cas_number,
      substance_name,
      pod_values: [],
      recommended_pod: null,
      note: 'REACH local database not initialised.',
    }
  }
  return {
    cas_number,
    substance_name,
    pod_values: [],
    recommended_pod: null,
  }
}
