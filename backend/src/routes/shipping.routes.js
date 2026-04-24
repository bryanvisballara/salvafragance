import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import ShippingZone from '../models/ShippingZone.js'

const router = Router()

router.use(requireAuth)

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    const shippingZones = await ShippingZone.find().sort({ createdAt: -1 }).lean()
    response.json(shippingZones)
  }),
)

router.post(
  '/',
  asyncHandler(async (request, response) => {
    const isFallback = Boolean(request.body.isFallback)
    const place = isFallback ? 'Otra' : request.body.place?.trim()
    const price = Number(request.body.price)
    const eta = request.body.eta?.trim() || ''

    if (!place || Number.isNaN(price)) {
      throw createHttpError(400, 'Place and shipping price are required')
    }

    if (isFallback) {
      const existingFallbackZone = await ShippingZone.findOne({ isFallback: true })

      if (existingFallbackZone) {
        existingFallbackZone.price = price
        existingFallbackZone.eta = eta
        existingFallbackZone.isActive = true
        await existingFallbackZone.save()
        response.status(201).json(existingFallbackZone)
        return
      }
    }

    const shippingZone = await ShippingZone.create({
      place,
      price,
      eta,
      isFallback,
    })

    response.status(201).json(shippingZone)
  }),
)

router.put(
  '/:id',
  asyncHandler(async (request, response) => {
    const isFallback = Boolean(request.body.isFallback)
    const place = isFallback ? 'Otra' : request.body.place?.trim()
    const price = Number(request.body.price)
    const eta = request.body.eta?.trim() || ''

    if (!place || Number.isNaN(price)) {
      throw createHttpError(400, 'Place and shipping price are required')
    }

    const shippingZone = await ShippingZone.findByIdAndUpdate(
      request.params.id,
      { place, price, eta, isFallback },
      { new: true, runValidators: true },
    )

    if (!shippingZone) {
      throw createHttpError(404, 'Shipping zone not found')
    }

    response.json(shippingZone)
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (request, response) => {
    const deletedShippingZone = await ShippingZone.findByIdAndDelete(request.params.id)

    if (!deletedShippingZone) {
      throw createHttpError(404, 'Shipping zone not found')
    }

    response.status(204).send()
  }),
)

export default router