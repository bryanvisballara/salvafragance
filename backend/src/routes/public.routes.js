import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { sendBrevoEmail } from '../lib/brevo.js'
import { buildCartCouponPricing, buildCouponPricing, resolveCouponForCart, resolveCouponForProduct } from '../lib/coupons.js'
import { buildAdminOrderNotificationEmail, buildOrderPlacedEmail } from '../lib/email-templates.js'
import { createHttpError } from '../lib/http-error.js'
import { buildPartnerSaleData, findPartnerByCouponId } from '../lib/partners.js'
import { notifyPartnerSale } from './partner.routes.js'
import Category from '../models/Category.js'
import Customer from '../models/Customer.js'
import DecantSettings from '../models/DecantSettings.js'
import Order from '../models/Order.js'
import PreOrder from '../models/PreOrder.js'
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

function normalizeOrderItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      product: item.productId || null,
      name: item.name?.trim() || '',
      variantLabel: item.variantLabel?.trim() || '',
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      lineTotal: Number(item.lineTotal || 0),
    }))
    .filter((item) => item.name && item.quantity > 0)
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
    const [categories, products, shippingZones, decantSettings] = await Promise.all([
      Category.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean(),
      Product.find({ isPublished: true }).populate('category', 'name hasFreeShipping').sort({ createdAt: -1 }).lean(),
      ShippingZone.find({ isActive: true }).sort({ place: 1 }).lean(),
      DecantSettings.findOne({ key: 'default' }).lean(),
    ])

    response.json({
      categories,
      products,
      shippingZones,
      decantSettings: decantSettings || { key: 'default', sortOrder: categories.length, sizes: [] },
    })
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
    const paymentMethod = request.body.paymentMethod?.trim() || ''
    const phoneCountryCode = customer.phoneCountryCode?.trim() || '+57'
    const baseSubtotalAmount = Number(request.body.baseSubtotalAmount || 0)
    const discountAmount = Number(request.body.discountAmount || 0)
    const surchargeAmount = Number(request.body.surchargeAmount || 0)
    const totalAmount = Number(request.body.totalAmount || 0)
    const adminEmail = process.env.ADMIN_ORDER_EMAIL || process.env.ADMIN_EMAIL
    const normalizedItems = normalizeOrderItems(items)
    const partner = coupon?.id ? await findPartnerByCouponId(coupon.id) : null
    const partnerSaleData = buildPartnerSaleData({
      partner,
      coupon: {
        ...coupon,
        totalAmount,
      },
    })

    if (!reference || !customer.firstName?.trim() || !customer.lastName?.trim() || !customer.email?.trim() || !customer.phone?.trim()) {
      throw createHttpError(400, 'Order notification data is incomplete')
    }

    if (!normalizedItems.length || !shippingZone?.place) {
      throw createHttpError(400, 'Order notification items and shipping are required')
    }

    const customerEmail = customer.email.trim().toLowerCase()
    const customerAddress = [customer.address?.trim(), customer.neighborhood?.trim()].filter(Boolean).join(', ')
    const customerNotes = [
      `Checkout: ${reference}`,
      customer.documentType?.trim() && customer.documentNumber?.trim()
        ? `Documento: ${customer.documentType.trim()} ${customer.documentNumber.trim()}`
        : null,
      customer.state?.trim() ? `Departamento: ${customer.state.trim()}` : null,
      shippingZone?.place ? `Envío: ${shippingZone.place}` : null,
      paymentMethod ? `Pago: ${paymentMethod}` : null,
      coupon?.name ? `Cupón: ${coupon.name}` : null,
      surchargeAmount > 0 ? `Recargo contra entrega: ${formatCurrency(surchargeAmount)}` : null,
      `Total checkout: ${formatCurrency(totalAmount)}`,
    ]
      .filter(Boolean)
      .join('\n')

    const storedCustomer = await Customer.findOneAndUpdate(
      { email: customerEmail },
      {
        $set: {
          firstName: customer.firstName.trim(),
          lastName: customer.lastName.trim(),
          phone: customer.phone.trim(),
          phoneCountryCode,
          email: customerEmail,
          city: customer.city?.trim() || shippingZone.place.trim(),
          address: customerAddress,
          notes: customerNotes,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )

    if (paymentMethod === 'cash_on_delivery') {
      await PreOrder.findOneAndUpdate(
        { reference },
        {
          $set: {
            customer: storedCustomer._id,
            items: normalizedItems,
            couponName: coupon?.name?.trim() || '',
            partner: partnerSaleData.partner,
            partnerCouponName: partnerSaleData.partnerCouponName,
            partnerCommissionAmount: partnerSaleData.partnerCommissionAmount,
            discountAmount,
            subtotalAmount: Number(request.body.subtotalAmount || 0),
            surchargeAmount,
            totalAmount,
            paymentMethod,
            shippingPlace: shippingZone.place.trim(),
            shippingPrice: Number(shippingZone.price || 0),
            shippingEta: shippingZone.eta?.trim() || '',
            status: 'pending',
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      )
    }

    if (!adminEmail) {
      console.warn('Admin order notification skipped: ADMIN_ORDER_EMAIL and ADMIN_EMAIL are missing')
      response.json({
        notified: false,
        skipped: true,
        reason: 'ADMIN_EMAIL is missing',
        customerStored: Boolean(storedCustomer),
        customerId: storedCustomer?._id || null,
      })
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
          items: normalizedItems.map((item) => ({
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

      response.json({
        notified: !delivery?.skipped,
        skipped: Boolean(delivery?.skipped),
        reason: delivery?.reason || '',
        customerStored: Boolean(storedCustomer),
        customerId: storedCustomer?._id || null,
      })
    } catch (error) {
      console.error('Admin order notification failed', error)
      response.json({
        notified: false,
        skipped: true,
        reason: error.message,
        customerStored: Boolean(storedCustomer),
        customerId: storedCustomer?._id || null,
      })
    }
  }),
)

router.post(
  '/orders',
  asyncHandler(async (request, response) => {
    const firstName = request.body.firstName?.trim()
    const lastName = request.body.lastName?.trim()
    const phone = request.body.phone?.trim()
    const phoneCountryCode = request.body.phoneCountryCode?.trim() || '+57'
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
    const partner = coupon?._id ? await findPartnerByCouponId(coupon._id) : null
    const pricing = buildCouponPricing({ product, coupon })
    const partnerSaleData = buildPartnerSaleData({
      partner,
      coupon: {
        ...coupon,
        totalAmount: pricing.totalAmount,
      },
    })

    const customer = await Customer.create({
      firstName,
      lastName,
      phone,
      phoneCountryCode,
      email,
      city,
      address,
      notes,
      product: productId,
    })

    const order = await Order.create({
      customer: customer.id,
      reference: request.body.reference?.trim() || `SAVAL-${Date.now()}`,
      product: productId,
      items: [
        {
          product: productId,
          name: product.name,
          variantLabel: '',
          quantity: 1,
          unitPrice: Number(product.offerPrice || 0),
          lineTotal: pricing.totalAmount,
        },
      ],
      coupon: coupon?._id || null,
      couponName: coupon?.name || '',
      partner: partnerSaleData.partner,
      partnerCouponName: partnerSaleData.partnerCouponName,
      partnerCommissionAmount: partnerSaleData.partnerCommissionAmount,
      discountType: coupon?.discountType || '',
      discountValue: Number(coupon?.discountValue || 0),
      subtotalAmount: pricing.subtotalAmount,
      discountAmount: pricing.discountAmount,
      totalAmount: pricing.totalAmount,
      paymentMethod: request.body.paymentMethod?.trim() || 'online',
      shippingPlace: city,
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
          orderReference: order.reference,
          items: order.items,
          totalAmount: order.totalAmount,
          shippingPlace: order.shippingPlace,
        }),
      })
    } catch (error) {
      console.error('Order placed email failed', error)
    }

    if (partnerSaleData.partner) {
      try {
        await notifyPartnerSale({
          partnerId: partnerSaleData.partner,
          order,
          customer,
        })
      } catch (error) {
        console.error('Partner sale email failed', error)
      }
    }

    response.status(201).json({ customer, order, pricing })
  }),
)

router.post('/customers', (_request, response) => {
  response.status(410).json({ message: 'Use /api/storefront/orders instead' })
})

export default router