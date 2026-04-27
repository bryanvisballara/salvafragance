import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import Category from '../models/Category.js'
import Product from '../models/Product.js'

const router = Router()

router.use(requireAuth, requireRole('admin'))

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    const categories = await Category.find().sort({ sortOrder: 1, createdAt: 1 }).lean()
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
    const hasFreeShipping = Boolean(request.body.hasFreeShipping)

    if (!name) {
      throw createHttpError(400, 'Category name is required')
    }

    const lastCategory = await Category.findOne().sort({ sortOrder: -1, createdAt: -1 }).select('sortOrder').lean()
    const nextSortOrder = Number(lastCategory?.sortOrder ?? -1) + 1

    const category = await Category.create({
      name,
      description,
      sortOrder: nextSortOrder,
      hasFreeShipping,
    })
    response.status(201).json(category)
  }),
)

router.put(
  '/reorder',
  asyncHandler(async (request, response) => {
    const categoryOrders = Array.isArray(request.body?.categoryOrders) ? request.body.categoryOrders : []
    const categoryIds = Array.isArray(request.body?.categoryIds) ? request.body.categoryIds : []

    if (categoryOrders.length) {
      const normalizedOrders = categoryOrders.map((entry, index) => {
        const categoryId = entry?.id
        const sortOrder = Number(entry?.sortOrder)

        if (!categoryId || !Number.isInteger(sortOrder) || sortOrder < 0) {
          throw createHttpError(400, `La posición de la categoría #${index + 1} es inválida`)
        }

        return { id: categoryId, sortOrder }
      })

      const categories = await Category.find({ _id: { $in: normalizedOrders.map((entry) => entry.id) } }).select('_id').lean()

      if (categories.length !== normalizedOrders.length) {
        throw createHttpError(404, 'One or more categories were not found')
      }

      await Category.bulkWrite(
        normalizedOrders.map((entry) => ({
          updateOne: {
            filter: { _id: entry.id },
            update: { $set: { sortOrder: entry.sortOrder } },
          },
        })),
      )

      const reorderedCategories = await Category.find().sort({ sortOrder: 1, createdAt: 1 }).lean()
      response.json(reorderedCategories)
      return
    }

    if (!categoryIds.length) {
      throw createHttpError(400, 'Category order is required')
    }

    const categories = await Category.find({ _id: { $in: categoryIds } }).select('_id').lean()

    if (categories.length !== categoryIds.length) {
      throw createHttpError(404, 'One or more categories were not found')
    }

    await Category.bulkWrite(
      categoryIds.map((categoryId, index) => ({
        updateOne: {
          filter: { _id: categoryId },
          update: { $set: { sortOrder: index } },
        },
      })),
    )

    const reorderedCategories = await Category.find().sort({ sortOrder: 1, createdAt: 1 }).lean()
    response.json(reorderedCategories)
  }),
)

router.put(
  '/:id',
  asyncHandler(async (request, response) => {
    const name = request.body.name?.trim()
    const description = typeof request.body.description === 'string'
      ? request.body.description.replace(/\r\n?/g, '\n')
      : ''
    const hasFreeShipping = Boolean(request.body.hasFreeShipping)

    if (!name) {
      throw createHttpError(400, 'Category name is required')
    }

    const category = await Category.findByIdAndUpdate(
      request.params.id,
      { name, description, hasFreeShipping },
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