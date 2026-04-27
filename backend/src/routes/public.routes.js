import crypto from 'node:crypto'
import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { sendBrevoEmail } from '../lib/brevo.js'
import { buildCartCouponPricing, buildCouponPricing, resolveCouponForCart, resolveCouponForProduct } from '../lib/coupons.js'
import { buildAdminOrderNotificationEmail, buildOrderPlacedEmail } from '../lib/email-templates.js'
import { createHttpError } from '../lib/http-error.js'
import { buildPartnerSaleData, findPartnerByCouponId } from '../lib/partners.js'
import { notifyPartnerSale } from './partner.routes.js'
import Category from '../models/Category.js'
import CheckoutSession from '../models/CheckoutSession.js'
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

function getStorefrontBaseUrl() {
  const clientUrls = String(process.env.CLIENT_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)

  return (
    process.env.STOREFRONT_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    process.env.PUBLIC_STORE_URL?.trim() ||
    clientUrls.find((url) => url.startsWith('https://')) ||
    clientUrls.find((url) => url.startsWith('http://')) ||
    'https://savalfragance.com'
  ).replace(/\/$/, '')
}

function getWhatsAppPhoneNumber() {
  return String(process.env.WHATSAPP_PHONE_NUMBER || '573001767364').replace(/\D/g, '')
}

function buildWhatsAppUrl(message) {
  return `https://wa.me/${getWhatsAppPhoneNumber()}?text=${encodeURIComponent(message)}`
}

function formatCustomerPhone(countryCode, phone) {
  return `${countryCode || '+57'} ${String(phone || '').trim()}`.trim()
}

function getPaymentMethodLabel(paymentMethod) {
  if (paymentMethod === 'cash_on_delivery') {
    return 'Efectivo contra entrega'
  }

  if (paymentMethod === 'online') {
    return 'Pago en línea'
  }

  return 'Sin definir'
}

function productHasFreeShipping(product) {
  return Boolean(product?.hasFreeShipping) || Boolean(product?.category?.hasFreeShipping)
}

function normalizePhoneNumber(countryCode, phone) {
  const normalizedCountryCode = String(countryCode || '+57').replace(/\D/g, '')
  const normalizedPhone = String(phone || '').replace(/\D/g, '')
  return `${normalizedCountryCode}${normalizedPhone}`
}

function createCheckoutReference() {
  return `SAVAL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

function createSha256Hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function normalizeWompiLegalIdType(documentType) {
  const normalized = String(documentType || '').trim().toUpperCase()

  if (normalized === 'PASAPORTE') {
    return 'PP'
  }

  if (['CC', 'CE', 'NIT', 'PP', 'TI', 'DNI', 'RG', 'OTHER'].includes(normalized)) {
    return normalized
  }

  return 'OTHER'
}

function buildCheckoutWhatsAppLink({
  reference,
  customer,
  items,
  shippingZone,
  subtotalAmount,
  discountAmount,
  totalAmount,
  paymentMethod,
}) {
  const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
  const itemLines = (Array.isArray(items) ? items : []).map(
    (item) => `- ${item.variantLabel ? `${item.name} · ${item.variantLabel}` : item.name} x${item.quantity} (${formatCurrency(item.lineTotal)})`,
  )

  const discountLabel = discountAmount > 0
    ? `Descuento: ${formatCurrency(discountAmount)}`
    : 'Descuento: Sin descuento'

  return buildWhatsAppUrl(
    [
      `Hola, quiero confirmar mi pedido ${reference}.`,
      '',
      `Cliente: ${customerName}`,
      `Documento: ${customer.documentType || 'Sin definir'} ${customer.documentNumber || ''}`.trim(),
      `Teléfono: ${formatCustomerPhone(customer.phoneCountryCode, customer.phone)}`,
      `Correo: ${customer.email}`,
      `Dirección: ${customer.address}, ${customer.neighborhood}`,
      `Ciudad: ${customer.city}, ${customer.state}`,
      `Método de pago: ${getPaymentMethodLabel(paymentMethod)}`,
      '',
      'Productos:',
      ...itemLines,
      '',
      `Subtotal: ${formatCurrency(subtotalAmount)}`,
      discountLabel,
      `Envío (${shippingZone.place}): ${shippingZone.price > 0 ? formatCurrency(shippingZone.price) : 'Gratis'}`,
      `Total: ${formatCurrency(totalAmount)}`,
    ].join('\n'),
  )
}

function resolveNestedValue(source, path) {
  return String(
    String(path || '')
      .split('.')
      .reduce((value, key) => value?.[key], source) ??
      '',
  )
}

function verifyWompiEventSignature(eventPayload) {
  const secret = process.env.WOMPI_EVENTS_SECRET?.trim()

  if (!secret) {
    console.warn('Wompi event received without WOMPI_EVENTS_SECRET configured')
    return false
  }

  const providedChecksum = String(eventPayload?.signature?.checksum || '').trim().toUpperCase()
  const properties = Array.isArray(eventPayload?.signature?.properties) ? eventPayload.signature.properties : []

  if (!providedChecksum || !properties.length) {
    return false
  }

  const signedPayload = `${properties.map((property) => resolveNestedValue(eventPayload?.data, property)).join('')}${String(eventPayload?.timestamp || '')}${secret}`
  const expectedChecksum = createSha256Hash(signedPayload).toUpperCase()

  if (expectedChecksum.length !== providedChecksum.length) {
    return false
  }

  return crypto.timingSafeEqual(Buffer.from(expectedChecksum), Buffer.from(providedChecksum))
}

function mapWompiStatus(status) {
  switch (String(status || '').trim().toUpperCase()) {
    case 'APPROVED':
      return 'approved'
    case 'DECLINED':
      return 'declined'
    case 'VOIDED':
      return 'voided'
    case 'ERROR':
      return 'error'
    default:
      return 'pending'
  }
}

async function buildCheckoutContext({ customer, items, shippingZone, coupon, paymentMethod = 'online' }) {
  const normalizedCustomer = {
    firstName: customer.firstName?.trim() || '',
    lastName: customer.lastName?.trim() || '',
    documentType: customer.documentType?.trim() || '',
    documentNumber: customer.documentNumber?.trim() || '',
    phoneCountryCode: customer.phoneCountryCode?.trim() || '+57',
    phone: customer.phone?.trim() || '',
    email: customer.email?.trim().toLowerCase() || '',
    address: customer.address?.trim() || '',
    neighborhood: customer.neighborhood?.trim() || '',
    state: customer.state?.trim() || '',
    city: customer.city?.trim() || '',
  }

  if (
    !normalizedCustomer.firstName ||
    !normalizedCustomer.lastName ||
    !normalizedCustomer.email ||
    !normalizedCustomer.phone ||
    !normalizedCustomer.address ||
    !normalizedCustomer.neighborhood ||
    !normalizedCustomer.state ||
    !normalizedCustomer.city
  ) {
    throw createHttpError(400, 'Los datos del cliente están incompletos')
  }

  const normalizedItemsInput = (Array.isArray(items) ? items : [])
    .map((item) => ({
      productId: String(item.productId || '').trim(),
      quantity: Number(item.quantity || 0),
      variantLabel: item.variantLabel?.trim() || '',
      decantSizeId: item.decantSizeId ? String(item.decantSizeId).trim() : '',
    }))
    .filter((item) => item.productId && item.quantity > 0)

  if (!normalizedItemsInput.length) {
    throw createHttpError(400, 'No hay productos válidos en el checkout')
  }

  if (!shippingZone?.id || !shippingZone?.place?.trim()) {
    throw createHttpError(400, 'La ciudad de envío es obligatoria')
  }

  const products = await Product.find({ _id: { $in: normalizedItemsInput.map((item) => item.productId) } })
    .populate('category', 'name hasFreeShipping')
    .lean()

  const productMap = new Map(products.map((product) => [String(product._id), product]))

  if (productMap.size !== new Set(normalizedItemsInput.map((item) => item.productId)).size) {
    throw createHttpError(404, 'Uno de los productos del checkout no existe')
  }

  const normalizedItems = normalizedItemsInput.map((item) => {
    const product = productMap.get(item.productId)

    if (!product) {
      throw createHttpError(404, 'Uno de los productos del checkout no existe')
    }

    let unitPrice = Number(product.offerPrice || 0)
    let variantLabel = item.variantLabel
    let decantSizeId = null

    if (item.decantSizeId) {
      const decantPrice = (Array.isArray(product.decantPrices) ? product.decantPrices : []).find(
        (entry) => String(entry.sizeId) === item.decantSizeId,
      )

      if (!decantPrice || Number(decantPrice.price || 0) <= 0) {
        throw createHttpError(400, `El decant seleccionado para ${product.name} ya no está disponible`)
      }

      unitPrice = Number(decantPrice.price || 0)
      decantSizeId = decantPrice.sizeId
    }

    return {
      product: product._id,
      productId: String(product._id),
      name: product.name,
      variantLabel,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      decantSizeId,
      hasFreeShipping: productHasFreeShipping(product),
    }
  })

  let resolvedCoupon = null
  let eligibleProductIds = []

  if (coupon?.name?.trim()) {
    const couponResolution = await resolveCouponForCart({
      couponName: coupon.name.trim(),
      productIds: normalizedItems.map((item) => item.productId),
    })

    resolvedCoupon = couponResolution.coupon
    eligibleProductIds = couponResolution.eligibleProductIds
  }

  const couponPricing = buildCartCouponPricing({
    items: normalizedItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    coupon: resolvedCoupon,
    eligibleProductIds,
  })

  const shippingAmount = normalizedItems.some((item) => item.hasFreeShipping) ? 0 : Number(shippingZone.price || 0)
  const surchargeAmount = paymentMethod === 'cash_on_delivery' ? 0 : 0
  const totalAmount = couponPricing.totalAmount + shippingAmount + surchargeAmount
  const partner = resolvedCoupon?._id ? await findPartnerByCouponId(resolvedCoupon._id) : null
  const partnerSaleData = buildPartnerSaleData({
    partner,
    coupon: {
      ...resolvedCoupon,
      totalAmount,
    },
  })

  return {
    customer: normalizedCustomer,
    items: normalizedItems.map(({ hasFreeShipping, productId, ...item }) => item),
    shippingZone: {
      id: shippingZone.id,
      place: shippingZone.place.trim(),
      price: shippingAmount,
      eta: shippingZone.eta?.trim() || '',
    },
    coupon: resolvedCoupon,
    eligibleProductIds,
    subtotalAmount: couponPricing.subtotalAmount,
    discountAmount: couponPricing.discountAmount,
    discountedSubtotalAmount: couponPricing.totalAmount,
    shippingAmount,
    surchargeAmount,
    totalAmount,
    partnerSaleData,
  }
}

async function upsertCheckoutCustomer({ session, paymentMethod, totalAmount }) {
  const customerAddress = [session.customer.address?.trim(), session.customer.neighborhood?.trim()]
    .filter(Boolean)
    .join(', ')

  const customerNotes = [
    `Checkout: ${session.reference}`,
    session.customer.documentType && session.customer.documentNumber
      ? `Documento: ${session.customer.documentType} ${session.customer.documentNumber}`
      : null,
    session.customer.state ? `Departamento: ${session.customer.state}` : null,
    session.shippingZone?.place ? `Envío: ${session.shippingZone.place}` : null,
    paymentMethod ? `Pago: ${paymentMethod}` : null,
    session.coupon?.name ? `Cupón: ${session.coupon.name}` : null,
    `Total checkout: ${formatCurrency(totalAmount)}`,
  ]
    .filter(Boolean)
    .join('\n')

  return Customer.findOneAndUpdate(
    { email: session.customer.email },
    {
      $set: {
        firstName: session.customer.firstName,
        lastName: session.customer.lastName,
        phone: session.customer.phone,
        phoneCountryCode: session.customer.phoneCountryCode,
        email: session.customer.email,
        city: session.customer.city,
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
}

async function finalizeApprovedCheckoutSession(session) {
  const existingOrder = session.order
    ? await Order.findById(session.order)
    : await Order.findOne({ reference: session.reference })

  if (existingOrder) {
    if (!session.order) {
      session.order = existingOrder._id
      session.status = 'approved'
      session.approvedAt = session.approvedAt || new Date()
      await session.save()
    }

    return existingOrder
  }

  const partner = session.coupon?.id ? await findPartnerByCouponId(session.coupon.id) : null
  const partnerSaleData = buildPartnerSaleData({
    partner,
    coupon: {
      _id: session.coupon?.id || null,
      name: session.coupon?.name || '',
      totalAmount: Number(session.totalAmount || 0),
    },
  })

  const customer = await upsertCheckoutCustomer({
    session,
    paymentMethod: 'Pago en línea confirmado',
    totalAmount: Number(session.totalAmount || 0),
  })

  const order = await Order.create({
    reference: session.reference,
    customer: customer._id,
    product: session.items.length === 1 ? session.items[0].product || null : null,
    items: session.items.map((item) => ({
      product: item.product || null,
      name: item.name,
      variantLabel: item.variantLabel || '',
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      lineTotal: Number(item.lineTotal || 0),
    })),
    coupon: session.coupon?.id || null,
    couponName: session.coupon?.name || '',
    partner: partnerSaleData.partner,
    partnerCouponName: partnerSaleData.partnerCouponName,
    partnerCommissionAmount: partnerSaleData.partnerCommissionAmount,
    discountType: '',
    discountValue: 0,
    subtotalAmount: Number(session.subtotalAmount || 0),
    discountAmount: Number(session.discountAmount || 0),
    totalAmount: Number(session.totalAmount || 0),
    paymentMethod: 'online',
    shippingPlace: session.shippingZone?.place || '',
    shippingPrice: Number(session.shippingAmount || 0),
    shippingEta: session.shippingZone?.eta || '',
    status: 'preparing',
  })

  try {
    await sendBrevoEmail({
      to: {
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`,
      },
      subject: 'Tu pedido en Saval Fragance está siendo preparado',
      htmlContent: buildOrderPlacedEmail({
        customerName: customer.firstName,
        orderReference: order.reference,
        items: order.items,
        totalAmount: order.totalAmount,
        shippingPlace: order.shippingPlace,
      }),
    })
  } catch (error) {
    console.error('Order placed email failed after Wompi approval', error)
  }

  if (partnerSaleData.partner) {
    try {
      await notifyPartnerSale({
        partnerId: partnerSaleData.partner,
        order,
        customer,
      })
    } catch (error) {
      console.error('Partner sale email failed after Wompi approval', error)
    }
  }

  session.order = order._id
  session.status = 'approved'
  session.approvedAt = session.approvedAt || new Date()
  await session.save()

  return order
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
  '/checkout/online/session',
  asyncHandler(async (request, response) => {
    const wompiPublicKey = process.env.WOMPI_PUBLIC_KEY?.trim()
    const wompiIntegritySecret = process.env.WOMPI_INTEGRITY_SECRET?.trim()

    if (!wompiPublicKey || !wompiIntegritySecret) {
      throw createHttpError(500, 'Wompi no está configurado en el servidor')
    }

    const reference = createCheckoutReference()
    const checkoutContext = await buildCheckoutContext({
      customer: request.body.customer || {},
      items: request.body.items,
      shippingZone: request.body.shippingZone,
      coupon: request.body.coupon,
      paymentMethod: 'online',
    })
    const redirectUrl = `${getStorefrontBaseUrl()}/checkout/resultado?reference=${encodeURIComponent(reference)}`
    const amountInCents = Math.round(Number(checkoutContext.totalAmount || 0) * 100)
    const integrity = createSha256Hash(`${reference}${amountInCents}COP${wompiIntegritySecret}`)
    const whatsappUrl = buildCheckoutWhatsAppLink({
      reference,
      customer: checkoutContext.customer,
      items: checkoutContext.items,
      shippingZone: checkoutContext.shippingZone,
      subtotalAmount: checkoutContext.subtotalAmount,
      discountAmount: checkoutContext.discountAmount,
      totalAmount: checkoutContext.totalAmount,
      paymentMethod: 'online',
    })

    await CheckoutSession.findOneAndUpdate(
      { reference },
      {
        $set: {
          reference,
          status: 'pending',
          paymentProvider: 'wompi',
          paymentMethod: 'online',
          customer: checkoutContext.customer,
          items: checkoutContext.items,
          shippingZone: checkoutContext.shippingZone,
          coupon: checkoutContext.coupon
            ? {
                id: checkoutContext.coupon._id,
                name: checkoutContext.coupon.name,
                discountAmount: checkoutContext.discountAmount,
                eligibleProductIds: checkoutContext.eligibleProductIds,
              }
            : {
                id: null,
                name: '',
                discountAmount: 0,
                eligibleProductIds: [],
              },
          subtotalAmount: checkoutContext.subtotalAmount,
          discountAmount: checkoutContext.discountAmount,
          shippingAmount: checkoutContext.shippingAmount,
          surchargeAmount: checkoutContext.surchargeAmount,
          totalAmount: checkoutContext.totalAmount,
          whatsappUrl,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )

    response.status(201).json({
      reference,
      redirectUrl,
      amountInCents,
      wompi: {
        publicKey: wompiPublicKey,
        currency: 'COP',
        amountInCents,
        reference,
        redirectUrl,
        signature: {
          integrity,
        },
        customerData: {
          email: checkoutContext.customer.email,
          fullName: `${checkoutContext.customer.firstName} ${checkoutContext.customer.lastName}`.trim(),
          phoneNumber: checkoutContext.customer.phone,
          phoneNumberPrefix: checkoutContext.customer.phoneCountryCode,
          legalId: checkoutContext.customer.documentNumber,
          legalIdType: normalizeWompiLegalIdType(checkoutContext.customer.documentType),
        },
        shippingAddress: {
          addressLine1: checkoutContext.customer.address,
          addressLine2: checkoutContext.customer.neighborhood,
          country: 'CO',
          city: checkoutContext.customer.city,
          region: checkoutContext.customer.state,
          phoneNumber: normalizePhoneNumber(checkoutContext.customer.phoneCountryCode, checkoutContext.customer.phone),
          name: `${checkoutContext.customer.firstName} ${checkoutContext.customer.lastName}`.trim(),
        },
      },
    })
  }),
)

router.get(
  '/checkout/online/session/:reference',
  asyncHandler(async (request, response) => {
    const session = await CheckoutSession.findOne({ reference: request.params.reference })
      .populate('order', 'reference totalAmount status')
      .lean()

    if (!session) {
      throw createHttpError(404, 'No se encontró la sesión de pago')
    }

    response.json({
      reference: session.reference,
      status: session.status,
      transactionStatus: session.wompiStatus || '',
      transactionId: session.wompiTransactionId || '',
      whatsappUrl: session.whatsappUrl || '',
      orderReference: session.order?.reference || session.reference,
      totalAmount: Number(session.totalAmount || 0),
      approvedAt: session.approvedAt || null,
      failedAt: session.failedAt || null,
    })
  }),
)

router.post(
  '/checkout/online/wompi/events',
  asyncHandler(async (request, response) => {
    const eventPayload = request.body || {}

    if (eventPayload.event !== 'transaction.updated') {
      response.status(200).json({ ok: true })
      return
    }

    if (!verifyWompiEventSignature(eventPayload)) {
      console.warn('Invalid Wompi event signature')
      response.status(200).json({ ok: true })
      return
    }

    const transaction = eventPayload.data?.transaction
    const reference = transaction?.reference?.trim()

    if (!reference) {
      response.status(200).json({ ok: true })
      return
    }

    const session = await CheckoutSession.findOne({ reference })

    if (!session) {
      response.status(200).json({ ok: true })
      return
    }

    session.wompiTransactionId = transaction.id || session.wompiTransactionId
    session.wompiStatus = transaction.status || session.wompiStatus
    session.wompiPaymentMethodType = transaction.payment_method_type || session.wompiPaymentMethodType
    session.wompiEventAt = eventPayload.sent_at ? new Date(eventPayload.sent_at) : new Date()

    const mappedStatus = mapWompiStatus(transaction.status)

    if (mappedStatus === 'approved') {
      await finalizeApprovedCheckoutSession(session)
    } else if (!session.order) {
      session.status = mappedStatus
      session.failedAt = mappedStatus === 'pending' ? null : new Date()
      await session.save()
    } else {
      await session.save()
    }

    response.status(200).json({ ok: true })
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