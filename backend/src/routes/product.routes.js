import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import Category from '../models/Category.js'
import Coupon from '../models/Coupon.js'
import DecantSettings from '../models/DecantSettings.js'
import Product from '../models/Product.js'

const router = Router()

router.use(requireAuth)

async function normalizeDecantPrices(rawDecantPrices) {
  const decantPrices = Array.isArray(rawDecantPrices) ? rawDecantPrices : []

  if (!decantPrices.length) {
    return []
  }

  const settings = await DecantSettings.findOne({ key: 'default' }).lean()
  const validSizeIds = new Set((settings?.sizes || []).map((size) => String(size._id)))

  return decantPrices
    .map((decantPrice) => ({
      sizeId: String(decantPrice?.sizeId || '').trim(),
      price: Number(decantPrice?.price),
    }))
    .filter((decantPrice) => decantPrice.sizeId && Number.isFinite(decantPrice.price) && decantPrice.price > 0)
    .map((decantPrice) => {
      if (!validSizeIds.has(decantPrice.sizeId)) {
        throw createHttpError(400, 'Uno de los tamaños de decant no existe en la configuración actual.')
      }

      return decantPrice
    })
}

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    const products = await Product.find()
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .lean()

    response.json(products)
  }),
)

router.post(
  '/',
  asyncHandler(async (request, response) => {
    const name = request.body.name?.trim()
    const description = typeof request.body.description === 'string'
      ? request.body.description.replace(/\r\n?/g, '\n')
      : ''
    const categoryId = request.body.categoryId
    const basePrice = Number(request.body.basePrice)
    const offerPrice = Number(request.body.offerPrice)
    const stock = Number(request.body.stock)
    const rating = Number(request.body.rating ?? 0)
    const reviewCount = Number(request.body.reviewCount ?? 0)
    const imageUrls = Array.isArray(request.body.imageUrls) ? request.body.imageUrls : []
    const decantPrices = await normalizeDecantPrices(request.body.decantPrices)

    if (!name || !categoryId || Number.isNaN(basePrice) || Number.isNaN(offerPrice) || Number.isNaN(stock)) {
      throw createHttpError(400, 'Product name, category, base price, offer price and stock are required')
    }

    if (basePrice <= offerPrice) {
      throw createHttpError(400, 'Base price must be greater than offer price')
    }

    if (Number.isNaN(rating) || rating < 0 || rating > 5) {
      throw createHttpError(400, 'Rating must be between 0 and 5')
    }

    if (Number.isNaN(reviewCount) || reviewCount < 0 || !Number.isInteger(reviewCount)) {
      throw createHttpError(400, 'Review count must be a whole number greater than or equal to 0')
    }

    const category = await Category.findById(categoryId)

    if (!category) {
      throw createHttpError(404, 'Category not found')
    }

    const product = await Product.create({
      name,
      description,
      category: category.id,
      basePrice,
      offerPrice,
      stock,
      rating,
      reviewCount,
      imageUrls,
      decantPrices,
    })

    const populatedProduct = await Product.findById(product.id).populate('category', 'name').lean()
    response.status(201).json(populatedProduct)
  }),
)

router.put(
  '/:id',
  asyncHandler(async (request, response) => {
    const name = request.body.name?.trim()
    const description = typeof request.body.description === 'string'
      ? request.body.description.replace(/\r\n?/g, '\n')
      : ''
    const categoryId = request.body.categoryId
    const basePrice = Number(request.body.basePrice)
    const offerPrice = Number(request.body.offerPrice)
    const stock = Number(request.body.stock)
    const rating = Number(request.body.rating ?? 0)
    const reviewCount = Number(request.body.reviewCount ?? 0)
    const imageUrls = Array.isArray(request.body.imageUrls) ? request.body.imageUrls : []
    const decantPrices = await normalizeDecantPrices(request.body.decantPrices)

    if (!name || !categoryId || Number.isNaN(basePrice) || Number.isNaN(offerPrice) || Number.isNaN(stock)) {
      throw createHttpError(400, 'Product name, category, base price, offer price and stock are required')
    }

    if (basePrice <= offerPrice) {
      throw createHttpError(400, 'Base price must be greater than offer price')
    }

    if (Number.isNaN(rating) || rating < 0 || rating > 5) {
      throw createHttpError(400, 'Rating must be between 0 and 5')
    }

    if (Number.isNaN(reviewCount) || reviewCount < 0 || !Number.isInteger(reviewCount)) {
      throw createHttpError(400, 'Review count must be a whole number greater than or equal to 0')
    }

    const category = await Category.findById(categoryId)

    if (!category) {
      throw createHttpError(404, 'Category not found')
    }

    const product = await Product.findByIdAndUpdate(
      request.params.id,
      {
        name,
        description,
        category: category.id,
        basePrice,
        offerPrice,
        stock,
        rating,
        reviewCount,
        imageUrls,
        decantPrices,
      },
      { new: true, runValidators: true },
    )

    if (!product) {
      throw createHttpError(404, 'Product not found')
    }

    const populatedProduct = await Product.findById(product.id).populate('category', 'name').lean()
    response.json(populatedProduct)
  }),
)

router.put(
  '/:id/decants',
  asyncHandler(async (request, response) => {
    const decantPrices = await normalizeDecantPrices(request.body.decantPrices)

    const product = await Product.findByIdAndUpdate(
      request.params.id,
      { decantPrices },
      { new: true, runValidators: true },
    )

    if (!product) {
      throw createHttpError(404, 'Product not found')
    }

    const populatedProduct = await Product.findById(product.id).populate('category', 'name').lean()
    response.json(populatedProduct)
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (request, response) => {
    const deletedProduct = await Product.findByIdAndDelete(request.params.id)

    if (!deletedProduct) {
      throw createHttpError(404, 'Product not found')
    }

    await Coupon.updateMany({}, { $pull: { products: deletedProduct._id } })

    response.status(204).send()
  }),
)

export default router