/**
 * Tox-stack mount helper.
 *
 * The toxintelligence-mern app used to live in its own repo under
 * `server/src/`; we've copied its services / routes / models into
 * `Tulip-Backend/src/tox/` and use this thin wrapper to expose them
 * under a namespaced prefix (`/api/tox/v1` by default).
 *
 * Tulip already handles CORS, cookie-parsing, JSON body parsing and
 * audit middleware in `src/index.js`, so the only job here is to wire
 * the Tox v1 router into the host Express app.
 *
 * Auth gating is intentionally NOT applied here. Add Tulip's
 * `verifyToken` + `checkPermission("Toxicology", ...)` either inside
 * this function (gates everything) or inside the per-endpoint routes
 * if you want fine-grained control.
 */

import express from 'express'
import { registerV1Routes } from './routes/v1/v1.routes.js'

export function registerToxRoutes(app, prefix = '/api/tox/v1') {
  const router = express.Router()
  registerV1Routes(router)
  app.use(prefix, router)
}
