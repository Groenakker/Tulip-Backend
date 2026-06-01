/**
 * Shared HTTP client used by every external-API service module.
 *
 * Mirrors the behaviour of the original Python `BaseService` (httpx.AsyncClient
 * with a 30s timeout, follow_redirects=True, generous error handling). We
 * wrap axios so each service can call `httpGet(url, params)` /
 * `httpPost(url, body, params)` without worrying about timeouts, headers, or
 * status-code unwrapping. Network or HTTP errors throw a normalised
 * `HttpServiceError` which the route layer translates to a 500 response.
 */

import axios from 'axios'

/** Standard timeout for upstream API calls (ms). */
const DEFAULT_TIMEOUT_MS = 30_000

/** Friendly UA so upstream APIs can identify us in their logs. */
const DEFAULT_USER_AGENT =
  'ToxIntelligence-MERN/1.0 (+https://github.com/groenakker/toxintelligence)'

/**
 * Error thrown by the HTTP helpers. The route layer logs it and either
 * forwards a sane HTTP status (when `status` is set) or 500.
 */
export class HttpServiceError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, source?: string, cause?: unknown, body?: unknown }} [opts]
   */
  constructor(message, opts = {}) {
    super(message)
    this.name = 'HttpServiceError'
    this.status = opts.status
    this.source = opts.source
    this.body = opts.body
    if (opts.cause) this.cause = opts.cause
  }
}

/**
 * Create a pre-configured axios instance for a single upstream API.
 *
 * @param {{ baseURL?: string, timeout?: number, headers?: Record<string,string> }} [opts]
 */
export function createHttpClient(opts = {}) {
  return axios.create({
    baseURL: opts.baseURL,
    timeout: opts.timeout ?? DEFAULT_TIMEOUT_MS,
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json',
      ...(opts.headers ?? {}),
    },
    // Follow redirects (matches httpx.AsyncClient(follow_redirects=True))
    maxRedirects: 5,
  })
}

/**
 * GET helper that returns parsed JSON and surfaces upstream errors as
 * `HttpServiceError` so route handlers can render a uniform 500/4xx.
 *
 * @template T
 * @param {string} url
 * @param {{ params?: Record<string, unknown>, headers?: Record<string,string>, timeout?: number, source?: string, responseType?: 'json'|'text'|'arraybuffer' }} [opts]
 * @returns {Promise<T>}
 */
export async function httpGet(url, opts = {}) {
  try {
    const res = await axios.get(url, {
      params: opts.params,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: opts.responseType === 'text' ? 'text/xml,text/plain,*/*' : 'application/json',
        ...(opts.headers ?? {}),
      },
      timeout: opts.timeout ?? DEFAULT_TIMEOUT_MS,
      responseType: opts.responseType ?? 'json',
      maxRedirects: 5,
    })
    return res.data
  } catch (err) {
    throw normaliseAxiosError(err, opts.source ?? url)
  }
}

/**
 * POST helper. Body is sent as JSON unless caller passes a string/Buffer.
 *
 * @template T
 * @param {string} url
 * @param {unknown} body
 * @param {{ params?: Record<string, unknown>, headers?: Record<string,string>, timeout?: number, source?: string }} [opts]
 * @returns {Promise<T>}
 */
export async function httpPost(url, body, opts = {}) {
  try {
    const res = await axios.post(url, body, {
      params: opts.params,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(opts.headers ?? {}),
      },
      timeout: opts.timeout ?? DEFAULT_TIMEOUT_MS,
      maxRedirects: 5,
    })
    return res.data
  } catch (err) {
    throw normaliseAxiosError(err, opts.source ?? url)
  }
}

/**
 * Returns a fallback value instead of throwing. Useful when an upstream
 * endpoint returning 404 is the same as "no data" (e.g. CTD, PubChem).
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {T} fallback
 */
export async function tryOrFallback(promise, fallback) {
  try {
    return await promise
  } catch {
    return fallback
  }
}

/**
 * Normalise axios errors into our `HttpServiceError` shape.
 *
 * @param {unknown} err
 * @param {string} source
 */
function normaliseAxiosError(err, source) {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const message = status
      ? `Upstream ${source} returned HTTP ${status}`
      : err.code === 'ECONNABORTED'
        ? `Upstream ${source} timed out`
        : `Upstream ${source} unreachable: ${err.message}`
    return new HttpServiceError(message, {
      status,
      source,
      cause: err,
      body: err.response?.data,
    })
  }
  return new HttpServiceError(`Unexpected error from ${source}: ${String(err)}`, {
    source,
    cause: err,
  })
}

/** Quick check: does this string look like a CAS Registry Number (`50-00-0`)? */
export function isCasrn(value) {
  return typeof value === 'string' && /^\d{2,7}-\d{2}-\d$/.test(value.trim())
}

/** Quick check: is this likely a SMILES string (has at least one bond/ring char)? */
export function looksLikeSmiles(value) {
  if (typeof value !== 'string' || value.length < 2) return false
  if (/\s/.test(value)) return false
  return /[=()\[\]#@+\-\/\\.0-9]/.test(value) && /[A-Za-z]/.test(value)
}

/** Quick check: is this an InChIKey (`AAAAA-BBBB-N` 27 chars)? */
export function isInchiKey(value) {
  return typeof value === 'string' && /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(value.trim())
}
