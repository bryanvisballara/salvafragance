function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function shellTemplate({ title, heading, intro, accent, body }) {
  return `
    <div style="margin:0;background:#f4efe6;padding:32px 16px;font-family:Arial,sans-serif;color:#24180f;">
      <div style="max-width:640px;margin:0 auto;background:#fffdf9;border:1px solid #e7d7bc;border-radius:28px;overflow:hidden;box-shadow:0 20px 50px rgba(43,26,14,0.12);">
        <div style="padding:32px 32px 18px;background:linear-gradient(180deg,#fff8ef 0%,#f8efe2 100%);border-bottom:1px solid #efe1c9;">
          <div style="display:inline-block;padding:8px 12px;border:1px solid #d8ba7f;border-radius:999px;color:#8a6420;letter-spacing:0.2em;font-size:11px;text-transform:uppercase;font-weight:700;">Saval Fragance</div>
          <h1 style="margin:18px 0 10px;font-size:36px;line-height:1;color:#000000 !important;font-family:Georgia,serif;">${heading}</h1>
          <p style="margin:0;color:#000000 !important;font-size:16px;line-height:1.6;">${intro}</p>
        </div>
        <div style="padding:8px 32px 32px;">
          <div style="background:#fffbf4;border:1px solid #ecdfc8;border-radius:22px;padding:22px;color:#24180f;">
            ${body}
          </div>
          <div style="margin-top:24px;padding:18px 20px;border-radius:20px;background:${accent};color:#140f06;font-weight:700;text-align:center;">
            ${title}
          </div>
          <p style="margin:22px 0 0;color:#6d5943;font-size:13px;line-height:1.6;">Este correo fue enviado por orders@savalfragance.com</p>
        </div>
      </div>
    </div>
  `
}

function buildOrderItemsMarkup(items) {
  return (items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;color:#24180f;vertical-align:top;">
            <strong>${escapeHtml(item.name)}</strong>${item.variantLabel ? `<br /><span style="color:#6d5943;font-size:13px;">${escapeHtml(item.variantLabel)}</span>` : ''}<br />
            <span style="color:#6d5943;font-size:13px;">${item.quantity} x ${escapeHtml(formatCurrency(item.unitPrice))}</span>
          </td>
          <td style="padding:12px 0;color:#2d1c10;text-align:right;vertical-align:top;font-weight:700;">${escapeHtml(formatCurrency(item.lineTotal))}</td>
        </tr>
      `,
    )
    .join('')
}

function buildOrderSummaryCard({ items, totalAmount, shippingPlace, shippingPrice, extraLine }) {
  return `
    <div style="display:grid;gap:18px;">
      <div style="padding:18px;border-radius:20px;background:#fff7ea;border:1px solid #ecdfc8;">
        <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6420;margin-bottom:8px;">Detalle del pedido</div>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${buildOrderItemsMarkup(items)}</tbody>
        </table>
      </div>
      <div style="display:grid;gap:8px;">
        ${shippingPlace ? `<p style="margin:0;color:#24180f;line-height:1.7;"><strong>Destino:</strong> ${escapeHtml(shippingPlace)}${shippingPrice ? ` (${escapeHtml(formatCurrency(shippingPrice))})` : ''}</p>` : ''}
        ${extraLine || ''}
        <p style="margin:0;color:#2d1c10;line-height:1.7;font-size:18px;"><strong>Total:</strong> ${escapeHtml(formatCurrency(totalAmount))}</p>
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

export function buildOrderPlacedEmail({ customerName, orderReference, items, totalAmount, shippingPlace }) {
  return shellTemplate({
    title: 'Tu pedido está siendo preparado',
    heading: `Gracias por elegir Saval Fragance, ${customerName}`,
    intro: 'Tu orden fue confirmada correctamente y nuestro equipo ya la está preparando con el cuidado y detalle que merece.',
    accent: 'linear-gradient(135deg,#f3d393,#bf8b32)',
    body: `
      <p style="margin:0 0 14px;color:#24180f;line-height:1.7;">${orderReference ? `La orden <strong>${escapeHtml(orderReference)}</strong> fue registrada correctamente.` : 'Tu compra fue registrada correctamente.'} Muy pronto recibirás un nuevo correo con la guía de seguimiento.</p>
      ${buildOrderSummaryCard({ items, totalAmount, shippingPlace })}
      <p style="margin:14px 0 0;color:#6d5943;line-height:1.7;">Gracias por confiar en una selección pensada para hacerte sentir distinto desde el primer acorde.</p>
    `,
  })
}

export function buildTrackingEmail({ customerName, orderReference, items, totalAmount, shippingPlace, shippingCarrier, trackingNumber }) {
  return shellTemplate({
    title: `Guía ${trackingNumber}`,
    heading: 'Tu pedido ya va en camino',
    intro: `Hola ${customerName}, ${orderReference ? `tu orden ${escapeHtml(orderReference)}` : 'tu pedido'} ya fue despachado y aquí tienes los datos de seguimiento.`,
    accent: 'linear-gradient(135deg,#d7efff,#7db8ff)',
    body: `
      <div style="display:grid;gap:14px;">
        <div style="padding:16px;border-radius:18px;background:#fff7ea;border:1px solid #ecdfc8;">
          <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6420;">Transportadora</div>
          <div style="margin-top:6px;font-size:24px;color:#24180f;font-weight:700;">${shippingCarrier}</div>
        </div>
        <div style="padding:16px;border-radius:18px;background:#fff7ea;border:1px solid #ecdfc8;">
          <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6420;">Número de seguimiento</div>
          <div style="margin-top:6px;font-size:24px;color:#24180f;font-weight:700;">${trackingNumber}</div>
        </div>
        ${buildOrderSummaryCard({
          items,
          totalAmount,
          shippingPlace,
          extraLine: `<p style="margin:0;color:#24180f;line-height:1.7;"><strong>Transportadora:</strong> ${escapeHtml(shippingCarrier)} · <strong>Guía:</strong> ${escapeHtml(trackingNumber)}</p>`,
        })}
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
          <td style="padding:12px 0;color:#24180f;vertical-align:top;">
            <strong>${escapeHtml(item.name)}</strong><br />
            <span style="color:#6d5943;font-size:13px;">${item.quantity} x ${escapeHtml(item.unitPriceLabel)}</span>
          </td>
          <td style="padding:12px 0;color:#2d1c10;text-align:right;vertical-align:top;font-weight:700;">${escapeHtml(item.lineTotalLabel)}</td>
        </tr>
      `,
    )
    .join('')

  const couponMarkup = coupon
    ? `<p style="margin:0;color:#24180f;line-height:1.7;"><strong>Cupón:</strong> ${escapeHtml(coupon.name)} (${escapeHtml(coupon.discountAmountLabel)})</p>`
    : '<p style="margin:0;color:#6d5943;line-height:1.7;">No se aplicó cupón.</p>'

  return shellTemplate({
    title: `Orden ${escapeHtml(reference)}`,
    heading: 'Nueva orden recibida',
    intro: 'Un cliente completó el checkout y fue enviado a la pasarela de pagos. Revisa los datos de esta orden.',
    accent: 'linear-gradient(135deg,#f3d393,#bf8b32)',
    body: `
      <div style="display:grid;gap:18px;">
        <div style="display:grid;gap:8px;">
          <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Referencia:</strong> ${escapeHtml(reference)}</p>
          <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Cliente:</strong> ${escapeHtml(customerName)}</p>
          <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Correo:</strong> ${escapeHtml(customer.email)}</p>
          <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Teléfono:</strong> ${escapeHtml(customer.phone)}</p>
          <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Documento:</strong> ${escapeHtml(customer.documentType)} ${escapeHtml(customer.documentNumber)}</p>
          <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Dirección:</strong> ${escapeHtml(customer.address)}, ${escapeHtml(customer.neighborhood)}, ${escapeHtml(customer.city)}, ${escapeHtml(customer.state)}</p>
        </div>
        <div style="padding:16px;border-radius:18px;background:#fff7ea;border:1px solid #ecdfc8;">
          <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6420;margin-bottom:8px;">Productos</div>
          <table style="width:100%;border-collapse:collapse;">
            <tbody>${itemsMarkup}</tbody>
          </table>
        </div>
        <div style="display:grid;gap:8px;">
          <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Subtotal base:</strong> ${escapeHtml(baseSubtotalAmount)}</p>
          <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Descuento aplicado:</strong> ${escapeHtml(discountAmount)}</p>
          <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Envío:</strong> ${escapeHtml(shippingZone.place)} (${escapeHtml(shippingZone.priceLabel)})</p>
          ${couponMarkup}
          <p style="margin:0;color:#2d1c10;line-height:1.7;font-size:18px;"><strong>Total:</strong> ${escapeHtml(totalAmount)}</p>
        </div>
      </div>
    `,
  })
}

export function buildPartnerSaleEmail({
  partnerName,
  orderReference,
  couponName,
  customerName,
  totalAmount,
  commissionAmount,
}) {
  return shellTemplate({
    title: `Venta registrada con ${escapeHtml(couponName)}`,
    heading: `Hola ${escapeHtml(partnerName || 'socio')}`,
    intro: 'Se registró una nueva venta usando tu cupón y ya quedó abonada en tu panel.',
    accent: 'linear-gradient(135deg,#d7efff,#7db8ff)',
    body: `
      <div style="display:grid;gap:14px;">
        <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Referencia:</strong> ${escapeHtml(orderReference)}</p>
        <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Cliente:</strong> ${escapeHtml(customerName)}</p>
        <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Cupón:</strong> ${escapeHtml(couponName)}</p>
        <p style="margin:0;color:#24180f;line-height:1.7;"><strong>Total de la venta:</strong> ${escapeHtml(formatCurrency(totalAmount))}</p>
        <p style="margin:0;color:#2d1c10;line-height:1.7;font-size:18px;"><strong>Comisión generada:</strong> ${escapeHtml(formatCurrency(commissionAmount))}</p>
      </div>
    `,
  })
}