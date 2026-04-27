import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { sendBrevoEmail } from '../lib/brevo.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import Customer from '../models/Customer.js'

const router = Router()

router.use(requireAuth, requireRole('admin', 'operator'))

function buildMarketingEmail({ subject, message, customerName }) {
  const body = String(message || '').trim().replaceAll('\n', '<br />')

  return `
    <div style="margin:0;background:#f4efe6;padding:32px 16px;font-family:Arial,sans-serif;color:#24180f;">
      <div style="max-width:640px;margin:0 auto;background:#fffdf9;border:1px solid #e7d7bc;border-radius:28px;overflow:hidden;box-shadow:0 20px 50px rgba(43,26,14,0.12);">
        <div style="padding:32px;background:linear-gradient(180deg,#fff8ef 0%,#f8efe2 100%);border-bottom:1px solid #efe1c9;">
          <div style="display:inline-block;padding:8px 12px;border:1px solid #d8ba7f;border-radius:999px;color:#8a6420;letter-spacing:0.2em;font-size:11px;text-transform:uppercase;font-weight:700;">Saval Fragance</div>
          <h1 style="margin:18px 0 10px;font-size:34px;line-height:1;color:#2d1c10;font-family:Georgia,serif;">${subject}</h1>
          <p style="margin:0;color:#5f4a35;font-size:16px;line-height:1.6;">Hola ${customerName},</p>
        </div>
        <div style="padding:0 32px 32px;">
          <div style="background:#fffbf4;border:1px solid #ecdfc8;border-radius:22px;padding:22px;color:#24180f;line-height:1.7;">
            <div style="color:#24180f;">${body}</div>
          </div>
          <p style="margin:22px 0 0;color:#6d5943;font-size:13px;line-height:1.6;">Mensaje promocional enviado por Saval Fragance.</p>
        </div>
      </div>
    </div>
  `
}

router.post(
  '/email',
  asyncHandler(async (request, response) => {
    const customerIds = Array.isArray(request.body.customerIds) ? request.body.customerIds : []
    const subject = request.body.subject?.trim()
    const message = request.body.message?.trim()

    if (!customerIds.length || !subject || !message) {
      throw createHttpError(400, 'Clientes, asunto y mensaje son obligatorios')
    }

    const customers = await Customer.find({ _id: { $in: customerIds } }).lean()

    if (!customers.length) {
      throw createHttpError(404, 'No se encontraron clientes para el envío')
    }

    const results = await Promise.all(
      customers.map(async (customer) => {
        try {
          const delivery = await sendBrevoEmail({
            to: {
              email: customer.email,
              name: `${customer.firstName} ${customer.lastName}`,
            },
            subject,
            htmlContent: buildMarketingEmail({
              subject,
              message,
              customerName: customer.firstName,
            }),
          })

          return {
            customerId: customer._id,
            email: customer.email,
            skipped: Boolean(delivery?.skipped),
          }
        } catch (error) {
          return {
            customerId: customer._id,
            email: customer.email,
            error: error.message,
          }
        }
      }),
    )

    const sentCount = results.filter((item) => !item.error && !item.skipped).length
    const skippedCount = results.filter((item) => item.skipped).length
    const failed = results.filter((item) => item.error)

    response.json({
      sentCount,
      skippedCount,
      failed,
    })
  }),
)

export default router