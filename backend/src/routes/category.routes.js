import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import Category from '../models/Category.js'
import Product from '../models/Product.js'

const router = Router()

router.use(requireAuth)

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    const categories = await Category.find().sort({ createdAt: -1 }).lean()
    response.json(categories)
  }),
)

router.post(
  '/',
  asyncHandler(async (request, response) => {
    const name = request.body.name?.trim()
    const description = typeof request.body.description === 'string'
      ? request.body.description.replace(/\r\n?/g, '\n')
      : ''

    if (!name) {
      throw createHttpError(400, 'Category name is required')
    }

    const category = await Category.create({ name, description })
    response.status(201).json(category)
  }),
)

router.put(
  '/:id',
  asyncHandler(async (request, response) => {
    const name = request.body.name?.trim()
    const description = typeof request.body.description === 'string'
      ? request.body.description.replace(/\r\n?/g, '\n')
      : ''

    if (!name) {
      throw createHttpError(400, 'Category name is required')
    }

    const category = await Category.findByIdAndUpdate(
      request.params.id,
      { name, description },
      { new: true, runValidators: true },
    )

    if (!category) {
      throw createHttpError(404, 'Category not found')
    }

    response.json(category)
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (request, response) => {
    const linkedProduct = await Product.findOne({ category: request.params.id }).lean()

    if (linkedProduct) {
      throw createHttpError(409, 'No puedes eliminar una categoria con publicaciones asociadas')
    }

    const deletedCategory = await Category.findByIdAndDelete(request.params.id)

    if (!deletedCategory) {
      throw createHttpError(404, 'Category not found')
    }

    response.status(204).send()
  }),
)

export default router