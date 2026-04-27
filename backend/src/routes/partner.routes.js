import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { verifyPassword, hashPassword } from '../lib/auth.js'
import { sendBrevoEmail } from '../lib/brevo.js'
import { buildPartnerSaleEmail } from '../lib/email-templates.js'
import { syncAllPartnerPayouts, syncPartnerPayouts } from '../lib/partners.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import AdminUser from '../models/AdminUser.js'
import Coupon from '../models/Coupon.js'
import Order from '../models/Order.js'
import PartnerPayout from '../models/PartnerPayout.js'

const router = Router()

function serializePartner(partner) {
  return {
    id: partner._id,
    email: partner.email,
    name: partner.name || '',
    role: partner.role,
    commissionType: partner.commissionType === 'percentage' ? 'percentage' : 'fixed',
    commissionAmount: Number(partner.commissionAmount || 0),
    assignedCoupon: partner.assignedCoupon
      ? {
          _id: partner.assignedCoupon._id,
          name: partner.assignedCoupon.name,
          normalizedName: partner.assignedCoupon.normalizedName,
        }
      : null,
    createdAt: partner.createdAt,
  }
}

function buildPartnerMetrics(orders, payouts) {
  const totalSales = orders.length
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
  const totalCommission = orders.reduce((sum, order) => sum + Number(order.partnerCommissionAmount || 0), 0)
  const pendingCommission = payouts
    .filter((payout) => payout.status !== 'paid')
    .reduce((sum, payout) => sum + Number(payout.commissionAmount || 0), 0)
  const paidCommission = payouts
    .filter((payout) => payout.status === 'paid')
    .reduce((sum, payout) => sum + Number(payout.commissionAmount || 0), 0)

  return {
    totalSales,
    totalRevenue,
    totalCommission,
    pendingCommission,
    paidCommission,
  }
}

async function buildPartnerSnapshot(partnerId) {
  const partner = await AdminUser.findOne({ _id: partnerId, role: 'partner' })
    .populate('assignedCoupon', 'name normalizedName')
    .lean()

  if (!partner) {
    throw createHttpError(404, 'Socio no encontrado')
  }

  const payouts = await syncPartnerPayouts(partner)
  const orders = await Order.find({ partner: partner._id })
    .populate('customer')
    .populate('coupon', 'name')
    .sort({ createdAt: -1 })
    .lean()

  const customerMap = new Map()
  orders.forEach((order) => {
    if (order.customer?._id) {
      customerMap.set(String(order.customer._id), order.customer)
    }
  })

  return {
    partner: serializePartner(partner),
    metrics: buildPartnerMetrics(orders, payouts),
    orders,
    customers: [...customerMap.values()],
    payouts,
  }
}

async function ensureCouponAvailable(couponId, currentPartnerId = null) {
  if (!couponId) {
    return null
  }

  const coupon = await Coupon.findById(couponId).lean()

  if (!coupon) {
    throw createHttpError(404, 'Cupón no encontrado')
  }

  const existingPartner = await AdminUser.findOne({
    role: 'partner',
    assignedCoupon: couponId,
    ...(currentPartnerId ? { _id: { $ne: currentPartnerId } } : {}),
  }).lean()

  if (existingPartner) {
    throw createHttpError(409, 'Ese cupón ya está asignado a otro socio')
  }

  return coupon
}

function normalizeCommissionInput(commissionType, commissionAmount) {
  const normalizedType = commissionType === 'percentage' ? 'percentage' : 'fixed'
  const normalizedAmount = Number(commissionAmount || 0)

  if (Number.isNaN(normalizedAmount) || normalizedAmount < 0) {
    throw createHttpError(400, 'La comisión por venta debe ser un número válido')
  }

  if (normalizedType === 'percentage' && normalizedAmount > 100) {
    throw createHttpError(400, 'La comisión porcentual no puede ser mayor a 100')
  }

  return {
    commissionType: normalizedType,
    commissionAmount: normalizedAmount,
  }
}

router.use(requireAuth)

router.get(
  '/me',
  requireRole('partner'),
  asyncHandler(async (request, response) => {
    response.json(await buildPartnerSnapshot(request.admin._id))
  }),
)

router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (_request, response) => {
    await syncAllPartnerPayouts()
    const partners = await AdminUser.find({ role: 'partner' })
      .populate('assignedCoupon', 'name normalizedName')
      .sort({ createdAt: -1 })
      .lean()

    const payouts = await PartnerPayout.find({ partner: { $in: partners.map((partner) => partner._id) } }).lean()
    const payoutMap = payouts.reduce((map, payout) => {
      const key = String(payout.partner)
      const current = map.get(key) || { pendingCommission: 0, pendingRows: 0 }

      if (payout.status !== 'paid') {
        current.pendingCommission += Number(payout.commissionAmount || 0)
        current.pendingRows += 1
      }

      map.set(key, current)
      return map
    }, new Map())

    response.json(
      partners.map((partner) => {
        const summary = payoutMap.get(String(partner._id)) || { pendingCommission: 0, pendingRows: 0 }

        return {
          ...serializePartner(partner),
          pendingCommission: summary.pendingCommission,
          pendingRows: summary.pendingRows,
        }
      }),
    )
  }),
)

router.get(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (request, response) => {
    response.json(await buildPartnerSnapshot(request.params.id))
  }),
)

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (request, response) => {
    const email = request.body.email?.trim().toLowerCase()
    const password = request.body.password || ''
    const name = request.body.name?.trim() || ''
    const { commissionType, commissionAmount } = normalizeCommissionInput(
      request.body.commissionType,
      request.body.commissionAmount,
    )
    const couponId = request.body.couponId || null

    if (!email || !password || !name) {
      throw createHttpError(400, 'Nombre, correo y contraseña son obligatorios')
    }

    await ensureCouponAvailable(couponId)

    const existing = await AdminUser.findOne({ email }).lean()

    if (existing) {
      throw createHttpError(409, 'Ya existe un usuario con ese correo')
    }

    const partner = await AdminUser.create({
      email,
      name,
      role: 'partner',
      passwordHash: await hashPassword(password),
      assignedCoupon: couponId,
      commissionType,
      commissionAmount,
    })

    response.status(201).json(await buildPartnerSnapshot(partner._id))
  }),
)

router.put(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (request, response) => {
    const partner = await AdminUser.findOne({ _id: request.params.id, role: 'partner' })

    if (!partner) {
      throw createHttpError(404, 'Socio no encontrado')
    }

    const email = request.body.email?.trim().toLowerCase()
    const name = request.body.name?.trim() || ''
    const password = request.body.password || ''
    const { commissionType, commissionAmount } = normalizeCommissionInput(
      request.body.commissionType,
      request.body.commissionAmount,
    )
    const couponId = request.body.couponId || null

    if (!email || !name) {
      throw createHttpError(400, 'Nombre y correo son obligatorios')
    }

    await ensureCouponAvailable(couponId, partner._id)

    const emailOwner = await AdminUser.findOne({ email, _id: { $ne: partner._id } }).lean()

    if (emailOwner) {
      throw createHttpError(409, 'Ya existe otro usuario con ese correo')
    }

    partner.email = email
    partner.name = name
    partner.assignedCoupon = couponId
    partner.commissionType = commissionType
    partner.commissionAmount = commissionAmount

    if (password) {
      partner.passwordHash = await hashPassword(password)
    }

    await partner.save()

    response.json(await buildPartnerSnapshot(partner._id))
  }),
)

router.post(
  '/:id/payouts/:payoutId/pay',
  requireRole('admin'),
  asyncHandler(async (request, response) => {
    const payout = await PartnerPayout.findOne({
      _id: request.params.payoutId,
      partner: request.params.id,
    })

    if (!payout) {
      throw createHttpError(404, 'Fila de pago no encontrada')
    }

    payout.status = 'paid'
    payout.paidAt = new Date()
    await payout.save()

    response.json(await buildPartnerSnapshot(request.params.id))
  }),
)

export async function notifyPartnerSale({ partnerId, order, customer }) {
  if (!partnerId) {
    return { skipped: true, reason: 'Partner not assigned' }
  }

  const partner = await AdminUser.findOne({ _id: partnerId, role: 'partner' }).populate('assignedCoupon', 'name').lean()

  if (!partner?.email) {
    return { skipped: true, reason: 'Partner email missing' }
  }

  return sendBrevoEmail({
    to: {
      email: partner.email,
      name: partner.name || partner.email,
    },
    subject: `Nueva venta con tu cupón ${partner.assignedCoupon?.name || order.partnerCouponName}`,
    htmlContent: buildPartnerSaleEmail({
      partnerName: partner.name || partner.email,
      orderReference: order.reference,
      couponName: order.partnerCouponName || partner.assignedCoupon?.name || '',
      customerName: `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim(),
      totalAmount: order.totalAmount,
      commissionAmount: order.partnerCommissionAmount,
    }),
  })
}

export default router