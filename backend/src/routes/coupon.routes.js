import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { createHttpError } from '../lib/http-error.js'
import { normalizeCouponName } from '../lib/coupons.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import Coupon from '../models/Coupon.js'

const router = Router()

router.use(requireAuth, requireRole('admin', 'operator'))

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    const coupons = await Coupon.find().populate('products', 'name offerPrice').sort({ createdAt: -1 }).lean()
    response.json(coupons)
  }),
)

function buildCouponPayload(body) {
  const name = body.name?.trim()
  const normalizedName = normalizeCouponName(name)
  const products = Array.isArray(body.productIds) ? body.productIds : []
  const discountType = body.discountType
  const discountValue = Number(body.discountValue)
  const startsAt = body.startsAt ? new Date(body.startsAt) : null
  const hasNoExpiry = Boolean(body.hasNoExpiry)
  const endsAt = hasNoExpiry ? null : body.endsAt ? new Date(body.endsAt) : null

  if (!name || !normalizedName || !products.length || !discountType || Number.isNaN(discountValue) || !startsAt || (!hasNoExpiry && !endsAt)) {
    throw createHttpError(400, 'Nombre, publicaciones, tipo de descuento, valor y fecha inicial son obligatorios')
  }

  if (!['percentage', 'fixed'].includes(discountType)) {
    throw createHttpError(400, 'Tipo de descuento invalido')
  }

  if (discountValue <= 0) {
    throw createHttpError(400, 'El descuento debe ser mayor a cero')
  }

  if (discountType === 'percentage' && discountValue > 100) {
    throw createHttpError(400, 'El descuento porcentual no puede superar 100%')
  }

  if (Number.isNaN(startsAt.getTime()) || (!hasNoExpiry && Number.isNaN(endsAt.getTime()))) {
    throw createHttpError(400, 'El rango de fechas del cupón no es válido')
  }

  if (!hasNoExpiry && endsAt < startsAt) {
    throw createHttpError(400, 'La fecha final no puede ser anterior a la fecha inicial')
  }

  return {
    name,
    normalizedName,
    products,
    discountType,
    discountValue,
    startsAt,
    endsAt,
    isActive: true,
  }
}

router.post(
  '/',
  asyncHandler(async (request, response) => {
    const payload = buildCouponPayload(request.body)
    const existing = await Coupon.findOne({ normalizedName: payload.normalizedName }).lean()

    if (existing) {
      throw createHttpError(409, 'Ya existe un cupón con ese nombre')
    }

    const coupon = await Coupon.create(payload)
    response.status(201).json(await Coupon.findById(coupon.id).populate('products', 'name offerPrice').lean())
  }),
)

router.put(
  '/:id',
  asyncHandler(async (request, response) => {
    const payload = buildCouponPayload(request.body)
    const existing = await Coupon.findOne({ normalizedName: payload.normalizedName, _id: { $ne: request.params.id } }).lean()

    if (existing) {
      throw createHttpError(409, 'Ya existe un cupón con ese nombre')
    }

    const coupon = await Coupon.findByIdAndUpdate(request.params.id, payload, {
      new: true,
      runValidators: true,
    })

    if (!coupon) {
      throw createHttpError(404, 'Coupon not found')
    }

    response.json(await Coupon.findById(coupon.id).populate('products', 'name offerPrice').lean())
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (request, response) => {
    const deletedCoupon = await Coupon.findByIdAndDelete(request.params.id)

    if (!deletedCoupon) {
      throw createHttpError(404, 'Coupon not found')
    }

    response.status(204).send()
  }),
)

export default router