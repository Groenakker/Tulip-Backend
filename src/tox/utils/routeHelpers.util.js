/**
 * Shared helpers used by every modular route file.
 *
 * The Python backend uses FastAPI's automatic 500-on-exception behaviour with a
 * "raise_internal_api_error" helper that logs and re-raises. We do the same
 * here: `asyncRoute(fn)` wraps an async handler so any thrown error becomes
 * a structured 5xx (or matching upstream status) JSON response.
 */

import { HttpServiceError } from '../services/_httpClient.js'

/**
 * Wraps an async express handler. Any thrown error is logged once with the
 * route URL and converted into a uniform JSON error response. Mirrors the
 * Python `raise_internal_api_error` pattern.
 *
 * @template {import('express').Request} Req
 * @template {import('express').Response} Res
 * @param {(req: Req, res: Res) => Promise<unknown>} fn
 * @returns {import('express').RequestHandler}
 */
export function asyncRoute(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      if (res.headersSent) return next(err)
      const path = `${req.method} ${req.originalUrl}`
      if (err instanceof HttpServiceError) {
        const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502
        // Log upstream failures at warn level; they're external problems.
        console.warn(`[route] ${path} upstream error: ${err.message}`)
        return res.status(status).json({
          detail: err.message,
          source: err.source ?? null,
          upstream_status: err.status ?? null,
        })
      }
      console.error(`[route] ${path} unhandled error:`, err)
      res.status(500).json({ detail: 'Internal server error' })
    })
  }
}

/**
 * Parse an integer query value with bounds. Returns the default when the value
 * is missing, NaN, or out of range. Mirrors FastAPI's `Query(..., ge=, le=)`.
 *
 * @param {unknown} value
 * @param {number} fallback
 * @param {{ min?: number, max?: number }} [opts]
 */
export function parseIntParam(value, fallback, opts = {}) {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  if (opts.min != null && n < opts.min) return opts.min
  if (opts.max != null && n > opts.max) return opts.max
  return n
}

/**
 * Parse a float query value with bounds.
 *
 * @param {unknown} value
 * @param {number | undefined} fallback
 * @param {{ min?: number, max?: number }} [opts]
 */
export function parseFloatParam(value, fallback, opts = {}) {
  const n = Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(n)) return fallback
  if (opts.min != null && n < opts.min) return opts.min
  if (opts.max != null && n > opts.max) return opts.max
  return n
}

/**
 * Parse a boolean query (`true`, `1`, `yes` -> true; `false`, `0`, `no` -> false).
 *
 * @param {unknown} value
 * @param {boolean} fallback
 */
export function parseBoolParam(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const s = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(s)) return true
  if (['false', '0', 'no', 'n'].includes(s)) return false
  return fallback
}

/**
 * Require a query parameter; if missing, throw a structured 400 via this
 * sentinel error. asyncRoute will not handle this — caller should `res.status(400).json(...)`.
 */
export class BadRequestError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BadRequestError'
  }
}

/**
 * Attach standard provenance metadata to a service response. Mirrors
 * `app.utils.source_provenance.attach_source_metadata`.
 *
 * @template {Record<string, unknown>} T
 * @param {T} payload
 * @param {string} source
 * @param {{ query?: string|null, endpoint?: string|null }} [meta]
 * @returns {T & { _source: { source: string, query: string|null, endpoint: string|null, fetched_at: string } }}
 */
export function attachSourceMetadata(payload, source, meta = {}) {
  return {
    ...payload,
    _source: {
      source,
      query: meta.query ?? null,
      endpoint: meta.endpoint ?? null,
      fetched_at: new Date().toISOString(),
    },
  }
}

/**
 * Run promises in parallel with `Promise.allSettled` semantics and turn
 * each result into `{ status: 'ok'|'error'|'no_data', value, error }`.
 * Used by aggregating endpoints like `/endpoint-dashboard/generate`.
 *
 * @template T
 * @param {Array<{ name: string, run: () => Promise<T> }>} tasks
 */
export async function gatherSources(tasks) {
  const settled = await Promise.allSettled(tasks.map((t) => t.run()))
  /** @type {Record<string, { status: 'ok'|'error'|'no_data', value: T|null, error: string|null }>} */
  const map = {}
  settled.forEach((r, i) => {
    const name = tasks[i].name
    if (r.status === 'fulfilled') {
      const empty = r.value == null
      map[name] = {
        status: empty ? 'no_data' : 'ok',
        value: empty ? null : r.value,
        error: null,
      }
    } else {
      const message = r.reason instanceof Error ? r.reason.message : String(r.reason)
      map[name] = { status: 'error', value: null, error: message }
    }
  })
  return map
}
