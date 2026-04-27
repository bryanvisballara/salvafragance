import AdminUser from '../models/AdminUser.js'
import Order from '../models/Order.js'
import PartnerPayout from '../models/PartnerPayout.js'

function toUtcDate(value) {
  const date = new Date(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
}

function getPayoutPeriodForDate(value) {
  const startOfDay = toUtcDate(value)
  const dayOfWeek = startOfDay.getUTCDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7
  const periodEnd = new Date(startOfDay)
  periodEnd.setUTCDate(periodEnd.getUTCDate() + daysUntilFriday)
  periodEnd.setUTCHours(23, 59, 59, 999)

  const periodStart = new Date(periodEnd)
  periodStart.setUTCDate(periodStart.getUTCDate() - 6)
  periodStart.setUTCHours(0, 0, 0, 0)

  return { periodStart, periodEnd }
}

function getLastCompletedFridayEnd(now = new Date()) {
  const currentPeriod = getPayoutPeriodForDate(now)

  if (currentPeriod.periodEnd <= now) {
    return currentPeriod.periodEnd
  }

  const previousFriday = new Date(currentPeriod.periodEnd)
  previousFriday.setUTCDate(previousFriday.getUTCDate() - 7)
  previousFriday.setUTCHours(23, 59, 59, 999)
  return previousFriday
}

function listCompletedPeriodsSince(createdAt, untilDate) {
  if (!createdAt || !untilDate || createdAt > untilDate) {
    return []
  }

  const firstPeriod = getPayoutPeriodForDate(createdAt)
  const periods = []
  let currentStart = new Date(firstPeriod.periodStart)

  while (currentStart <= untilDate) {
    const currentEnd = new Date(currentStart)
    currentEnd.setUTCDate(currentEnd.getUTCDate() + 6)
    currentEnd.setUTCHours(23, 59, 59, 999)

    if (currentEnd > untilDate) {
      break
    }

    periods.push({
      periodStart: new Date(currentStart),
      periodEnd: currentEnd,
    })

    currentStart = new Date(currentStart)
    currentStart.setUTCDate(currentStart.getUTCDate() + 7)
    currentStart.setUTCHours(0, 0, 0, 0)
  }

  return periods
}

export async function findPartnerByCouponId(couponId) {
  if (!couponId) {
    return null
  }

  return AdminUser.findOne({ role: 'partner', assignedCoupon: couponId }).lean()
}

export function buildPartnerSaleData({ partner, coupon }) {
  if (!partner || !coupon) {
    return {
      partner: null,
      partnerCouponName: '',
      partnerCommissionAmount: 0,
    }
  }

  return {
    partner: partner._id,
    partnerCouponName: coupon.name || '',
    partnerCommissionAmount: Number(partner.commissionAmount || 0),
  }
}

export async function syncPartnerPayouts(partnerOrId) {
  const partner = typeof partnerOrId === 'object' && partnerOrId?._id
    ? partnerOrId
    : await AdminUser.findOne({ _id: partnerOrId, role: 'partner' }).lean()

  if (!partner) {
    return []
  }

  const lastCompletedFridayEnd = getLastCompletedFridayEnd()
  const periods = listCompletedPeriodsSince(partner.createdAt, lastCompletedFridayEnd)

  if (!periods.length) {
    return PartnerPayout.find({ partner: partner._id }).sort({ periodStart: -1 }).lean()
  }

  const orders = await Order.find({
    partner: partner._id,
    createdAt: {
      $lte: lastCompletedFridayEnd,
    },
  })
    .select('createdAt totalAmount partnerCommissionAmount')
    .lean()

  const orderGroups = new Map()

  orders.forEach((order) => {
    const { periodStart } = getPayoutPeriodForDate(order.createdAt)
    const key = periodStart.toISOString()
    const current = orderGroups.get(key) || {
      salesCount: 0,
      revenueAmount: 0,
      commissionAmount: 0,
    }

    current.salesCount += 1
    current.revenueAmount += Number(order.totalAmount || 0)
    current.commissionAmount += Number(order.partnerCommissionAmount || 0)
    orderGroups.set(key, current)
  })

  await Promise.all(
    periods.map(({ periodStart, periodEnd }) => {
      const summary = orderGroups.get(periodStart.toISOString()) || {
        salesCount: 0,
        revenueAmount: 0,
        commissionAmount: 0,
      }

      return PartnerPayout.findOneAndUpdate(
        {
          partner: partner._id,
          periodStart,
          periodEnd,
        },
        {
          $set: summary,
          $setOnInsert: {
            status: 'pending',
            paidAt: null,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      )
    }),
  )

  return PartnerPayout.find({ partner: partner._id }).sort({ periodStart: -1 }).lean()
}

export async function syncAllPartnerPayouts() {
  const partners = await AdminUser.find({ role: 'partner' }).select('_id createdAt').lean()
  await Promise.all(partners.map((partner) => syncPartnerPayouts(partner)))
}