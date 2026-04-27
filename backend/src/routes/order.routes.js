import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { sendBrevoEmail } from '../lib/brevo.js'
import { buildTrackingEmail } from '../lib/email-templates.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import Order from '../models/Order.js'

const router = Router()

router.use(requireAuth, requireRole('admin', 'operator'))

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    const orders = await Order.find()
      .populate('customer')
      .populate('product', 'name')
      .populate('items.product', 'name')
      .populate('coupon', 'name discountType discountValue')
      .sort({ createdAt: -1 })
      .lean()

    response.json(orders)
  }),
)

router.put(
  '/:id/tracking',
  asyncHandler(async (request, response) => {
    const shippingCarrier = request.body.shippingCarrier?.trim()
    const trackingNumber = request.body.trackingNumber?.trim()

    if (!shippingCarrier || !trackingNumber) {
      throw createHttpError(400, 'Shipping carrier and tracking number are required')
    }

    const order = await Order.findById(request.params.id)
      .populate('customer')
      .populate('product', 'name')
      .populate('items.product', 'name')

    if (!order) {
      throw createHttpError(404, 'Order not found')
    }

    order.shippingCarrier = shippingCarrier
    order.trackingNumber = trackingNumber
    order.status = 'shipped'
    order.trackingSentAt = new Date()
    await order.save()

    let emailDelivery = {
      sent: false,
      skipped: false,
      error: '',
    }

    try {
      const delivery = await sendBrevoEmail({
        to: {
          email: order.customer.email,
          name: `${order.customer.firstName} ${order.customer.lastName}`,
        },
        subject: `Tu guía de envío para ${order.product.name}`,
        htmlContent: buildTrackingEmail({
          customerName: order.customer.firstName,
          orderReference: order.reference,
          items: order.items?.length
            ? order.items
            : [
                {
                  name: order.product?.name || 'Pedido Saval Fragance',
                  variantLabel: '',
                  quantity: 1,
                  unitPrice: order.totalAmount,
                  lineTotal: order.totalAmount,
                },
              ],
          totalAmount: order.totalAmount,
          shippingPlace: order.shippingPlace,
          shippingCarrier,
          trackingNumber,
        }),
      })

      emailDelivery = {
        sent: !delivery?.skipped,
        skipped: Boolean(delivery?.skipped),
        error: '',
      }
    } catch (error) {
      console.error('Tracking email failed', error)

      emailDelivery = {
        sent: false,
        skipped: false,
        error: error.message,
      }
    }

    const updatedOrder = await Order.findById(order.id)
        .populate('customer')
        .populate('product', 'name')
        .populate('items.product', 'name')
        .populate('coupon', 'name discountType discountValue')
        .lean()

    response.json({
      order: updatedOrder,
      emailDelivery,
    })
  }),
)

export default router