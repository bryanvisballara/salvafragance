function shellTemplate({ title, heading, intro, accent, body }) {
  return `
    <div style="margin:0;background:#0b0b0d;padding:32px 16px;font-family:Arial,sans-serif;color:#f6efe5;">
      <div style="max-width:640px;margin:0 auto;background:linear-gradient(180deg,#17120d 0%,#0d0c0a 100%);border:1px solid rgba(233,198,128,0.22);border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.35);">
        <div style="padding:32px 32px 18px;background:radial-gradient(circle at top, rgba(214,170,84,0.22), transparent 36%);">
          <div style="display:inline-block;padding:8px 12px;border:1px solid rgba(233,198,128,0.28);border-radius:999px;color:#f1d08f;letter-spacing:0.2em;font-size:11px;text-transform:uppercase;">Saval Fragance</div>
          <h1 style="margin:18px 0 10px;font-size:36px;line-height:1;color:#fff7ea;font-family:Georgia,serif;">${heading}</h1>
          <p style="margin:0;color:#c8b89b;font-size:16px;line-height:1.6;">${intro}</p>
        </div>
        <div style="padding:8px 32px 32px;">
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(233,198,128,0.14);border-radius:22px;padding:22px;">
            ${body}
          </div>
          <div style="margin-top:24px;padding:18px 20px;border-radius:20px;background:${accent};color:#140f06;font-weight:700;text-align:center;">
            ${title}
          </div>
          <p style="margin:22px 0 0;color:#a9997d;font-size:13px;line-height:1.6;">Este correo fue enviado por orders@savalfragance.com</p>
        </div>
      </div>
    </div>
  `
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildOrderPlacedEmail({ customerName, productName }) {
  return shellTemplate({
    title: 'Tu pedido está siendo preparado',
    heading: `Gracias por elegir Saval Fragance, ${customerName}`,
    intro: 'Recibimos tu compra correctamente y nuestro equipo ya está preparando tu fragancia con el mayor cuidado.',
    accent: 'linear-gradient(135deg,#f3d393,#bf8b32)',
    body: `
      <p style="margin:0 0 14px;color:#efe7da;line-height:1.7;">Tu pedido para <strong>${productName}</strong> ha sido registrado. Muy pronto recibirás un nuevo correo con el número de guía para hacer seguimiento a tu envío.</p>
      <p style="margin:0;color:#c8b89b;line-height:1.7;">Gracias por confiar en una selección pensada para hacerte sentir distinto desde el primer acorde.</p>
    `,
  })
}

export function buildTrackingEmail({ customerName, productName, shippingCarrier, trackingNumber }) {
  return shellTemplate({
    title: `Guía ${trackingNumber}`,
    heading: 'Tu pedido ya va en camino',
    intro: `Hola ${customerName}, tu pedido de ${productName} ya fue despachado y aquí tienes los datos de seguimiento.`,
    accent: 'linear-gradient(135deg,#d7efff,#7db8ff)',
    body: `
      <div style="display:grid;gap:14px;">
        <div style="padding:16px;border-radius:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(233,198,128,0.14);">
          <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#d9bc84;">Transportadora</div>
          <div style="margin-top:6px;font-size:24px;color:#fff7ea;font-weight:700;">${shippingCarrier}</div>
        </div>
        <div style="padding:16px;border-radius:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(233,198,128,0.14);">
          <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#d9bc84;">Número de seguimiento</div>
          <div style="margin-top:6px;font-size:24px;color:#fff7ea;font-weight:700;">${trackingNumber}</div>
        </div>
      </div>
    `,
  })
}

export function buildAdminOrderNotificationEmail({
  reference,
  customer,
  items,
  shippingZone,
  coupon,
  baseSubtotalAmount,
  discountAmount,
  totalAmount,
}) {
  const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
  const itemsMarkup = items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;color:#efe7da;vertical-align:top;">
            <strong>${escapeHtml(item.name)}</strong><br />
            <span style="color:#c8b89b;font-size:13px;">${item.quantity} x ${escapeHtml(item.unitPriceLabel)}</span>
          </td>
          <td style="padding:12px 0;color:#fff7ea;text-align:right;vertical-align:top;font-weight:700;">${escapeHtml(item.lineTotalLabel)}</td>
        </tr>
      `,
    )
    .join('')

  const couponMarkup = coupon
    ? `<p style="margin:0;color:#efe7da;line-height:1.7;"><strong>Cupón:</strong> ${escapeHtml(coupon.name)} (${escapeHtml(coupon.discountAmountLabel)})</p>`
    : '<p style="margin:0;color:#c8b89b;line-height:1.7;">No se aplicó cupón.</p>'

  return shellTemplate({
    title: `Orden ${escapeHtml(reference)}`,
    heading: 'Nueva orden recibida',
    intro: 'Un cliente completó el checkout y fue enviado a la pasarela de pagos. Revisa los datos de esta orden.',
    accent: 'linear-gradient(135deg,#f3d393,#bf8b32)',
    body: `
      <div style="display:grid;gap:18px;">
        <div style="display:grid;gap:8px;">
          <p style="margin:0;color:#efe7da;line-height:1.7;"><strong>Referencia:</strong> ${escapeHtml(reference)}</p>
          <p style="margin:0;color:#efe7da;line-height:1.7;"><strong>Cliente:</strong> ${escapeHtml(customerName)}</p>
          <p style="margin:0;color:#efe7da;line-height:1.7;"><strong>Correo:</strong> ${escapeHtml(customer.email)}</p>
          <p style="margin:0;color:#efe7da;line-height:1.7;"><strong>Teléfono:</strong> ${escapeHtml(customer.phone)}</p>
          <p style="margin:0;color:#efe7da;line-height:1.7;"><strong>Documento:</strong> ${escapeHtml(customer.documentType)} ${escapeHtml(customer.documentNumber)}</p>
          <p style="margin:0;color:#efe7da;line-height:1.7;"><strong>Dirección:</strong> ${escapeHtml(customer.address)}, ${escapeHtml(customer.neighborhood)}, ${escapeHtml(customer.city)}, ${escapeHtml(customer.state)}</p>
        </div>
        <div style="padding:16px;border-radius:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(233,198,128,0.14);">
          <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#d9bc84;margin-bottom:8px;">Productos</div>
          <table style="width:100%;border-collapse:collapse;">
            <tbody>${itemsMarkup}</tbody>
          </table>
        </div>
        <div style="display:grid;gap:8px;">
          <p style="margin:0;color:#efe7da;line-height:1.7;"><strong>Subtotal base:</strong> ${escapeHtml(baseSubtotalAmount)}</p>
          <p style="margin:0;color:#efe7da;line-height:1.7;"><strong>Descuento aplicado:</strong> ${escapeHtml(discountAmount)}</p>
          <p style="margin:0;color:#efe7da;line-height:1.7;"><strong>Envío:</strong> ${escapeHtml(shippingZone.place)} (${escapeHtml(shippingZone.priceLabel)})</p>
          ${couponMarkup}
          <p style="margin:0;color:#fff7ea;line-height:1.7;font-size:18px;"><strong>Total:</strong> ${escapeHtml(totalAmount)}</p>
        </div>
      </div>
    `,
  })
}