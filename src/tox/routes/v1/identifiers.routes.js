/**
 * Identifier resolution endpoints — mirrors `app/api/v1/endpoints/identifiers.py`.
 */

import { Router } from 'express'
import * as identifier from '../../services/identifier.service.js'
import { asyncRoute, parseBoolParam } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/resolve',
  asyncRoute(async (req, res) => {
    const id = String(req.query.identifier ?? '')
    if (!id) return res.status(400).json({ detail: 'Missing identifier' })
    const r = await identifier.resolve(id, { resolve_all: parseBoolParam(req.query.resolve_all, true) })
    res.json(r.to_dict())
  }),
)

router.post(
  '/resolve/batch',
  asyncRoute(async (req, res) => {
    const ids = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.identifiers) ? req.body.identifiers : []
    if (!ids.length) return res.status(400).json({ detail: 'Body must be an array of identifiers' })
    res.json(await identifier.batchResolve(ids, { resolve_all: parseBoolParam(req.query.resolve_all, false) }))
  }),
)

router.get(
  '/profile',
  asyncRoute(async (req, res) => {
    const id = String(req.query.identifier ?? '')
    if (!id) return res.status(400).json({ detail: 'Missing identifier' })
    res.json(await identifier.getUnifiedProfile(id))
  }),
)

router.post(
  '/map',
  asyncRoute(async (req, res) => {
    const ids = Array.isArray(req.body) ? req.body : Array.isArray(req.body?.source_ids) ? req.body.source_ids : []
    const source_type = String(req.query.source_type ?? '')
    const target_type = String(req.query.target_type ?? '')
    if (!ids.length || !source_type || !target_type) {
      return res.status(400).json({ detail: 'source_ids body + source_type + target_type query params are required' })
    }
    res.json(await identifier.mapIdentifiers({ source_type, source_ids: ids, target_type }))
  }),
)

router.get(
  '/validate',
  asyncRoute(async (req, res) => {
    const id = String(req.query.identifier ?? '')
    if (!id) return res.status(400).json({ detail: 'Missing identifier' })
    res.json(
      await identifier.validateIdentifier(id, {
        expected_type: req.query.expected_type ? String(req.query.expected_type) : undefined,
      }),
    )
  }),
)

export default router
