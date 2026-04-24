import { createHttpError } from './http-error.js'
import Coupon from '../models/Coupon.js'

export function normalizeCouponName(value) {
  return String(value || '').trim().toUpperCase()
}

function getStartOfCouponDay(value) {
  const date = new Date(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
}

function getEndOfCouponDay(value) {
  const date = new Date(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
}

function formatCouponBoundaryDate(value) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function calculateDiscountAmount({ subtotal, discountType, discountValue }) {
  if (discountType === 'percentage') {
    return Math.min(subtotal, Math.round((subtotal * discountValue) / 100))
  }

  return Math.min(subtotal, discountValue)
}

function getCouponDateRangeIssue(coupon) {
  const now = new Date()

  if (coupon?.startsAt && getStartOfCouponDay(coupon.startsAt) > now) {
    return {
      type: 'starts-in-future',
      dateLabel: formatCouponBoundaryDate(coupon.startsAt),
    }
  }

  if (coupon?.endsAt && getEndOfCouponDay(coupon.endsAt) < now) {
    return {
      type: 'expired',
      dateLabel: formatCouponBoundaryDate(coupon.endsAt),
    }
  }

  return null
}

function assertCouponIsWithinDateRange(coupon) {
  const issue = getCouponDateRangeIssue(coupon)

  if (!issue) {
    return
  }

  if (issue.type === 'starts-in-future') {
    throw createHttpError(400, `Este cupón estará vigente desde el ${issue.dateLabel}`)
  }

  throw createHttpError(400, `Este cupón venció el ${issue.dateLabel}`)
}

export async function resolveCouponForProduct({ couponName, productId }) {
  const normalizedName = normalizeCouponName(couponName)

  if (!normalizedName) {
    return null
  }

  const coupon = await Coupon.findOne({ normalizedName, isActive: true }).lean()

  if (!coupon) {
    throw createHttpError(404, 'Cupón no encontrado o inactivo')
  }

  assertCouponIsWithinDateRange(coupon)

  const appliesToProduct = coupon.products.some((couponProductId) => String(couponProductId) === String(productId))

  if (!appliesToProduct) {
    throw createHttpError(400, 'Este cupón no aplica para la publicación seleccionada')
  }

  return coupon
}

export async function resolveCouponForCart({ couponName, productIds }) {
  const normalizedName = normalizeCouponName(couponName)

  if (!normalizedName) {
    return null
  }

  const coupon = await Coupon.findOne({ normalizedName, isActive: true }).lean()

  if (!coupon) {
    throw createHttpError(404, 'Cupón no encontrado o inactivo')
  }

  assertCouponIsWithinDateRange(coupon)

  const normalizedProductIds = [...new Set((productIds || []).map((productId) => String(productId)).filter(Boolean))]

  if (!normalizedProductIds.length) {
    throw createHttpError(400, 'No hay productos en el checkout para validar el cupón')
  }

  const eligibleProductIds = coupon.products
    .map((couponProductId) => String(couponProductId))
    .filter((couponProductId) => normalizedProductIds.includes(couponProductId))

  if (!eligibleProductIds.length) {
    throw createHttpError(400, 'Este cupón no aplica para los productos del checkout')
  }

  return {
    coupon,
    eligibleProductIds,
  }
}

export function buildCouponPricing({ product, coupon }) {
  const subtotalAmount = Number(product.offerPrice || 0)

  if (!coupon) {
    return {
      subtotalAmount,
      discountAmount: 0,
      totalAmount: subtotalAmount,
      coupon: null,
    }
  }

  const discountAmount = calculateDiscountAmount({
    subtotal: subtotalAmount,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue || 0),
  })

  return {
    subtotalAmount,
    discountAmount,
    totalAmount: Math.max(0, subtotalAmount - discountAmount),
    coupon,
  }
}

export function buildCartCouponPricing({ items, coupon, eligibleProductIds = [] }) {
  const subtotalAmount = (items || []).reduce((total, item) => total + Number(item.lineTotal || 0), 0)
  const eligibleSubtotalAmount = (items || []).reduce((total, item) => {
    if (!eligibleProductIds.includes(String(item.productId))) {
      return total
    }

    return total + Number(item.lineTotal || 0)
  }, 0)

  if (!coupon) {
    return {
      subtotalAmount,
      eligibleSubtotalAmount,
      discountAmount: 0,
      totalAmount: subtotalAmount,
      coupon: null,
    }
  }

  const discountAmount = calculateDiscountAmount({
    subtotal: eligibleSubtotalAmount,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue || 0),
  })

  return {
    subtotalAmount,
    eligibleSubtotalAmount,
    discountAmount,
    totalAmount: Math.max(0, subtotalAmount - discountAmount),
    coupon,
  }
}