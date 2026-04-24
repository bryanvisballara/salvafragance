import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { sendBrevoEmail } from '../lib/brevo.js'
import { buildCartCouponPricing, buildCouponPricing, resolveCouponForCart, resolveCouponForProduct } from '../lib/coupons.js'
import { buildAdminOrderNotificationEmail, buildOrderPlacedEmail } from '../lib/email-templates.js'
import { createHttpError } from '../lib/http-error.js'
import Category from '../models/Category.js'
import Customer from '../models/Customer.js'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import ShippingZone from '../models/ShippingZone.js'

const router = Router()

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

router.post(
  '/coupons/validate',
  asyncHandler(async (request, response) => {
    const productId = request.body.productId
    const couponName = request.body.couponName

    if (!productId || !couponName?.trim()) {
      throw createHttpError(400, 'Producto y cupón son obligatorios')
    }

    const product = await Product.findById(productId).lean()

    if (!product) {
      throw createHttpError(404, 'Product not found')
    }

    const coupon = await resolveCouponForProduct({ couponName, productId })
    const pricing = buildCouponPricing({ product, coupon })

    response.json({
      coupon: {
        id: coupon._id,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      subtotalAmount: pricing.subtotalAmount,
      discountAmount: pricing.discountAmount,
      totalAmount: pricing.totalAmount,
    })
  }),
)

router.post(
  '/checkout/coupons/validate',
  asyncHandler(async (request, response) => {
    const couponName = request.body.couponName
    const items = Array.isArray(request.body.items) ? request.body.items : []

    if (!couponName?.trim() || !items.length) {
      throw createHttpError(400, 'Cupón e items del checkout son obligatorios')
    }

    const normalizedItems = items
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity || 0),
      }))
      .filter((item) => item.productId && item.quantity > 0)

    if (!normalizedItems.length) {
      throw createHttpError(400, 'No hay productos válidos en el checkout para aplicar el cupón')
    }

    const products = await Product.find({ _id: { $in: normalizedItems.map((item) => item.productId) } }).lean()
    const productMap = new Map(products.map((product) => [String(product._id), product]))

    const checkoutItems = normalizedItems.map((item) => {
      const product = productMap.get(String(item.productId))

      if (!product) {
        throw createHttpError(404, 'Uno de los productos del checkout no existe')
      }

      return {
        productId: String(product._id),
        quantity: item.quantity,
        lineTotal: Number(product.offerPrice || 0) * item.quantity,
      }
    })

    const { coupon, eligibleProductIds } = await resolveCouponForCart({
      couponName,
      productIds: checkoutItems.map((item) => item.productId),
    })
    const pricing = buildCartCouponPricing({
      items: checkoutItems,
      coupon,
      eligibleProductIds,
    })

    response.json({
      coupon: {
        id: coupon._id,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      eligibleProductIds,
      subtotalAmount: pricing.subtotalAmount,
      eligibleSubtotalAmount: pricing.eligibleSubtotalAmount,
      discountAmount: pricing.discountAmount,
      totalAmount: pricing.totalAmount,
    })
  }),
)

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    const [categories, products, shippingZones] = await Promise.all([
      Category.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean(),
      Product.find({ isPublished: true }).populate('category', 'name').sort({ createdAt: -1 }).lean(),
      ShippingZone.find({ isActive: true }).sort({ place: 1 }).lean(),
    ])

    response.json({ categories, products, shippingZones })
  }),
)

router.post(
  '/checkout/admin-notify',
  asyncHandler(async (request, response) => {
    const reference = request.body.reference?.trim()
    const customer = request.body.customer || {}
    const items = Array.isArray(request.body.items) ? request.body.items : []
    const shippingZone = request.body.shippingZone || null
    const coupon = request.body.coupon || null
    const baseSubtotalAmount = Number(request.body.baseSubtotalAmount || 0)
    const discountAmount = Number(request.body.discountAmount || 0)
    const totalAmount = Number(request.body.totalAmount || 0)
    const adminEmail = process.env.ADMIN_ORDER_EMAIL || process.env.ADMIN_EMAIL

    if (!reference || !customer.firstName?.trim() || !customer.lastName?.trim() || !customer.email?.trim() || !customer.phone?.trim()) {
      throw createHttpError(400, 'Order notification data is incomplete')
    }

    if (!items.length || !shippingZone?.place) {
      throw createHttpError(400, 'Order notification items and shipping are required')
    }

    if (!adminEmail) {
      response.json({ notified: false, skipped: true, reason: 'ADMIN_EMAIL is missing' })
      return
    }

    try {
      const delivery = await sendBrevoEmail({
        to: {
          email: adminEmail,
          name: 'Administrador Saval Fragance',
        },
        subject: `Nueva orden ${reference}`,
        htmlContent: buildAdminOrderNotificationEmail({
          reference,
          customer,
          items: items.map((item) => ({
            ...item,
            unitPriceLabel: formatCurrency(item.unitPrice),
            lineTotalLabel: formatCurrency(item.lineTotal),
          })),
          shippingZone: {
            ...shippingZone,
            priceLabel: formatCurrency(shippingZone.price),
          },
          coupon: coupon
            ? {
                ...coupon,
                discountAmountLabel: `- ${formatCurrency(coupon.discountAmount)}`,
              }
            : null,
          baseSubtotalAmount: formatCurrency(baseSubtotalAmount),
          discountAmount: discountAmount > 0 ? `- ${formatCurrency(discountAmount)}` : 'Sin descuento',
          totalAmount: formatCurrency(totalAmount),
        }),
      })

      response.json({ notified: !delivery?.skipped, skipped: Boolean(delivery?.skipped) })
    } catch (error) {
      console.error('Admin order notification failed', error)
      response.json({ notified: false, skipped: true, reason: error.message })
    }
  }),
)

router.post(
  '/orders',
  asyncHandler(async (request, response) => {
    const firstName = request.body.firstName?.trim()
    const lastName = request.body.lastName?.trim()
    const phone = request.body.phone?.trim()
    const email = request.body.email?.trim().toLowerCase()
    const city = request.body.city?.trim()
    const address = request.body.address?.trim()
    const notes = request.body.notes?.trim() || ''
    const productId = request.body.productId || null
    const couponName = request.body.couponName?.trim() || ''

    if (!firstName || !lastName || !phone || !email || !city || !address || !productId) {
      throw createHttpError(400, 'Customer purchase data is incomplete')
    }

    const product = await Product.findById(productId).lean()

    if (!product) {
      throw createHttpError(404, 'Product not found')
    }

    const coupon = couponName ? await resolveCouponForProduct({ couponName, productId }) : null
    const pricing = buildCouponPricing({ product, coupon })

    const customer = await Customer.create({
      firstName,
      lastName,
      phone,
      email,
      city,
      address,
      notes,
      product: productId,
    })

    const order = await Order.create({
      customer: customer.id,
      product: productId,
      coupon: coupon?._id || null,
      couponName: coupon?.name || '',
      discountType: coupon?.discountType || '',
      discountValue: Number(coupon?.discountValue || 0),
      subtotalAmount: pricing.subtotalAmount,
      discountAmount: pricing.discountAmount,
      totalAmount: pricing.totalAmount,
    })

    try {
      await sendBrevoEmail({
        to: {
          email,
          name: `${firstName} ${lastName}`,
        },
        subject: `Tu pedido en Saval Fragance está siendo preparado`,
        htmlContent: buildOrderPlacedEmail({
          customerName: firstName,
          productName: product.name,
        }),
      })
    } catch (error) {
      console.error('Order placed email failed', error)
    }

    response.status(201).json({ customer, order, pricing })
  }),
)

router.post('/customers', (_request, response) => {
  response.status(410).json({ message: 'Use /api/storefront/orders instead' })
})

export default router