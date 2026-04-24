import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './App.css'

const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
const apiBaseUrl = import.meta.env.VITE_API_URL || (isLocalHost ? 'http://localhost:10000/api' : 'https://salvafragance.onrender.com/api')
const paymentGatewayUrl = import.meta.env.VITE_PAYMENT_GATEWAY_URL || ''
const brandLogoUrl = `${import.meta.env.BASE_URL}saval-logo.jpeg`
const whatsappPhoneNumber = '573001767364'
const defaultWhatsAppMessage = 'Hola, estoy interesado en comprar sus productos. ¿Podrías darme más información?'
const fallbackImage =
  'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=900&q=80'
const otherShippingOptionId = '__other__'
const phoneCountryOptions = ['+57', '+1', '+52', '+54', '+56', '+58', '+51', '+593', '+34']
const colombiaStates = [
  'Amazonas',
  'Antioquia',
  'Arauca',
  'Atlantico',
  'Bogota D.C.',
  'Bolivar',
  'Boyaca',
  'Caldas',
  'Caqueta',
  'Casanare',
  'Cauca',
  'Cesar',
  'Choco',
  'Cordoba',
  'Cundinamarca',
  'Guainia',
  'Guaviare',
  'Huila',
  'La Guajira',
  'Magdalena',
  'Meta',
  'Narino',
  'Norte de Santander',
  'Putumayo',
  'Quindio',
  'Risaralda',
  'San Andres y Providencia',
  'Santander',
  'Sucre',
  'Tolima',
  'Valle del Cauca',
  'Vaupes',
  'Vichada',
]

function buildWhatsAppUrl(message = defaultWhatsAppMessage) {
  return `https://wa.me/${whatsappPhoneNumber}?text=${encodeURIComponent(message)}`
}

function normalizePhoneNumber(countryCode, phone) {
  const normalizedCountryCode = String(countryCode || '+57').replace(/\D/g, '')
  const normalizedPhone = String(phone || '').replace(/\D/g, '')
  return `${normalizedCountryCode}${normalizedPhone}`
}

function formatCustomerPhone(countryCode, phone) {
  return `${countryCode || '+57'} ${String(phone || '').trim()}`.trim()
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function buildWhatsAppLink(productName) {
  return buildWhatsAppUrl(`Hola, estoy interesado en comprar ${productName}. ¿Podrías darme más información?`)
}

function buildCartWhatsAppLink(items, shippingZone = null) {
  const lines = items.map(
    (item) => `- ${item.displayName || item.product.name} x${item.quantity} (${formatCurrency(item.lineTotal)})`,
  )

  const subtotalAmount = items.reduce((total, item) => total + item.lineTotal, 0)
  const shippingAmount = Number(shippingZone?.price || 0)
  const shippingLine = shippingZone
    ? [`Envío (${shippingZone.place}): ${formatCurrency(shippingAmount)}`, `Total: ${formatCurrency(subtotalAmount + shippingAmount)}`]
    : []

  const message = [
    'Hola, estoy interesado en comprar estos productos de Saval Fragance:',
    ...lines,
    `Subtotal: ${formatCurrency(subtotalAmount)}`,
    ...shippingLine,
    '¿Podrías darme más información para finalizar la compra?',
  ].join('\n')

  return buildWhatsAppUrl(message)
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

function getCashOnDeliverySurcharge(baseTotalAmount, paymentMethod) {
  if (paymentMethod !== 'cash_on_delivery') {
    return 0
  }

  return baseTotalAmount * 0.05
}

function buildCheckoutWhatsAppLink(checkoutPayload, totalAmount) {
  const customerName = `${checkoutPayload.customer.firstName} ${checkoutPayload.customer.lastName}`.trim()
  const itemLines = checkoutPayload.items.map(
    (item) => `- ${item.name} x${item.quantity} (${formatCurrency(item.lineTotal)})`,
  )
  const paymentMethodLabel = getPaymentMethodLabel(checkoutPayload.paymentMethod)
  const discountLabel = checkoutPayload.discountAmount > 0
    ? `Descuento: ${formatCurrency(checkoutPayload.discountAmount)}`
    : 'Descuento: Sin descuento'
  const surchargeLabel = checkoutPayload.surchargeAmount > 0
    ? `Recargo contra entrega: ${formatCurrency(checkoutPayload.surchargeAmount)}`
    : null

  return buildWhatsAppUrl([
    `Hola, quiero confirmar mi pedido ${checkoutPayload.reference}.`,
    '',
    `Cliente: ${customerName}`,
    `Documento: ${checkoutPayload.customer.documentType} ${checkoutPayload.customer.documentNumber}`,
    `Teléfono: ${formatCustomerPhone(checkoutPayload.customer.phoneCountryCode, checkoutPayload.customer.phone)}`,
    `Correo: ${checkoutPayload.customer.email}`,
    `Dirección: ${checkoutPayload.customer.address}, ${checkoutPayload.customer.neighborhood}`,
    `Ciudad: ${checkoutPayload.customer.city}, ${checkoutPayload.customer.state}`,
    `Método de pago: ${paymentMethodLabel}`,
    '',
    'Productos:',
    ...itemLines,
    '',
    `Subtotal: ${formatCurrency(checkoutPayload.subtotalAmount)}`,
    discountLabel,
    `Envío (${checkoutPayload.shippingZone.place}): ${formatCurrency(checkoutPayload.shippingZone.price)}`,
    ...(surchargeLabel ? [surchargeLabel] : []),
    `Total: ${formatCurrency(totalAmount)}`,
  ].join('\n'))
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function getProductPath(product) {
  return `/producto/${slugify(product.name)}-${product._id}`
}

function getRouteProductId(pathname) {
  const match = pathname.match(/-([a-f0-9]{24})$/i)
  return match?.[1] || ''
}

function isFallbackShippingZone(zone) {
  return Boolean(zone?.isFallback) || String(zone?.place || '').trim().toLowerCase() === 'otra'
}

function getProductRatingData(product) {
  const ratingValue = Number(product?.rating)
  const reviewCountValue = Number(product?.reviewCount)

  return {
    rating: Number.isFinite(ratingValue) ? Math.max(0, Math.min(5, ratingValue)) : 0,
    reviews: Number.isInteger(reviewCountValue) && reviewCountValue >= 0 ? reviewCountValue : 0,
  }
}

function formatDeliveryEstimate() {
  const estimatedDate = new Date()
  let remainingBusinessDays = 3

  while (remainingBusinessDays > 0) {
    estimatedDate.setDate(estimatedDate.getDate() + 1)

    const dayOfWeek = estimatedDate.getDay()
    const isBusinessDay = dayOfWeek !== 0 && dayOfWeek !== 6

    if (isBusinessDay) {
      remainingBusinessDays -= 1
    }
  }

  const formatter = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return {
    label: 'Entrega prevista para el',
    range: `${formatter.format(estimatedDate)}.`,
  }
}

function getVisibleDecantPrices(product, decantSettings) {
  const productDecantPrices = Array.isArray(product?.decantPrices) ? product.decantPrices : []
  const settingsSizes = Array.isArray(decantSettings?.sizes) ? decantSettings.sizes : []

  return settingsSizes
    .map((size) => {
      const matchingPrice = productDecantPrices.find(
        (entry) => String(entry.sizeId) === String(size._id) && Number(entry.price) > 0,
      )

      if (!matchingPrice) {
        return null
      }

      return {
        sizeId: String(size._id),
        label: size.label?.trim() || `${Number(size.sizeMl || 0)} ml`,
        price: Number(matchingPrice.price || 0),
      }
    })
    .filter(Boolean)
}

function buildCartItemKey(productId, variant = null) {
  if (variant?.kind === 'decant' && variant.sizeId) {
    return `decant:${productId}:${variant.sizeId}`
  }

  return `product:${productId}`
}

function buildDecantDisplayName(productName, sizeLabel) {
  return `${productName} · ${sizeLabel}`
}

function StarRating({ rating, reviews, centered = false }) {
  const fillWidth = `${(rating / 5) * 100}%`

  return (
    <div className={centered ? 'rating-row rating-row--centered' : 'rating-row'}>
      <div className="star-rating" aria-label={`Calificación de ${rating} sobre 5`}>
        <span className="star-rating__base">★★★★★</span>
        <span className="star-rating__fill" style={{ width: fillWidth }}>
          ★★★★★
        </span>
      </div>
      <span className="rating-row__value">({reviews})</span>
    </div>
  )
}

function QuickViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.25 4.25" />
      <path d="M11 8.25v5.5" />
      <path d="M8.25 11h5.5" />
    </svg>
  )
}

function SuccessIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.4l2.35 2.35L15.8 9.8" />
    </svg>
  )
}

function useCartConfirmation() {
  const [confirmationState, setConfirmationState] = useState('hidden')
  const isConfirmationVisible = confirmationState !== 'hidden'

  useEffect(() => {
    if (confirmationState !== 'visible') {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setConfirmationState('closing')
    }, 2000)

    return () => window.clearTimeout(timeoutId)
  }, [confirmationState])

  useEffect(() => {
    if (confirmationState !== 'closing') {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setConfirmationState('hidden')
    }, 260)

    return () => window.clearTimeout(timeoutId)
  }, [confirmationState])

  function showConfirmation() {
    setConfirmationState('visible')
  }

  function startClosingConfirmation() {
    setConfirmationState('closing')
  }

  return {
    confirmationState,
    isConfirmationVisible,
    showConfirmation,
    startClosingConfirmation,
  }
}

function CartConfirmationModal({ productName, confirmationState }) {
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={confirmationState === 'closing' ? 'cart-confirmation-modal cart-confirmation-modal--closing' : 'cart-confirmation-modal'}
      role="alertdialog"
      aria-modal="true"
      aria-label="Producto agregado al carrito"
    >
      <div className="cart-confirmation-modal__backdrop" aria-hidden="true" />
      <div className="cart-confirmation-modal__panel">
        <div className="cart-confirmation-modal__icon" aria-hidden="true">
          <SuccessIcon />
        </div>
        <span className="cart-confirmation-modal__eyebrow">Añadido con éxito</span>
        <h2>Producto agregado</h2>
        <p>{productName} ya está en tu carrito.</p>
      </div>
    </div>,
    document.body,
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.52 3.48A11.88 11.88 0 0 0 12.02 0C5.4 0 .03 5.37.03 12c0 2.12.55 4.2 1.6 6.03L0 24l6.17-1.6a11.9 11.9 0 0 0 5.83 1.49h.01c6.62 0 11.99-5.37 11.99-11.99 0-3.2-1.25-6.2-3.48-8.43Zm-8.5 18.39h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.22-3.66.95.98-3.56-.24-.37A9.88 9.88 0 0 1 2.05 12c0-5.49 4.47-9.96 9.97-9.96 2.66 0 5.16 1.03 7.04 2.91A9.88 9.88 0 0 1 21.98 12c0 5.49-4.47 9.96-9.96 9.96Zm5.46-7.45c-.3-.15-1.79-.88-2.07-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-.3-.15-1.26-.46-2.4-1.46a8.92 8.92 0 0 1-1.66-2.07c-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.64-.93-2.25-.25-.59-.5-.5-.68-.5h-.58c-.2 0-.53.08-.8.38-.28.3-1.06 1.03-1.06 2.5 0 1.46 1.08 2.88 1.23 3.08.15.2 2.1 3.2 5.08 4.48.71.3 1.26.48 1.69.61.71.23 1.35.2 1.86.12.57-.08 1.79-.73 2.04-1.43.25-.71.25-1.31.18-1.43-.08-.13-.28-.2-.58-.35Z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.25" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.35" cy="6.65" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ProductCarousel({ images, name, onImageClick, onAddToCart, onQuickView, showOverlayActions = true }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const safeImages = images.length ? images : [fallbackImage]
  const touchStartXRef = useRef(null)
  const suppressTapRef = useRef(false)

  function goToSlide(nextIndex) {
    const normalized = (nextIndex + safeImages.length) % safeImages.length
    setActiveIndex(normalized)
  }

  function handleTouchStart(event) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
    suppressTapRef.current = false
  }

  function handleTouchEnd(event) {
    if (touchStartXRef.current == null || safeImages.length <= 1) {
      touchStartXRef.current = null
      return
    }

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartXRef.current
    const deltaX = touchEndX - touchStartXRef.current
    touchStartXRef.current = null

    if (Math.abs(deltaX) < 36) {
      return
    }

    suppressTapRef.current = true
    goToSlide(deltaX < 0 ? activeIndex + 1 : activeIndex - 1)
  }

  function handleImageActivate(event) {
    if (suppressTapRef.current) {
      event.preventDefault()
      suppressTapRef.current = false
      return
    }

    onImageClick?.()
  }

  return (
    <div className="product-carousel" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {onImageClick ? (
        <button type="button" className="product-image-button" onClick={handleImageActivate} aria-label={`Ver detalle de ${name}`}>
          <img
            src={safeImages[activeIndex]}
            alt={name}
            className="product-image"
          />
        </button>
      ) : (
        <img
          src={safeImages[activeIndex]}
          alt={name}
          className="product-image"
        />
      )}
      {showOverlayActions ? (
        <div className="product-hover-actions">
          <button
            type="button"
            className="product-hover-actions__button"
            onClick={onAddToCart}
            aria-label={`Agregar ${name} al carrito`}
            title="Agregar al carrito"
          >
            <CartIcon />
          </button>
          <button
            type="button"
            className="product-hover-actions__button"
            onClick={onQuickView}
            aria-label={`Vista rápida de ${name}`}
            title="Vista rápida"
          >
            <QuickViewIcon />
          </button>
        </div>
      ) : null}
      {safeImages.length > 1 ? (
        <>
          <button type="button" className="carousel-arrow carousel-arrow--prev" onClick={() => goToSlide(activeIndex - 1)}>
            ‹
          </button>
          <button type="button" className="carousel-arrow carousel-arrow--next" onClick={() => goToSlide(activeIndex + 1)}>
            ›
          </button>
          <div className="carousel-dots">
            {safeImages.map((image, index) => (
              <button
                key={image}
                type="button"
                className={index === activeIndex ? 'carousel-dot carousel-dot--active' : 'carousel-dot'}
                onClick={() => goToSlide(index)}
                aria-label={`Ver imagen ${index + 1} de ${name}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function ProductDetailGallery({ images, name }) {
  const safeImages = images.length ? images : [fallbackImage]
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div className="detail-gallery">
      <div className="detail-gallery__thumbs">
        {safeImages.map((image, index) => (
          <button
            key={image}
            type="button"
            className={index === activeIndex ? 'detail-gallery__thumb detail-gallery__thumb--active' : 'detail-gallery__thumb'}
            onClick={() => setActiveIndex(index)}
            aria-label={`Ver imagen ${index + 1} de ${name}`}
          >
            <img src={image} alt={`${name} miniatura ${index + 1}`} />
          </button>
        ))}
      </div>

      <div className="detail-gallery__stage">
        <img src={safeImages[activeIndex]} alt={name} className="detail-gallery__image" />
      </div>
    </div>
  )
}

function CheckoutPage({
  items,
  formValues,
  message,
  isSubmitting,
  couponName,
  couponMessage,
  isApplyingCoupon,
  appliedCoupon,
  baseSubtotalAmount,
  subtotalAmount,
  shippingZones,
  selectedShippingZoneId,
  discountAmount,
  discountedSubtotalAmount,
  shippingAmount,
  surchargeAmount,
  totalAmount,
  onBack,
  onFieldChange,
  onCouponNameChange,
  onApplyCoupon,
  onRemoveCoupon,
  onSelectShippingZone,
  onSubmit,
}) {
  const fallbackShippingZone = shippingZones.find((zone) => isFallbackShippingZone(zone)) || null
  const visibleShippingZones = shippingZones.filter((zone) => !isFallbackShippingZone(zone))
  const selectedShippingZone = selectedShippingZoneId === otherShippingOptionId
    ? fallbackShippingZone
    : visibleShippingZones.find((zone) => zone._id === selectedShippingZoneId) || null
  const deliveryEstimate = formatDeliveryEstimate()
  const productDiscountAmount = Math.max(0, baseSubtotalAmount - subtotalAmount)
  const totalAppliedDiscount = productDiscountAmount + discountAmount
  const isOtherCitySelected = selectedShippingZoneId === otherShippingOptionId
  const appliedCouponSummary = appliedCoupon ? appliedCoupon.coupon || appliedCoupon : null
  const appliedCouponDiscountLabel = appliedCouponSummary
    ? appliedCouponSummary.discountType === 'percentage'
      ? `${appliedCouponSummary.discountValue}% de descuento`
      : `${formatCurrency(appliedCouponSummary.discountValue)} de descuento`
    : ''
  const couponPreviousPrice = appliedCoupon ? Number(appliedCoupon.eligibleSubtotalAmount || subtotalAmount) : 0
  const couponNewPrice = appliedCoupon ? Math.max(0, couponPreviousPrice - Number(appliedCoupon.discountAmount || 0)) : 0

  if (!items.length) {
    return (
      <section className="checkout-page">
        <button type="button" className="detail-back" onClick={onBack}>
          Volver al carrito
        </button>

        <div className="cart-empty">
          <span className="cart-eyebrow">Checkout</span>
          <h1>No hay productos para pagar</h1>
          <p>Agrega productos al carrito antes de continuar al checkout.</p>
          <button type="button" className="button-primary cart-empty__action" onClick={onBack}>
            Volver al carrito
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="checkout-page">
      <button type="button" className="detail-back" onClick={onBack}>
        Volver al carrito
      </button>

      <div className="checkout-layout">
        <article className="info-card checkout-card">
          <div className="checkout-card__heading">
            <span className="cart-eyebrow">Checkout</span>
            <h1>Datos para continuar al pago</h1>
            <p>Completa la información para continuar con tu pedido y elegir cómo pagar.</p>
          </div>

          <form className="purchase-form" onSubmit={onSubmit}>
            <label className="checkout-field">
              <span>Nombres</span>
              <input
                type="text"
                value={formValues.firstName}
                onChange={(event) => onFieldChange('firstName', event.target.value)}
                autoComplete="given-name"
                required
              />
            </label>

            <label className="checkout-field">
              <span>Apellidos</span>
              <input
                type="text"
                value={formValues.lastName}
                onChange={(event) => onFieldChange('lastName', event.target.value)}
                autoComplete="family-name"
                required
              />
            </label>

            <label className="checkout-field">
              <span>Documento de identificación</span>
              <select
                value={formValues.documentType}
                onChange={(event) => onFieldChange('documentType', event.target.value)}
                required
              >
                <option value="">Selecciona una opción</option>
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="NIT">NIT</option>
              </select>
            </label>

            <label className="checkout-field">
              <span>Número de documento</span>
              <input
                type="text"
                inputMode="numeric"
                value={formValues.documentNumber}
                onChange={(event) => onFieldChange('documentNumber', event.target.value)}
                required
              />
            </label>

            <label className="checkout-field">
              <span>Número de teléfono</span>
              <div className="checkout-phone-field">
                <select
                  className="checkout-phone-field__code"
                  value={formValues.phoneCountryCode}
                  onChange={(event) => onFieldChange('phoneCountryCode', event.target.value)}
                  aria-label="Código de país"
                >
                  {phoneCountryOptions.map((countryCode) => (
                    <option key={countryCode} value={countryCode}>
                      {countryCode}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={formValues.phone}
                  onChange={(event) => onFieldChange('phone', event.target.value)}
                  autoComplete="tel-national"
                  required
                />
              </div>
            </label>

            <label className="checkout-field">
              <span>Correo electrónico</span>
              <input
                type="email"
                value={formValues.email}
                onChange={(event) => onFieldChange('email', event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="checkout-field checkout-field--full">
              <span>Método de pago</span>
              <select
                value={formValues.paymentMethod}
                onChange={(event) => onFieldChange('paymentMethod', event.target.value)}
                required
              >
                <option value="">Selecciona un método de pago</option>
                <option value="cash_on_delivery">Efectivo contra entrega</option>
                <option value="online">Pago en línea</option>
              </select>
            </label>

            <label className="checkout-field checkout-field--full">
              <span>Dirección de envío</span>
              <input
                type="text"
                value={formValues.address}
                onChange={(event) => onFieldChange('address', event.target.value)}
                autoComplete="street-address"
                required
              />
            </label>

            <label className="checkout-field">
              <span>Barrio</span>
              <input
                type="text"
                value={formValues.neighborhood}
                onChange={(event) => onFieldChange('neighborhood', event.target.value)}
                autoComplete="address-level3"
                required
              />
            </label>

            <label className="checkout-field">
              <span>Estado</span>
              <select
                value={formValues.state}
                onChange={(event) => onFieldChange('state', event.target.value)}
                autoComplete="address-level1"
                required
              >
                <option value="">Selecciona un estado</option>
                {colombiaStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>

            <label className="checkout-field checkout-field--full">
              <span>Ciudad</span>
              <select
                value={selectedShippingZoneId}
                onChange={(event) => onSelectShippingZone(event.target.value)}
                required
              >
                <option value="">Selecciona una ciudad</option>
                {visibleShippingZones.map((zone) => (
                  <option key={zone._id} value={zone._id}>
                    {zone.place}
                  </option>
                ))}
                {fallbackShippingZone ? <option value={otherShippingOptionId}>Otra ciudad</option> : null}
              </select>
              {selectedShippingZone ? (
                <small className="checkout-field__hint">
                  Envío: {formatCurrency(selectedShippingZone.price)}
                  {` · Entrega prevista para el ${deliveryEstimate.range}`}
                </small>
              ) : null}
            </label>

            {isOtherCitySelected ? (
              <label className="checkout-field checkout-field--custom-city">
                <span>Escribe tu ciudad</span>
                <input
                  type="text"
                  value={formValues.city}
                  onChange={(event) => onFieldChange('city', event.target.value)}
                  autoComplete="address-level2"
                  required
                />
              </label>
            ) : null}

            <label className="checkout-consent purchase-form__full">
              <input
                type="checkbox"
                checked={formValues.shippingConsent}
                onChange={(event) => onFieldChange('shippingConsent', event.target.checked)}
                required
              />
              <span>Acepto recibir notificaciones relacionadas con el envío de mi pedido.</span>
            </label>

            {message ? <p className="status-copy status-copy--error purchase-form__full">{message}</p> : null}

            <button type="submit" className="button-primary purchase-form__submit" disabled={isSubmitting || !items.length}>
              {isSubmitting
                ? formValues.paymentMethod === 'cash_on_delivery'
                  ? 'Abriendo WhatsApp...'
                  : 'Redirigiendo al pago...'
                : formValues.paymentMethod === 'cash_on_delivery'
                  ? 'Confirmar por WhatsApp'
                  : 'Continuar al pago'}
            </button>
          </form>
        </article>

        <aside className="info-card checkout-card checkout-card--summary">
          <div className="checkout-card__heading">
            <span className="cart-eyebrow">Resumen</span>
            <h2>Tu compra</h2>
          </div>

          <div className="checkout-items">
            {items.map((item) => (
              <article key={item.cartKey} className="checkout-item">
                <div className="checkout-item__media">
                  <img src={item.product.imageUrls?.[0] || item.product.imageUrl || fallbackImage} alt={item.displayName} />
                </div>
                <div className="checkout-item__copy">
                  <strong>{item.displayName}</strong>
                  <span>{formatCurrency(item.unitPrice)} x {item.quantity}</span>
                </div>
                <strong className="checkout-item__total">{formatCurrency(item.lineTotal)}</strong>
              </article>
            ))}
          </div>

          <div className="checkout-totals">
            <div>
              <span>Precio base</span>
              <strong className="checkout-totals__base-price">{formatCurrency(baseSubtotalAmount)}</strong>
            </div>
            <div>
              <span>Descuento aplicado</span>
              <strong>{totalAppliedDiscount > 0 ? `- ${formatCurrency(totalAppliedDiscount)}` : 'Sin descuento'}</strong>
            </div>
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(discountedSubtotalAmount)}</strong>
            </div>
            <div>
              <span>Envío</span>
              <strong>{selectedShippingZone ? formatCurrency(shippingAmount) : 'Por seleccionar'}</strong>
            </div>
            <div>
              <span>Recargo contra entrega</span>
              <strong>{surchargeAmount > 0 ? formatCurrency(surchargeAmount) : 'No aplica'}</strong>
            </div>
            <div className="checkout-totals__coupon">
              <span>Cupón</span>
              <div className="checkout-totals__coupon-field">
                <div className="coupon-field coupon-field--summary">
                  <input
                    type="text"
                    value={couponName}
                    onChange={(event) => onCouponNameChange(event.target.value)}
                    placeholder="Escribe tu cupón"
                  />
                  <button type="button" className="button-secondary coupon-field__button" onClick={onApplyCoupon} disabled={isApplyingCoupon || !couponName.trim()}>
                    {isApplyingCoupon ? 'Aplicando...' : 'Aplicar cupón'}
                  </button>
                </div>
                {couponMessage && !appliedCoupon ? (
                  <small className="checkout-field__hint coupon-field__feedback">{couponMessage}</small>
                ) : null}
                {appliedCoupon && appliedCouponSummary ? (
                  <div className="coupon-field__applied-summary">
                    <button type="button" className="coupon-field__remove" onClick={onRemoveCoupon} aria-label="Quitar cupón aplicado">
                      ×
                    </button>
                    <strong>{appliedCouponSummary.name} aplicado correctamente.</strong>
                    <span>{appliedCouponDiscountLabel}</span>
                    <span>Precio anterior: {formatCurrency(couponPreviousPrice)}</span>
                    <span>Precio nuevo: {formatCurrency(couponNewPrice)}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="checkout-totals__final">
              <span>Total</span>
              <strong>{formatCurrency(totalAmount)}</strong>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function CartSidebar({
  isOpen,
  items,
  subtotalAmount,
  shippingZones,
  selectedShippingZoneId,
  customCity,
  shippingAmount,
  totalAmount,
  onClose,
  onIncrease,
  onDecrease,
  onRemove,
  onSelectShippingZone,
  onCustomCityChange,
  onOpenCheckout,
  onOpenCartPage,
}) {
  const fallbackShippingZone = shippingZones.find((zone) => isFallbackShippingZone(zone)) || null
  const visibleShippingZones = shippingZones.filter((zone) => !isFallbackShippingZone(zone))
  const selectedShippingZone = selectedShippingZoneId === otherShippingOptionId
    ? fallbackShippingZone
    : visibleShippingZones.find((zone) => zone._id === selectedShippingZoneId) || null
  const isOtherCitySelected = selectedShippingZoneId === otherShippingOptionId
  const deliveryEstimate = formatDeliveryEstimate()

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="cart-sidebar" role="dialog" aria-modal="true" aria-label="Carrito de compra">
      <button type="button" className="cart-sidebar__backdrop" onClick={onClose} aria-label="Cerrar carrito" />
      <aside className="cart-sidebar__panel">
        <header className="cart-sidebar__header">
          <div>
            <span className="cart-eyebrow">Carrito</span>
            <h2>Tu compra</h2>
          </div>
          <button type="button" className="cart-sidebar__close" onClick={onClose} aria-label="Cerrar carrito">
            ×
          </button>
        </header>

        {items.length ? (
          <>
            <div className="cart-sidebar__list">
              {items.map((item) => (
                <article key={item.cartKey} className="cart-sidebar__item">
                  <button
                    type="button"
                    className="cart-sidebar__remove"
                    onClick={() => onRemove(item.cartKey)}
                    aria-label={`Eliminar ${item.displayName} del carrito`}
                  >
                    ×
                  </button>

                  <div className="cart-sidebar__media">
                    <img src={item.product.imageUrls?.[0] || item.product.imageUrl || fallbackImage} alt={item.displayName} />
                  </div>

                  <div className="cart-sidebar__copy">
                    <strong>{item.displayName}</strong>
                    <span>{formatCurrency(item.unitPrice)} x {item.quantity}</span>
                    <div className="cart-quantity cart-quantity--sidebar">
                      <button type="button" onClick={() => onDecrease(item.cartKey)} aria-label={`Reducir cantidad de ${item.displayName}`}>
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => onIncrease(item.cartKey)} aria-label={`Aumentar cantidad de ${item.displayName}`}>
                        +
                      </button>
                    </div>
                  </div>

                  <strong className="cart-sidebar__line-total">{formatCurrency(item.lineTotal)}</strong>
                </article>
              ))}
            </div>

            <div className="cart-sidebar__shipping">
              <label htmlFor="shipping-zone" className="cart-sidebar__label">Destino de envío</label>
              <select
                id="shipping-zone"
                className="cart-sidebar__select"
                value={selectedShippingZoneId}
                onChange={(event) => onSelectShippingZone(event.target.value)}
              >
                <option value="">Selecciona un destino</option>
                {visibleShippingZones.map((zone) => (
                  <option key={zone._id} value={zone._id}>
                    {zone.place} - {formatCurrency(zone.price)}
                  </option>
                ))}
                {fallbackShippingZone ? (
                  <option value={otherShippingOptionId}>
                    Otra ciudad - {formatCurrency(fallbackShippingZone.price)}
                  </option>
                ) : null}
              </select>
              {isOtherCitySelected ? (
                <input
                  type="text"
                  className="cart-sidebar__custom-city"
                  value={customCity}
                  onChange={(event) => onCustomCityChange(event.target.value)}
                  placeholder="Escribe tu ciudad"
                />
              ) : null}
              <p className="cart-sidebar__hint">Entrega prevista para el {deliveryEstimate.range}</p>
            </div>

            <div className="cart-sidebar__summary">
              <div>
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotalAmount)}</strong>
              </div>
              <div>
                <span>Envío</span>
                <strong>{selectedShippingZone ? formatCurrency(shippingAmount) : 'Por seleccionar'}</strong>
              </div>
              <div className="cart-sidebar__total-row">
                <span>Total</span>
                <strong>{formatCurrency(totalAmount)}</strong>
              </div>
            </div>

            <div className="cart-sidebar__actions">
              <button type="button" className="button-secondary cart-sidebar__action" onClick={onOpenCheckout}>
                Comprar
              </button>
              <button type="button" className="button-primary cart-sidebar__action" onClick={onOpenCartPage}>
                Ver mi carrito
              </button>
            </div>
          </>
        ) : (
          <div className="cart-empty cart-empty--sidebar">
            <h3>Tu carrito está vacío</h3>
            <p>Agrega productos para revisar cantidades, destino de envío y total antes de finalizar la compra.</p>
            <button type="button" className="button-primary cart-empty__action" onClick={onClose}>
              Seguir comprando
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}

function CartPage({ items, subtotalAmount, onBack, onIncrease, onDecrease, onRemove, onOpenCheckout }) {

  if (!items.length) {
    return (
      <section className="cart-page">
        <button type="button" className="detail-back" onClick={onBack}>
          Volver al catálogo
        </button>

        <div className="cart-empty">
          <span className="cart-eyebrow">Carrito</span>
          <h1>Tu selección aún está vacía</h1>
          <p>
            Explora las fragancias, agrega tus favoritas y vuelve aquí para revisar el pedido
            con una presentación limpia y lista para cerrar la compra.
          </p>
          <button type="button" className="button-primary cart-empty__action" onClick={onBack}>
            Seguir comprando
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="cart-page">
      <div className="cart-page__header">
        <div>
          <div className="cart-page__topline">
            <span className="cart-eyebrow">Carrito</span>
          </div>
          <button type="button" className="button-secondary cart-page__back" onClick={onBack}>
            Seguir comprando
          </button>
          <h1 className="cart-page__title">Tu selección lista para compra</h1>
        </div>
      </div>

      <div className="cart-layout">
        <div className="cart-list">
          {items.map((item) => (
            <article key={item.cartKey} className="cart-item">
              <button
                type="button"
                className="cart-item__remove"
                onClick={() => onRemove(item.cartKey)}
                aria-label={`Eliminar ${item.displayName} del carrito`}
              >
                ×
              </button>

              <button
                type="button"
                className="cart-item__media"
                onClick={onBack}
                aria-label={`Volver y seguir comprando ${item.displayName}`}
              >
                <img src={item.product.imageUrl || fallbackImage} alt={item.displayName} />
              </button>

              <div className="cart-item__copy">
                <span>{item.product.category?.name || 'Selección Saval'}</span>
                <strong>{item.displayName}</strong>
              </div>

              <div className="cart-item__price">
                <span>{item.isDecantVariant ? formatCurrency(item.unitPrice) : formatCurrency(item.product.basePrice)}</span>
                <strong>{formatCurrency(item.unitPrice)}</strong>
              </div>

              <div className="cart-quantity">
                <button type="button" onClick={() => onDecrease(item.cartKey)} aria-label={`Reducir cantidad de ${item.displayName}`}>
                  -
                </button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => onIncrease(item.cartKey)} aria-label={`Aumentar cantidad de ${item.displayName}`}>
                  +
                </button>
              </div>

              <strong className="cart-item__total">{formatCurrency(item.lineTotal)}</strong>
            </article>
          ))}
        </div>

        <aside className="cart-summary">
          <span className="cart-eyebrow">Resumen</span>
          <h2>Subtotal</h2>
          <strong>{formatCurrency(subtotalAmount)}</strong>
          <p>Los envíos y confirmaciones finales se coordinan contigo al momento de cerrar la compra.</p>
          <button type="button" className="button-primary cart-summary__cta" onClick={onOpenCheckout}>
            Ir al checkout
          </button>
        </aside>
      </div>
    </section>
  )
}

function ProductDetailView({ product, onBack, onAddToCart, onBuyNow, onOpenFullProduct, isQuickView = false }) {
  const ratingData = getProductRatingData(product)
  const deliveryEstimate = formatDeliveryEstimate()
  const [isQuickDescriptionExpanded, setIsQuickDescriptionExpanded] = useState(false)
  const productDescription = product.description || 'Una selección original con presencia elegante y salida memorable para quienes buscan una firma olfativa distinta.'

  return (
    <section className={isQuickView ? 'product-detail product-detail--modal' : 'product-detail'}>
      {!isQuickView ? (
        <button type="button" className="detail-back" onClick={onBack}>
          Volver al catálogo
        </button>
      ) : null}

      <div className="product-detail__grid">
        <ProductDetailGallery images={product.imageUrls || []} name={product.name} />

        <article className="detail-panel">
          <span className="detail-panel__eyebrow">{product.category?.name || 'Selección Saval'}</span>
          <h1>{product.name}</h1>
          <StarRating rating={ratingData.rating} reviews={ratingData.reviews} />

          <div className="detail-panel__stock">
            <span>Disponibilidad</span>
            <strong>{product.stock > 0 ? 'En stock' : 'Bajo pedido'}</strong>
          </div>

          <div className="detail-price">
            <span>{formatCurrency(product.basePrice)}</span>
            <strong>{formatCurrency(product.offerPrice)}</strong>
          </div>

          <p className={isQuickView && !isQuickDescriptionExpanded ? 'detail-description detail-description--clamped' : 'detail-description'}>
            {productDescription}
          </p>

          {isQuickView ? (
            <button
              type="button"
              className="detail-description-toggle"
              onClick={() => setIsQuickDescriptionExpanded((current) => !current)}
            >
              {isQuickDescriptionExpanded ? 'Ver menos' : 'Ver más'}
            </button>
          ) : null}

          <div className="detail-actions">
            <button type="button" className="button-secondary detail-action" onClick={() => onAddToCart(product._id, 1)}>
              Agregar al carrito
            </button>
            <button
              type="button"
              className="button-primary detail-action"
              onClick={() => onBuyNow(product)}
            >
              Comprar ahora
            </button>
          </div>

          {isQuickView ? (
            <button type="button" className="detail-more-link" onClick={() => onOpenFullProduct(product)}>
              Abrir ficha completa
            </button>
          ) : null}

          <p className="detail-delivery">
            <span>{deliveryEstimate.label} </span>
            <strong>{deliveryEstimate.range}</strong>
          </p>
        </article>
      </div>
    </section>
  )
}

function QuickViewModal({ product, onClose, onAddToCart, onOpenFullProduct, isConfirmationVisible, onCloseConfirmation }) {

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        if (isConfirmationVisible) {
          onCloseConfirmation()
          return
        }

        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isConfirmationVisible, onClose, onCloseConfirmation])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="quick-view-modal" role="dialog" aria-modal="true" aria-label={`Vista rápida de ${product.name}`}>
      <button type="button" className="quick-view-modal__backdrop" onClick={onClose} aria-label="Cerrar vista rápida" />
      <div className="quick-view-modal__panel">
        <button type="button" className="quick-view-modal__close" onClick={onClose} aria-label="Cerrar vista rápida">
          ×
        </button>
        <ProductDetailView
          product={product}
          onAddToCart={onAddToCart}
          onOpenFullProduct={onOpenFullProduct}
          isQuickView
        />
      </div>
    </div>,
    document.body,
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.75 4.5h1.54c.5 0 .94.34 1.06.83l.33 1.42h12.64c.34 0 .67.15.89.4.21.26.28.61.2.92l-1.42 5.68a1.13 1.13 0 0 1-1.1.85H9.12a1.13 1.13 0 0 1-1.09-.85L6.2 6.75" />
      <path d="M9.75 18.75a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm9 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
    </svg>
  )
}

function App() {
  const [payload, setPayload] = useState({ categories: [], products: [], shippingZones: [], decantSettings: { sizes: [] } })
  const [activeCategory, setActiveCategory] = useState('all')
  const [cartItems, setCartItems] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isCheckoutRoute, setIsCheckoutRoute] = useState(() => window.location.pathname === '/checkout')
  const [purchaseForm, setPurchaseForm] = useState({
    firstName: '',
    lastName: '',
    documentType: '',
    documentNumber: '',
    phoneCountryCode: '+57',
    phone: '',
    email: '',
    paymentMethod: '',
    address: '',
    neighborhood: '',
    state: '',
    city: '',
    shippingConsent: false,
  })
  const [purchaseMessage, setPurchaseMessage] = useState('')
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false)
  const [checkoutCouponName, setCheckoutCouponName] = useState('')
  const [checkoutCouponMessage, setCheckoutCouponMessage] = useState('')
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)
  const [appliedCheckoutCoupon, setAppliedCheckoutCoupon] = useState(null)
  const [routeProductId, setRouteProductId] = useState(() => getRouteProductId(window.location.pathname))
  const [isCartRoute, setIsCartRoute] = useState(() => window.location.pathname === '/carrito')
  const [isCartSidebarOpen, setIsCartSidebarOpen] = useState(false)
  const [selectedShippingZoneId, setSelectedShippingZoneId] = useState('')
  const [quickViewProduct, setQuickViewProduct] = useState(null)
  const [confirmationProductName, setConfirmationProductName] = useState('')
  const [decantQuantities, setDecantQuantities] = useState({})
  const [selectedDecantSizes, setSelectedDecantSizes] = useState({})
  const { confirmationState, isConfirmationVisible, showConfirmation, startClosingConfirmation } = useCartConfirmation()

  useEffect(() => {
    async function loadStorefront() {
      try {
        setIsLoading(true)
        const response = await fetch(`${apiBaseUrl}/storefront`)

        if (!response.ok) {
          throw new Error('No fue posible cargar el catálogo.')
        }

        const result = await response.json()
        setPayload(result)
      } catch (error) {
        setErrorMessage(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadStorefront()
  }, [])

  const hasDecantProducts = useMemo(
    () => payload.products.some((product) => getVisibleDecantPrices(product, payload.decantSettings).length > 0),
    [payload.decantSettings, payload.products],
  )

  const categoryChips = useMemo(() => {
    const chips = payload.categories.map((category, index) => ({
      id: category._id,
      label: category.name,
      sortOrder: Number.isFinite(Number(category.sortOrder)) ? Number(category.sortOrder) : index,
    }))

    if (hasDecantProducts) {
      chips.push({
        id: 'decants',
        label: 'Decants',
        sortOrder: Number.isFinite(Number(payload.decantSettings?.sortOrder))
          ? Number(payload.decantSettings.sortOrder)
          : chips.length,
      })
    }

    return chips.sort((leftChip, rightChip) => {
      if (leftChip.sortOrder !== rightChip.sortOrder) {
        return leftChip.sortOrder - rightChip.sortOrder
      }

      return leftChip.id === 'decants' ? 1 : -1
    })
  }, [hasDecantProducts, payload.categories, payload.decantSettings])

  useEffect(() => {
    if (activeCategory === 'decants' && !hasDecantProducts) {
      setActiveCategory('all')
    }
  }, [activeCategory, hasDecantProducts])

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'decants') {
      return payload.products.filter((product) => getVisibleDecantPrices(product, payload.decantSettings).length > 0)
    }

    if (activeCategory === 'all') {
      return payload.products
    }

    return payload.products.filter((product) => product.category?._id === activeCategory)
  }, [activeCategory, payload.decantSettings, payload.products])

  const cartCount = useMemo(
    () => Object.values(cartItems).reduce((total, item) => total + Number(item?.quantity || 0), 0),
    [cartItems],
  )

  const routeProduct = useMemo(
    () => payload.products.find((product) => product._id === routeProductId) || null,
    [payload.products, routeProductId],
  )

  const cartProducts = useMemo(
    () =>
      Object.entries(cartItems)
        .map(([cartKey, entry]) => {
          const product = payload.products.find((item) => item._id === entry.productId)

          if (!product || entry.quantity <= 0) {
            return null
          }

          const isDecantVariant = entry.variant?.kind === 'decant'
          const unitPrice = Number(isDecantVariant ? entry.variant.unitPrice : product.offerPrice || 0)
          const baseUnitPrice = Number(isDecantVariant ? entry.variant.unitPrice : product.basePrice || product.offerPrice || 0)

          return {
            cartKey,
            product,
            quantity: entry.quantity,
            displayName: isDecantVariant
              ? buildDecantDisplayName(product.name, entry.variant.sizeLabel)
              : product.name,
            isDecantVariant,
            sizeLabel: entry.variant?.sizeLabel || '',
            unitPrice,
            baseLineTotal: baseUnitPrice * entry.quantity,
            lineTotal: unitPrice * entry.quantity,
          }
        })
        .filter(Boolean),
    [cartItems, payload.products],
  )

  const cartBaseSubtotal = useMemo(
    () => cartProducts.reduce((total, item) => total + item.baseLineTotal, 0),
    [cartProducts],
  )

  const cartSubtotal = useMemo(
    () => cartProducts.reduce((total, item) => total + item.lineTotal, 0),
    [cartProducts],
  )

  const selectedShippingZone = useMemo(
    () => {
      const fallbackShippingZone = payload.shippingZones.find((zone) => isFallbackShippingZone(zone)) || null

      if (selectedShippingZoneId === otherShippingOptionId) {
        return fallbackShippingZone
      }

      return payload.shippingZones.find((zone) => zone._id === selectedShippingZoneId && !isFallbackShippingZone(zone)) || null
    },
    [payload.shippingZones, selectedShippingZoneId],
  )

  const checkoutDiscountAmount = Number(appliedCheckoutCoupon?.discountAmount || 0)
  const cartDiscountedSubtotal = Math.max(0, cartSubtotal - checkoutDiscountAmount)
  const cartShippingAmount = Number(selectedShippingZone?.price || 0)
  const cartBaseTotalAmount = cartDiscountedSubtotal + cartShippingAmount
  const cartSurchargeAmount = getCashOnDeliverySurcharge(cartBaseTotalAmount, purchaseForm.paymentMethod)
  const cartTotalAmount = cartBaseTotalAmount + cartSurchargeAmount

  useEffect(() => {
    if (!selectedShippingZoneId) {
      return
    }

    const shippingZoneExists =
      selectedShippingZoneId === otherShippingOptionId
        ? payload.shippingZones.some((zone) => isFallbackShippingZone(zone))
        : payload.shippingZones.some((zone) => zone._id === selectedShippingZoneId && !isFallbackShippingZone(zone))

    if (!shippingZoneExists) {
      setSelectedShippingZoneId('')
    }
  }, [payload.shippingZones, selectedShippingZoneId])

  useEffect(() => {
    setAppliedCheckoutCoupon(null)
    setCheckoutCouponMessage('')
  }, [cartItems])

  useEffect(() => {
    function handlePopState() {
      const { pathname } = window.location
      setRouteProductId(getRouteProductId(pathname))
      setIsCartRoute(pathname === '/carrito')
      setIsCheckoutRoute(pathname === '/checkout')
      setIsCartSidebarOpen(false)
      setQuickViewProduct(null)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function handleAddToCart(productId, quantity = 1, variant = null) {
    const cartKey = buildCartItemKey(productId, variant)

    setCartItems((current) => ({
      ...current,
      [cartKey]: {
        productId,
        quantity: Number(current[cartKey]?.quantity || 0) + quantity,
        variant: variant ? { ...variant } : null,
      },
    }))
  }

  function handleAddToCartWithConfirmation(product, quantity = 1, variant = null) {
    handleAddToCart(product._id, quantity, variant)
    setConfirmationProductName(variant?.sizeLabel ? buildDecantDisplayName(product.name, variant.sizeLabel) : product.name)
    showConfirmation()
  }

  function handleDecantQuantityChange(quantityKey, nextQuantity) {
    setDecantQuantities((current) => ({
      ...current,
      [quantityKey]: Math.max(1, nextQuantity),
    }))
  }

  function handleSelectedDecantSizeChange(productId, sizeId) {
    setSelectedDecantSizes((current) => ({
      ...current,
      [productId]: sizeId,
    }))
  }

  function handleOpenCart() {
    setIsCartSidebarOpen(true)
    setQuickViewProduct(null)
  }

  function handleCloseCart() {
    setIsCartSidebarOpen(false)
  }

  function handleOpenCartPage() {
    window.history.pushState({}, '', '/carrito')
    setRouteProductId('')
    setIsCartRoute(true)
    setIsCheckoutRoute(false)
    setIsCartSidebarOpen(false)
    setQuickViewProduct(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleOpenCheckout() {
    if (!cartProducts.length) {
      return
    }

    window.history.pushState({}, '', '/checkout')
    setRouteProductId('')
    setIsCartRoute(false)
    setIsCheckoutRoute(true)
    setIsCartSidebarOpen(false)
    setQuickViewProduct(null)
    setPurchaseMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBuyNow(product) {
    handleAddToCart(product._id, 1)
    window.history.pushState({}, '', '/checkout')
    setRouteProductId('')
    setIsCartRoute(false)
    setIsCheckoutRoute(true)
    setIsCartSidebarOpen(false)
    setQuickViewProduct(null)
    setPurchaseMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleOpenProduct(product) {
    const nextPath = getProductPath(product)
    window.history.pushState({}, '', nextPath)
    setRouteProductId(product._id)
    setIsCartRoute(false)
    setIsCheckoutRoute(false)
    setIsCartSidebarOpen(false)
    setQuickViewProduct(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBackToCatalog() {
    window.history.pushState({}, '', '/')
    setRouteProductId('')
    setIsCartRoute(false)
    setIsCheckoutRoute(false)
    setIsCartSidebarOpen(false)
    setQuickViewProduct(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCheckoutFieldChange(field, value) {
    setPurchaseForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleSelectShippingZone(value) {
    setSelectedShippingZoneId(value)

    if (value !== otherShippingOptionId) {
      setPurchaseForm((current) => ({
        ...current,
        city: '',
      }))
    }
  }

  function handleCheckoutCouponChange(value) {
    setCheckoutCouponName(value)
    setAppliedCheckoutCoupon(null)
    setCheckoutCouponMessage('')
  }

  function handleRemoveCheckoutCoupon() {
    setCheckoutCouponName('')
    setAppliedCheckoutCoupon(null)
    setCheckoutCouponMessage('')
  }

  async function handleApplyCheckoutCoupon() {
    if (!checkoutCouponName.trim()) {
      setCheckoutCouponMessage('Escribe un cupón para validarlo.')
      return
    }

    if (!cartProducts.length) {
      setCheckoutCouponMessage('No hay productos en el checkout para aplicar el cupón.')
      return
    }

    setIsApplyingCoupon(true)
    setCheckoutCouponMessage('')

    try {
      const response = await fetch(`${apiBaseUrl}/storefront/checkout/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          couponName: checkoutCouponName,
          items: cartProducts.map((item) => ({
            productId: item.product._id,
            quantity: item.quantity,
          })),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'No fue posible validar el cupón.' }))
        throw new Error(payload.message || 'No fue posible validar el cupón.')
      }

      const result = await response.json()
      setAppliedCheckoutCoupon(result)
      setCheckoutCouponMessage(`Cupón ${result.coupon.name} aplicado correctamente.`)
    } catch (error) {
      setAppliedCheckoutCoupon(null)
      setCheckoutCouponMessage(error.message)
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  function handleOpenQuickView(product) {
    setQuickViewProduct(product)
  }

  function handleCloseQuickView() {
    setQuickViewProduct(null)
  }

  function handleIncreaseCartItem(cartKey) {
    setCartItems((current) => {
      const existingItem = current[cartKey]

      if (!existingItem) {
        return current
      }

      return {
        ...current,
        [cartKey]: {
          ...existingItem,
          quantity: existingItem.quantity + 1,
        },
      }
    })
  }

  function handleDecreaseCartItem(cartKey) {
    setCartItems((current) => {
      const existingItem = current[cartKey]

      if (!existingItem) {
        return current
      }

      const nextQuantity = existingItem.quantity - 1

      if (nextQuantity <= 0) {
        const { [cartKey]: _removed, ...rest } = current
        return rest
      }

      return {
        ...current,
        [cartKey]: {
          ...existingItem,
          quantity: nextQuantity,
        },
      }
    })
  }

  function handleRemoveCartItem(cartKey) {
    setCartItems((current) => {
      const { [cartKey]: _removed, ...rest } = current
      return rest
    })
  }

  async function handlePurchaseSubmit(event) {
    event.preventDefault()
    setPurchaseMessage('')

    if (!selectedShippingZone) {
      setPurchaseMessage('Selecciona una ciudad de envío para continuar.')
      return
    }

    if (selectedShippingZoneId === otherShippingOptionId && !purchaseForm.city.trim()) {
      setPurchaseMessage('Escribe la ciudad para el envío marcado como Otra.')
      return
    }

    if (!purchaseForm.shippingConsent) {
      setPurchaseMessage('Debes aceptar las notificaciones de envío antes de continuar.')
      return
    }

    if (!purchaseForm.paymentMethod) {
      setPurchaseMessage('Selecciona un método de pago para continuar.')
      return
    }

    if (purchaseForm.paymentMethod === 'online' && !paymentGatewayUrl) {
      setPurchaseMessage('La pasarela de pago aún no está configurada.')
      return
    }

    setIsSubmittingPurchase(true)

    try {
      const reference = `SAVAL-${Date.now()}`
      const resolvedCity = selectedShippingZoneId === otherShippingOptionId
        ? purchaseForm.city.trim()
        : selectedShippingZone.place
      const checkoutPayload = {
        reference,
        customer: {
          ...purchaseForm,
          city: resolvedCity,
        },
        paymentMethod: purchaseForm.paymentMethod,
        items: cartProducts.map((item) => ({
          productId: item.product._id,
          name: item.displayName,
          variantLabel: item.sizeLabel || undefined,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice || 0),
          lineTotal: item.lineTotal,
        })),
        shippingZone: {
          id: selectedShippingZone._id,
          place: selectedShippingZone.place,
          price: cartShippingAmount,
          eta: selectedShippingZone.eta || '',
        },
        coupon: appliedCheckoutCoupon
          ? {
              id: appliedCheckoutCoupon.coupon.id,
              name: appliedCheckoutCoupon.coupon.name,
              discountAmount: checkoutDiscountAmount,
              eligibleProductIds: appliedCheckoutCoupon.eligibleProductIds,
            }
          : null,
        subtotalAmount: cartSubtotal,
        discountAmount: checkoutDiscountAmount,
        surchargeAmount: cartSurchargeAmount,
        totalAmount: cartTotalAmount,
      }

      await fetch(`${apiBaseUrl}/storefront/checkout/admin-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference,
          customer: checkoutPayload.customer,
          items: checkoutPayload.items,
          shippingZone: checkoutPayload.shippingZone,
          coupon: checkoutPayload.coupon,
          paymentMethod: checkoutPayload.paymentMethod,
          baseSubtotalAmount: cartBaseSubtotal,
          subtotalAmount: cartSubtotal,
          discountAmount: Math.max(0, cartBaseSubtotal - cartSubtotal) + checkoutDiscountAmount,
          surchargeAmount: cartSurchargeAmount,
          totalAmount: cartTotalAmount,
        }),
      }).catch((error) => {
        console.error('Admin order notification skipped', error)
      })

      window.sessionStorage.setItem('saval-checkout-payload', JSON.stringify(checkoutPayload))
      const whatsappOrderUrl = buildCheckoutWhatsAppLink(checkoutPayload, cartTotalAmount)
      window.sessionStorage.setItem('saval-checkout-whatsapp-url', whatsappOrderUrl)

      if (purchaseForm.paymentMethod === 'cash_on_delivery') {
        window.location.assign(whatsappOrderUrl)
        return
      }

      const nextUrl = new URL(paymentGatewayUrl, window.location.origin)
      nextUrl.searchParams.set('reference', reference)
      nextUrl.searchParams.set('amount', String(cartTotalAmount))
      nextUrl.searchParams.set('currency', 'COP')
      nextUrl.searchParams.set('customer_email', purchaseForm.email)
      nextUrl.searchParams.set('customer_phone', normalizePhoneNumber(purchaseForm.phoneCountryCode, purchaseForm.phone))
      nextUrl.searchParams.set('customer_name', `${purchaseForm.firstName} ${purchaseForm.lastName}`.trim())
      nextUrl.searchParams.set('customer_address', purchaseForm.address)
      nextUrl.searchParams.set('customer_neighborhood', purchaseForm.neighborhood)
      nextUrl.searchParams.set('customer_state', purchaseForm.state)
      nextUrl.searchParams.set('customer_city', resolvedCity)
      nextUrl.searchParams.set('shipping_zone', resolvedCity)
      nextUrl.searchParams.set('payment_method', purchaseForm.paymentMethod)
      nextUrl.searchParams.set('return_url', whatsappOrderUrl)
      nextUrl.searchParams.set('success_url', whatsappOrderUrl)
      nextUrl.searchParams.set('redirect_url', whatsappOrderUrl)
      nextUrl.searchParams.set('whatsapp_url', whatsappOrderUrl)

      window.location.assign(nextUrl.toString())
    } catch (error) {
      setPurchaseMessage(error.message)
      setIsSubmittingPurchase(false)
    }
  }

  return (
    <main className="store-shell">
      <section className="hero-section">
        <header className="topbar">
          <div className="topbar__logo" aria-hidden="true">
            <img src={brandLogoUrl} alt="Logo Saval Fragance" />
          </div>

          <div className="topbar__wordmark" id="inicio">
            <span>Maison de perfume</span>
            <strong>
              <span>SAVAL</span>
              <span>FRAGANCE</span>
            </strong>
            <span className="topbar__tagline">PERFUMERIA SELECTA - 100% ORIGINALES</span>
          </div>

          <button type="button" className="cart-button" aria-label={`Carrito con ${cartCount} productos`} onClick={handleOpenCart}>
            <CartIcon />
            {cartCount > 0 ? <span className="cart-button__badge">{cartCount}</span> : null}
          </button>
        </header>

        <CartSidebar
          isOpen={isCartSidebarOpen}
          items={cartProducts}
          subtotalAmount={cartSubtotal}
          shippingZones={payload.shippingZones}
          selectedShippingZoneId={selectedShippingZoneId}
          customCity={purchaseForm.city}
          shippingAmount={cartShippingAmount}
          totalAmount={cartTotalAmount}
          onClose={handleCloseCart}
          onIncrease={handleIncreaseCartItem}
          onDecrease={handleDecreaseCartItem}
          onRemove={handleRemoveCartItem}
          onSelectShippingZone={handleSelectShippingZone}
          onCustomCityChange={(value) => handleCheckoutFieldChange('city', value)}
          onOpenCheckout={handleOpenCheckout}
          onOpenCartPage={handleOpenCartPage}
        />

        {isCheckoutRoute ? (
          <CheckoutPage
            items={cartProducts}
            formValues={purchaseForm}
            message={purchaseMessage}
            isSubmitting={isSubmittingPurchase}
            couponName={checkoutCouponName}
            couponMessage={checkoutCouponMessage}
            isApplyingCoupon={isApplyingCoupon}
            appliedCoupon={appliedCheckoutCoupon}
            baseSubtotalAmount={cartBaseSubtotal}
            subtotalAmount={cartSubtotal}
            shippingZones={payload.shippingZones}
            selectedShippingZoneId={selectedShippingZoneId}
            discountAmount={checkoutDiscountAmount}
            discountedSubtotalAmount={cartDiscountedSubtotal}
            shippingAmount={cartShippingAmount}
            surchargeAmount={cartSurchargeAmount}
            totalAmount={cartTotalAmount}
            onBack={handleOpenCartPage}
            onFieldChange={handleCheckoutFieldChange}
            onCouponNameChange={handleCheckoutCouponChange}
            onApplyCoupon={handleApplyCheckoutCoupon}
            onRemoveCoupon={handleRemoveCheckoutCoupon}
            onSelectShippingZone={handleSelectShippingZone}
            onSubmit={handlePurchaseSubmit}
          />
        ) : isCartRoute ? (
          <CartPage
            items={cartProducts}
            subtotalAmount={cartSubtotal}
            onBack={handleBackToCatalog}
            onIncrease={handleIncreaseCartItem}
            onDecrease={handleDecreaseCartItem}
            onRemove={handleRemoveCartItem}
            onOpenCheckout={handleOpenCheckout}
          />
        ) : routeProduct ? (
          <ProductDetailView
            product={routeProduct}
            onBack={handleBackToCatalog}
            onAddToCart={() => handleAddToCartWithConfirmation(routeProduct, 1)}
            onBuyNow={handleBuyNow}
          />
        ) : (
          <>
            <div className="category-ribbon" aria-label="Categorías del catálogo">
              <div className="category-ribbon__intro">
                <span>Colecciones</span>
              </div>

              <div className="filter-row filter-row--hero">
                <button
                  type="button"
                  className={activeCategory === 'all' ? 'chip chip--active' : 'chip'}
                  onClick={() => setActiveCategory('all')}
                  style={{ '--enter-delay': '0ms' }}
                >
                  Todas
                </button>
                {categoryChips.map((chip, index) => (
                  <button
                    type="button"
                    key={chip.id}
                    className={activeCategory === chip.id ? 'chip chip--active' : 'chip'}
                    onClick={() => setActiveCategory(chip.id)}
                    style={{ '--enter-delay': `${(index + 1) * 90}ms` }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <section className="catalog-showcase" id="catalogo">
              {isLoading ? <p className="status-copy status-copy--centered">Cargando catálogo...</p> : null}
              {errorMessage ? <p className="status-copy status-copy--error status-copy--centered">{errorMessage}</p> : null}

              {!isLoading && !errorMessage ? (
                <div className="product-grid product-grid--showcase">
                  {filteredProducts.map((product, index) => {
                    const ratingData = getProductRatingData(product)
                    const visibleDecantPrices = getVisibleDecantPrices(product, payload.decantSettings)
                    const isDecantView = activeCategory === 'decants'
                    const selectedDecantSizeId = selectedDecantSizes[product._id]
                    const selectedDecantPrice = visibleDecantPrices.find((item) => item.sizeId === selectedDecantSizeId) || visibleDecantPrices[0] || null
                    const quantityKey = selectedDecantPrice
                      ? buildCartItemKey(product._id, { kind: 'decant', sizeId: selectedDecantPrice.sizeId })
                      : ''
                    const decantQuantity = quantityKey ? Math.max(1, decantQuantities[quantityKey] || 1) : 1

                    return (
                      <article
                        key={product._id}
                        className="product-card product-card--catalog"
                        style={{ '--enter-delay': `${index * 70}ms` }}
                      >
                        <ProductCarousel
                          images={product.imageUrls || []}
                          name={product.name}
                          onImageClick={() => handleOpenProduct(product)}
                          onAddToCart={() => handleAddToCartWithConfirmation(product, 1)}
                          onQuickView={() => handleOpenQuickView(product)}
                          showOverlayActions={!isDecantView}
                        />
                        <div className="product-body">
                          <div className="product-meta">
                            <span>{isDecantView ? 'Decants' : product.category?.name || 'Selección Saval'}</span>
                          </div>
                          <h3>{product.name}</h3>
                          <StarRating rating={ratingData.rating} reviews={ratingData.reviews} centered />
                          {isDecantView ? (
                            <>
                              {selectedDecantPrice ? (
                                <div className="decant-price-stack">
                                  <div className="decant-price-stack__item">
                                    <label className="decant-selector">
                                      <span className="decant-selector__label">Selecciona tu decant</span>
                                      <select
                                        value={selectedDecantPrice.sizeId}
                                        onChange={(event) => handleSelectedDecantSizeChange(product._id, event.target.value)}
                                        aria-label={`Seleccionar tamaño de ${product.name}`}
                                      >
                                        {visibleDecantPrices.map((decantPrice) => (
                                          <option key={decantPrice.sizeId} value={decantPrice.sizeId}>
                                            {`${decantPrice.label} · ${formatCurrency(decantPrice.price)}`}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <div className="decant-card-actions">
                                      <div className="decant-quantity" aria-label={`Cantidad de ${product.name} ${selectedDecantPrice.label}`}>
                                        <button
                                          type="button"
                                          onClick={() => handleDecantQuantityChange(quantityKey, decantQuantity - 1)}
                                          aria-label={`Reducir cantidad de ${product.name} ${selectedDecantPrice.label}`}
                                        >
                                          -
                                        </button>
                                        <span>{decantQuantity}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleDecantQuantityChange(quantityKey, decantQuantity + 1)}
                                          aria-label={`Aumentar cantidad de ${product.name} ${selectedDecantPrice.label}`}
                                        >
                                          +
                                        </button>
                                      </div>
                                      <button
                                        type="button"
                                        className="button-primary decant-card-actions__button"
                                        onClick={() => handleAddToCartWithConfirmation(product, decantQuantity, {
                                          kind: 'decant',
                                          sizeId: selectedDecantPrice.sizeId,
                                          sizeLabel: selectedDecantPrice.label,
                                          unitPrice: selectedDecantPrice.price,
                                        })}
                                      >
                                        Agregar al carrito
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="price-stack price-stack--catalog">
                              <span>{formatCurrency(product.basePrice)}</span>
                              <strong>{formatCurrency(product.offerPrice)}</strong>
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : null}

              {!isLoading && !errorMessage && filteredProducts.length === 0 ? (
                <p className="status-copy status-copy--centered">No hay publicaciones activas en esta colección.</p>
              ) : null}
            </section>
          </>
        )}

        {quickViewProduct ? (
          <QuickViewModal
            product={quickViewProduct}
            onClose={handleCloseQuickView}
            onAddToCart={() => handleAddToCartWithConfirmation(quickViewProduct, 1)}
            onOpenFullProduct={handleOpenProduct}
            isConfirmationVisible={isConfirmationVisible}
            onCloseConfirmation={startClosingConfirmation}
          />
        ) : null}

        {isConfirmationVisible ? <CartConfirmationModal productName={confirmationProductName} confirmationState={confirmationState} /> : null}

      </section>

      <div className="social-float">
        <a
          className="social-float__link social-float__link--instagram"
          href="https://www.instagram.com/savalfragance?igsh=MWQwaThod2lna3Rxdw%3D%3D&utm_source=qr"
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir Instagram de Saval Fragance"
          title="Instagram"
        >
          <InstagramIcon />
        </a>
        <a
          className="social-float__link social-float__link--whatsapp"
          href={buildWhatsAppUrl()}
          target="_blank"
          rel="noreferrer"
          aria-label="Escribir por WhatsApp"
          title="WhatsApp"
        >
          <WhatsAppIcon />
        </a>
      </div>
    </main>
  )
}

export default App
