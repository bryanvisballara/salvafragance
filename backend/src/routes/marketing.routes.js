import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { sendBrevoEmail } from '../lib/brevo.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import Customer from '../models/Customer.js'

const router = Router()

router.use(requireAuth)

function buildMarketingEmail({ subject, message, customerName }) {
  const body = String(message || '').trim().replaceAll('\n', '<br />')

  return `
    <div style="margin:0;background:#0b0b0d;padding:32px 16px;font-family:Arial,sans-serif;color:#f6efe5;">
      <div style="max-width:640px;margin:0 auto;background:linear-gradient(180deg,#17120d 0%,#0d0c0a 100%);border:1px solid rgba(233,198,128,0.22);border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.35);">
        <div style="padding:32px;background:radial-gradient(circle at top, rgba(214,170,84,0.22), transparent 36%);">
          <div style="display:inline-block;padding:8px 12px;border:1px solid rgba(233,198,128,0.28);border-radius:999px;color:#f1d08f;letter-spacing:0.2em;font-size:11px;text-transform:uppercase;">Saval Fragance</div>
          <h1 style="margin:18px 0 10px;font-size:34px;line-height:1;color:#fff7ea;font-family:Georgia,serif;">${subject}</h1>
          <p style="margin:0;color:#c8b89b;font-size:16px;line-height:1.6;">Hola ${customerName},</p>
        </div>
        <div style="padding:0 32px 32px;">
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(233,198,128,0.14);border-radius:22px;padding:22px;color:#efe7da;line-height:1.7;">${body}</div>
          <p style="margin:22px 0 0;color:#a9997d;font-size:13px;line-height:1.6;">Mensaje promocional enviado por Saval Fragance.</p>
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