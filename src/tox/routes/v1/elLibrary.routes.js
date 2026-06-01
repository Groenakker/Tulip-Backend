/**
 * E&L chemical library endpoints — mirrors `app/api/v1/endpoints/el_library.py`.
 */

import { Router } from 'express'
import * as elLibrary from '../../services/elLibrary.service.js'
import { asyncRoute } from '../../utils/routeHelpers.util.js'

const router = Router()

router.get(
  '/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.query ?? '')
    if (!q) return res.status(400).json({ detail: 'Missing query' })
    const results = elLibrary.search(q, {
      category: req.query.category ? String(req.query.category) : undefined,
      material: req.query.material ? String(req.query.material) : undefined,
    })
    res.json({
      query: q,
      category_filter: req.query.category ?? null,
      material_filter: req.query.material ?? null,
      total_results: results.length,
      chemicals: results,
    })
  }),
)

router.get(
  '/chemical/:casrn',
  asyncRoute(async (req, res) => {
    const chemical = elLibrary.getByCas(req.params.casrn)
    if (!chemical) return res.status(404).json({ detail: `Chemical with CAS ${req.params.casrn} not found in E&L library` })
    res.json(chemical)
  }),
)

router.get(
  '/by-category/:category',
  asyncRoute(async (req, res) => {
    const items = elLibrary.listByCategory(req.params.category)
    if (!items.length) {
      return res.status(404).json({ detail: `No chemicals found for category '${req.params.category}'`, available: elLibrary.listCategories() })
    }
    res.json({ category: req.params.category, total_chemicals: items.length, chemicals: items })
  }),
)

router.get(
  '/by-material/:material',
  asyncRoute(async (req, res) => {
    const items = elLibrary.listByMaterial(req.params.material)
    if (!items.length) {
      return res.status(404).json({ detail: `No chemicals found for material '${req.params.material}'`, available: elLibrary.listMaterials() })
    }
    res.json({ material: req.params.material, total_chemicals: items.length, chemicals: items })
  }),
)

router.get('/categories', (_req, res) => res.json({ categories: elLibrary.listCategories() }))
router.get('/materials', (_req, res) => res.json({ materials: elLibrary.listMaterials() }))
router.get('/statistics', (_req, res) => res.json(elLibrary.getStatistics()))

router.get(
  '/concerns',
  asyncRoute(async (req, res) => {
    const concern = String(req.query.concern_type ?? '').toLowerCase()
    if (!['mutagenicity', 'carcinogenicity', 'reproductive'].includes(concern)) {
      return res.status(400).json({ detail: 'concern_type must be mutagenicity, carcinogenicity, or reproductive' })
    }
    const items = elLibrary.listWithConcerns(concern)
    res.json({
      concern_type: concern,
      total_chemicals: items.length,
      chemicals: items,
      note: 'These chemicals require additional scrutiny in ISO 10993-17/18 assessments',
    })
  }),
)

export default router
