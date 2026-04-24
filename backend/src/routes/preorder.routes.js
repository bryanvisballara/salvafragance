import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { sendBrevoEmail } from '../lib/brevo.js'
import { buildOrderPlacedEmail } from '../lib/email-templates.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import Order from '../models/Order.js'
import PreOrder from '../models/PreOrder.js'

const router = Router()

router.use(requireAuth)

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    const preOrders = await PreOrder.find()
      .populate('customer')
      .populate('items.product', 'name')
      .sort({ createdAt: -1 })
      .lean()

    response.json(preOrders)
  }),
)

router.post(
  '/:id/confirm',
  asyncHandler(async (request, response) => {
    const preOrder = await PreOrder.findById(request.params.id)
      .populate('customer')
      .populate('items.product', 'name')

    if (!preOrder) {
      throw createHttpError(404, 'Preorder not found')
    }

    const order = await Order.create({
      reference: preOrder.reference,
      customer: preOrder.customer._id,
      product: preOrder.items.length === 1 ? preOrder.items[0].product || null : null,
      items: preOrder.items.map((item) => ({
        product: item.product?._id || item.product || null,
        name: item.name,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      couponName: preOrder.couponName,
      subtotalAmount: preOrder.subtotalAmount,
      discountAmount: preOrder.discountAmount,
      totalAmount: preOrder.totalAmount,
      paymentMethod: preOrder.paymentMethod,
      shippingPlace: preOrder.shippingPlace,
      shippingPrice: preOrder.shippingPrice,
      shippingEta: preOrder.shippingEta,
      status: 'preparing',
    })

    try {
      await sendBrevoEmail({
        to: {
          email: preOrder.customer.email,
          name: `${preOrder.customer.firstName} ${preOrder.customer.lastName}`,
        },
        subject: 'Tu pedido en Saval Fragance está siendo preparado',
        htmlContent: buildOrderPlacedEmail({
          customerName: preOrder.customer.firstName,
          orderReference: preOrder.reference,
          items: preOrder.items,
          totalAmount: preOrder.totalAmount,
          shippingPlace: preOrder.shippingPlace,
        }),
      })
    } catch (error) {
      console.error('Preorder confirmation email failed', error)
    }

    await PreOrder.findByIdAndDelete(preOrder._id)

    response.status(201).json(
      await Order.findById(order._id)
        .populate('customer')
        .populate('product', 'name')
        .populate('items.product', 'name')
        .populate('coupon', 'name discountType discountValue')
        .lean(),
    )
  }),
)

export default router