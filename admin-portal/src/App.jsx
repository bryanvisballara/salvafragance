import { useEffect, useMemo, useState } from 'react'
import './App.css'

const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
const apiBaseUrl = import.meta.env.VITE_API_URL || (isLocalHost ? 'http://localhost:10000/api' : 'https://salvafragance.onrender.com/api')
const sidebarBrandImageUrl = `${import.meta.env.BASE_URL}sidebar-brand.jpeg`
const loginBrandImageUrl = `${import.meta.env.BASE_URL}login-brand.jpeg`
const adminBasePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const adminHomePath = adminBasePath ? `${adminBasePath}/` : '/'
const adminLoginPath = adminBasePath ? `${adminBasePath}/login` : '/login'

const emptyCategoryForm = { name: '', description: '' }
const emptyProductForm = {
  name: '',
  categoryId: '',
  basePrice: '',
  offerPrice: '',
  stock: '',
  rating: '',
  reviewCount: '',
  imageUrls: [],
  description: '',
}
const emptyShippingForm = { place: '', price: '', eta: '' }
const emptyCouponForm = {
  name: '',
  productIds: [],
  discountType: 'percentage',
  discountValue: '',
  startsAt: '',
  endsAt: '',
  hasNoExpiry: false,
}
const emptyMarketingForm = {
  subject: '',
  message: '',
  channel: 'email',
}
const emptyTrackingForm = { shippingCarrier: '', trackingNumber: '' }
const emptyModalState = { type: '', mode: 'create', item: null }
const emptyDeleteState = { type: '', item: null }
const navigationItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'publicaciones', label: 'Publicaciones' },
  { id: 'envios', label: 'Envíos' },
  { id: 'cupones', label: 'Cupones' },
  { id: 'ordenes', label: 'Órdenes' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'base-de-datos', label: 'Base de datos' },
]

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDateInputValue(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

function getCouponStatus(coupon) {
  const now = new Date()
  const startsAt = coupon?.startsAt ? new Date(coupon.startsAt) : null
  const endsAt = coupon?.endsAt ? new Date(coupon.endsAt) : null

  if (startsAt && startsAt > now) {
    return 'Programado'
  }

  if (endsAt && endsAt < now) {
    return 'Vencido'
  }

  return 'Vigente'
}

function isFallbackShippingZone(zone) {
  return Boolean(zone?.isFallback) || String(zone?.place || '').trim().toLowerCase() === 'otra'
}

function buildMarketingWhatsAppLink(phone, message) {
  const normalizedPhone = String(phone || '').replace(/\D/g, '')
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

function isSameDay(leftDate, rightDate) {
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  )
}

function getStartOfWeek(date) {
  const result = new Date(date)
  const day = result.getDay()
  const diff = day === 0 ? -6 : 1 - day

  result.setDate(result.getDate() + diff)
  result.setHours(0, 0, 0, 0)

  return result
}

function SuccessIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.4l2.35 2.35L15.8 9.8" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.8 20 18a1 1 0 0 1-.87 1.5H4.87A1 1 0 0 1 4 18l8-14.2Z" />
      <path d="M12 8.5v5.2" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window === 'undefined') {
      return '/'
    }

    return window.location.pathname || '/'
  })
  const [token, setToken] = useState(() => localStorage.getItem('sf_admin_token') || '')
  const [adminEmail, setAdminEmail] = useState(
    () => localStorage.getItem('sf_admin_email') || 'cfrap555@gmail.com',
  )
  const [loginData, setLoginData] = useState({ email: adminEmail, password: '' })
  const [loginError, setLoginError] = useState('')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [shippingZones, setShippingZones] = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [coupons, setCoupons] = useState([])
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm)
  const [productForm, setProductForm] = useState(emptyProductForm)
  const [shippingForm, setShippingForm] = useState(emptyShippingForm)
  const [otherShippingPrice, setOtherShippingPrice] = useState('')
  const [couponForm, setCouponForm] = useState(emptyCouponForm)
  const [couponCategorySelection, setCouponCategorySelection] = useState('')
  const [trackingForm, setTrackingForm] = useState(emptyTrackingForm)
  const [customerFilter, setCustomerFilter] = useState('')
  const [marketingFilter, setMarketingFilter] = useState('')
  const [marketingForm, setMarketingForm] = useState(emptyMarketingForm)
  const [selectedMarketingCustomerIds, setSelectedMarketingCustomerIds] = useState([])
  const [activePage, setActivePage] = useState('dashboard')
  const [modalState, setModalState] = useState(emptyModalState)
  const [deleteState, setDeleteState] = useState(emptyDeleteState)
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dashboardMessage, setDashboardMessage] = useState('')
  const [productFiles, setProductFiles] = useState([])
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [deletingImageUrl, setDeletingImageUrl] = useState('')
  const [isSendingMarketingEmail, setIsSendingMarketingEmail] = useState(false)
  const [expandedProductDescriptions, setExpandedProductDescriptions] = useState({})

  const fallbackShippingZone = useMemo(
    () => shippingZones.find((zone) => isFallbackShippingZone(zone)) || null,
    [shippingZones],
  )

  const standardShippingZones = useMemo(
    () => shippingZones.filter((zone) => !isFallbackShippingZone(zone)),
    [shippingZones],
  )

  const areAllCouponProductsSelected = useMemo(
    () => Boolean(products.length) && products.every((product) => couponForm.productIds.includes(product._id)),
    [couponForm.productIds, products],
  )

  const isAuthenticated = Boolean(token)

  const productFilePreviewUrls = useMemo(
    () => productFiles.map((file) => ({ fileName: file.name, previewUrl: URL.createObjectURL(file) })),
    [productFiles],
  )

  useEffect(() => {
    return () => {
      productFilePreviewUrls.forEach((file) => {
        URL.revokeObjectURL(file.previewUrl)
      })
    }
  }, [productFilePreviewUrls])

  const stats = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const startOfWeek = getStartOfWeek(now)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const productPriceMap = new Map(
      products.map((product) => [product._id, Number(product.offerPrice || 0)]),
    )

    const getOrderAmount = (order) => {
      const productId = order.product?._id || order.product
      return productPriceMap.get(productId) || 0
    }

    const salesToday = orders.reduce((total, order) => {
      const createdAt = new Date(order.createdAt)
      return isSameDay(createdAt, now) ? total + getOrderAmount(order) : total
    }, 0)

    const salesThisWeek = orders.reduce((total, order) => {
      const createdAt = new Date(order.createdAt)
      return createdAt >= startOfWeek ? total + getOrderAmount(order) : total
    }, 0)

    const salesThisMonth = orders.reduce((total, order) => {
      const createdAt = new Date(order.createdAt)
      return createdAt >= startOfMonth ? total + getOrderAmount(order) : total
    }, 0)

    return [
      { label: 'Categorías activas', value: categories.length.toString().padStart(2, '0') },
      { label: 'Publicaciones activas', value: products.length.toString().padStart(2, '0') },
      { label: 'Destinos de envío', value: shippingZones.length.toString().padStart(2, '0') },
      { label: 'Clientes', value: customers.length.toString().padStart(2, '0') },
      { label: 'Ventas del día', value: formatCurrency(salesToday) },
      { label: 'Ventas de la semana', value: formatCurrency(salesThisWeek) },
      { label: 'Ventas del mes', value: formatCurrency(salesThisMonth) },
    ]
  }, [categories.length, customers.length, orders, products, shippingZones.length])

  const filteredCustomers = useMemo(() => {
    const normalizedFilter = customerFilter.trim().toLowerCase()

    if (!normalizedFilter) {
      return customers
    }

    return customers.filter((customer) =>
      [
        `${customer.firstName} ${customer.lastName}`,
        customer.email,
        customer.phone,
        customer.city,
        customer.address,
        customer.product?.name,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedFilter)),
    )
  }, [customerFilter, customers])

  const filteredMarketingCustomers = useMemo(() => {
    const normalizedFilter = marketingFilter.trim().toLowerCase()

    if (!normalizedFilter) {
      return customers
    }

    return customers.filter((customer) =>
      [
        `${customer.firstName} ${customer.lastName}`,
        customer.email,
        customer.phone,
        customer.city,
        customer.product?.name,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedFilter)),
    )
  }, [customers, marketingFilter])

  const selectedMarketingCustomers = useMemo(
    () => customers.filter((customer) => selectedMarketingCustomerIds.includes(customer._id)),
    [customers, selectedMarketingCustomerIds],
  )

  const areAllVisibleMarketingCustomersSelected = useMemo(
    () =>
      Boolean(filteredMarketingCustomers.length) &&
      filteredMarketingCustomers.every((customer) => selectedMarketingCustomerIds.includes(customer._id)),
    [filteredMarketingCustomers, selectedMarketingCustomerIds],
  )

  async function apiRequest(path, options = {}) {
    const isFormData = options.body instanceof FormData

    let response

    try {
      response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          ...(options.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`No fue posible conectar con el backend en ${apiBaseUrl}. Verifica que el servidor esté activo e inténtalo de nuevo.`)
      }

      throw error
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(payload.message || 'Request failed')
    }

    if (response.status === 204) {
      return null
    }

    const responseText = await response.text()

    if (!responseText) {
      return null
    }

    return JSON.parse(responseText)
  }

  function openCreateModal(type) {
    setDashboardMessage('')

    if (type === 'category') {
      setCategoryForm(emptyCategoryForm)
    }

    if (type === 'product') {
      setProductForm({
        ...emptyProductForm,
        categoryId: categories[0]?._id || '',
      })
      setProductFiles([])
    }

    if (type === 'shipping') {
      setShippingForm(emptyShippingForm)
    }

    if (type === 'coupon') {
      setCouponForm(emptyCouponForm)
      setCouponCategorySelection('')
    }

    if (type === 'tracking') {
      setTrackingForm(emptyTrackingForm)
    }

    setModalState({ type, mode: 'create', item: null })
  }

  function openEditModal(type, item) {
    setDashboardMessage('')

    if (type === 'category') {
      setCategoryForm({ name: item.name, description: item.description || '' })
    }

    if (type === 'product') {
      setProductForm({
        name: item.name,
        categoryId: item.category?._id || '',
        basePrice: String(item.basePrice ?? ''),
        offerPrice: String(item.offerPrice ?? ''),
        stock: String(item.stock ?? ''),
        rating: String(item.rating ?? 0),
        reviewCount: String(item.reviewCount ?? 0),
        imageUrls: item.imageUrls || [],
        description: item.description || '',
      })
      setProductFiles([])
    }

    if (type === 'shipping') {
      setShippingForm({
        place: item.place,
        price: String(item.price ?? ''),
        eta: item.eta || '',
      })
    }

    if (type === 'coupon') {
      setCouponForm({
        name: item.name,
        productIds: (item.products || []).map((product) => product._id),
        discountType: item.discountType,
        discountValue: String(item.discountValue ?? ''),
        startsAt: formatDateInputValue(item.startsAt),
        endsAt: formatDateInputValue(item.endsAt),
        hasNoExpiry: !item.endsAt,
      })
      setCouponCategorySelection('')
    }

    if (type === 'tracking') {
      setTrackingForm({
        shippingCarrier: item.shippingCarrier || '',
        trackingNumber: item.trackingNumber || '',
      })
    }

    setModalState({ type, mode: 'edit', item })
  }

  function openTrackingModal(order) {
    openEditModal('tracking', order)
  }

  function closeModal() {
    setModalState(emptyModalState)
  }

  function openDeleteModal(type, item) {
    setDashboardMessage('')
    setDeleteState({ type, item })
  }

  function closeDeleteModal() {
    setDeleteState(emptyDeleteState)
  }

  function closeSuccessModal() {
    setSuccessMessage('')
  }

  function closeErrorModal() {
    setDashboardMessage('')
  }

  function showSuccess(message) {
    setSuccessMessage(message)
  }

  useEffect(() => {
    setOtherShippingPrice(fallbackShippingZone ? String(fallbackShippingZone.price ?? '') : '')
  }, [fallbackShippingZone])

  function toggleProductDescription(productId) {
    setExpandedProductDescriptions((current) => ({
      ...current,
      [productId]: !current[productId],
    }))
  }

  function handleLogout() {
    setToken('')
    setAdminEmail('cfrap555@gmail.com')
    localStorage.removeItem('sf_admin_token')
    localStorage.removeItem('sf_admin_email')
    setLoginData({ email: 'cfrap555@gmail.com', password: '' })
    setCategories([])
    setProducts([])
    setShippingZones([])
    setCustomers([])
    setOrders([])
    setCoupons([])
    setMarketingFilter('')
    setMarketingForm(emptyMarketingForm)
    setSelectedMarketingCustomerIds([])
    setExpandedProductDescriptions({})
    setActivePage('dashboard')
    setDashboardMessage('')
  }

  async function uploadProductImages(files) {
    if (!files.length) {
      return []
    }

    setIsUploadingImages(true)

    try {
      const formData = new FormData()

      files.forEach((file) => {
        formData.append('images', file)
      })

      const payload = await apiRequest('/uploads/product-images', {
        method: 'POST',
        body: formData,
      })

      return payload.imageUrls || []
    } finally {
      setIsUploadingImages(false)
    }
  }

  async function handleRemovePendingProductFile(fileIndex) {
    setProductFiles((current) => current.filter((_, index) => index !== fileIndex))
  }

  async function handleRemoveUploadedProductImage(imageUrl) {
    if (!imageUrl) {
      return
    }

    if (productForm.imageUrls.length === 1 && !productFiles.length) {
      setDashboardMessage('La publicación debe conservar al menos una imagen.')
      return
    }

    setDeletingImageUrl(imageUrl)

    try {
      await apiRequest('/uploads/product-images', {
        method: 'DELETE',
        body: JSON.stringify({
          imageUrl,
          productId: modalState.mode === 'edit' && modalState.item ? modalState.item._id : undefined,
        }),
      })

      setProductForm((current) => ({
        ...current,
        imageUrls: current.imageUrls.filter((currentImageUrl) => currentImageUrl !== imageUrl),
      }))
      setProducts((current) =>
        current.map((product) =>
          product._id === modalState.item?._id
            ? {
                ...product,
                imageUrls: (product.imageUrls || []).filter((currentImageUrl) => currentImageUrl !== imageUrl),
              }
            : product,
        ),
      )
      setDashboardMessage('')
    } catch (error) {
      setDashboardMessage(error.message)
    } finally {
      setDeletingImageUrl('')
    }
  }

  async function loadDashboardData(activeToken = token) {
    setIsLoading(true)

    try {
      const headers = activeToken ? { Authorization: `Bearer ${activeToken}` } : {}
      const [categoryRows, productRows, shippingRows, customerRows, orderRows, couponRows] = await Promise.all([
        apiRequest('/categories', { headers }),
        apiRequest('/products', { headers }),
        apiRequest('/shipping-zones', { headers }),
        apiRequest('/customers', { headers }),
        apiRequest('/orders', { headers }),
        apiRequest('/coupons', { headers }),
      ])

      setCategories(categoryRows)
      setProducts(productRows)
      setShippingZones(shippingRows)
      setCustomers(customerRows)
      setOrders(orderRows)
      setCoupons(couponRows)
      setProductForm((current) => ({
        ...current,
        categoryId: current.categoryId || categoryRows[0]?._id || '',
      }))
      setDashboardMessage('')
    } catch (error) {
      if (error.message === 'Invalid token' || error.message === 'Authentication required') {
        handleLogout()
      }

      setDashboardMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/')
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nextPath = isAuthenticated ? adminHomePath : adminLoginPath

    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, '', `${nextPath}${window.location.search}`)
      setCurrentPath(nextPath)
      return
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activePage, currentPath, isAuthenticated])

  async function handleLoginSubmit(event) {
    event.preventDefault()
    setLoginError('')

    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
      })

      setToken(result.token)
      setAdminEmail(result.admin.email)
      setActivePage('dashboard')
      localStorage.setItem('sf_admin_token', result.token)
      localStorage.setItem('sf_admin_email', result.admin.email)
      setLoginData({ email: result.admin.email, password: '' })
    } catch (error) {
      setLoginError(error.message)
    }
  }

  async function handleCategorySubmit(event) {
    event.preventDefault()

    try {
      const isEdit = modalState.mode === 'edit' && modalState.type === 'category'
      const savedCategory = await apiRequest(
        isEdit ? `/categories/${modalState.item._id}` : '/categories',
        {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(categoryForm),
      })

      setCategories((current) =>
        isEdit
          ? current.map((category) =>
              category._id === savedCategory._id ? savedCategory : category,
            )
          : [savedCategory, ...current],
      )
      setCategoryForm(emptyCategoryForm)
      setProductForm((current) => ({
        ...current,
        categoryId: current.categoryId || savedCategory._id,
      }))
      closeModal()
      showSuccess(isEdit ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.')
    } catch (error) {
      setDashboardMessage(error.message)
    }
  }

  async function handleProductSubmit(event) {
    event.preventDefault()

    try {
      const isEdit = modalState.mode === 'edit' && modalState.type === 'product'
      const basePrice = Number(productForm.basePrice)
      const offerPrice = Number(productForm.offerPrice)
      const rating = Number(productForm.rating || 0)
      const reviewCount = Number(productForm.reviewCount || 0)

      if (basePrice <= offerPrice) {
        throw new Error('El precio base debe ser mayor al precio oferta.')
      }

      if (Number.isNaN(rating) || rating < 0 || rating > 5) {
        throw new Error('El rating debe estar entre 0 y 5.')
      }

      if (Number.isNaN(reviewCount) || reviewCount < 0 || !Number.isInteger(reviewCount)) {
        throw new Error('El número de reseñas debe ser un entero mayor o igual a 0.')
      }

      const uploadedImageUrls = await uploadProductImages(productFiles)
      const imageUrls = [...productForm.imageUrls, ...uploadedImageUrls]

      if (!imageUrls.length) {
        throw new Error('Debes subir al menos una imagen para la publicación.')
      }

      const savedProduct = await apiRequest(isEdit ? `/products/${modalState.item._id}` : '/products', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...productForm,
          basePrice,
          offerPrice,
          stock: Number(productForm.stock),
          rating,
          reviewCount,
          imageUrls,
        }),
      })

      setProducts((current) =>
        isEdit
          ? current.map((product) => (product._id === savedProduct._id ? savedProduct : product))
          : [savedProduct, ...current],
      )
      setProductForm({
        ...emptyProductForm,
        categoryId: categories[0]?._id || productForm.categoryId,
      })
      setProductFiles([])
      closeModal()
      showSuccess(
        isEdit ? 'Publicación actualizada correctamente.' : 'Publicación creada correctamente.',
      )
    } catch (error) {
      setDashboardMessage(error.message)
    }
  }

  async function handleShippingSubmit(event) {
    event.preventDefault()

    try {
      const isEdit = modalState.mode === 'edit' && modalState.type === 'shipping'
      const savedZone = await apiRequest(
        isEdit ? `/shipping-zones/${modalState.item._id}` : '/shipping-zones',
        {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(shippingForm),
      })

      setShippingZones((current) =>
        isEdit
          ? current.map((zone) => (zone._id === savedZone._id ? savedZone : zone))
          : [savedZone, ...current],
      )
      setShippingForm(emptyShippingForm)
      closeModal()
      showSuccess(isEdit ? 'Destino actualizado correctamente.' : 'Destino creado correctamente.')
    } catch (error) {
      setDashboardMessage(error.message)
    }
  }

  async function handleOtherShippingSubmit(event) {
    event.preventDefault()

    try {
      const price = Number(otherShippingPrice)

      if (Number.isNaN(price) || price < 0) {
        throw new Error('Ingresa un valor válido para Otra ciudad.')
      }

      const savedZone = await apiRequest(
        fallbackShippingZone ? `/shipping-zones/${fallbackShippingZone._id}` : '/shipping-zones',
        {
          method: fallbackShippingZone ? 'PUT' : 'POST',
          body: JSON.stringify({
            place: 'Otra',
            price,
            eta: fallbackShippingZone?.eta || '',
            isFallback: true,
          }),
        },
      )

      setShippingZones((current) => {
        const withoutFallback = current.filter((zone) => !isFallbackShippingZone(zone))
        return [savedZone, ...withoutFallback]
      })
      showSuccess('Valor de Otra ciudad actualizado correctamente.')
    } catch (error) {
      setDashboardMessage(error.message)
    }
  }

  async function handleTrackingSubmit(event) {
    event.preventDefault()

    try {
      const updatedOrder = await apiRequest(`/orders/${modalState.item._id}/tracking`, {
        method: 'PUT',
        body: JSON.stringify(trackingForm),
      })

      setOrders((current) =>
        current.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      )
      closeModal()
      showSuccess('Seguimiento agregado y correo enviado al cliente.')
    } catch (error) {
      setDashboardMessage(error.message)
    }
  }

  async function handleCouponSubmit(event) {
    event.preventDefault()

    try {
      if (!couponForm.productIds.length) {
        throw new Error('Selecciona al menos una publicación para este cupón.')
      }

      const discountValue = Number(couponForm.discountValue)

      if (Number.isNaN(discountValue) || discountValue <= 0) {
        throw new Error('Ingresa un valor de descuento válido.')
      }

      if (couponForm.discountType === 'percentage' && discountValue > 100) {
        throw new Error('El descuento porcentual no puede ser mayor a 100.')
      }

      const isEdit = modalState.mode === 'edit' && modalState.type === 'coupon'
      const savedCoupon = await apiRequest(isEdit ? `/coupons/${modalState.item._id}` : '/coupons', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...couponForm,
          endsAt: couponForm.hasNoExpiry ? '' : couponForm.endsAt,
          discountValue,
        }),
      })

      setCoupons((current) =>
        isEdit
          ? current.map((coupon) => (coupon._id === savedCoupon._id ? savedCoupon : coupon))
          : [savedCoupon, ...current],
      )
      setCouponForm(emptyCouponForm)
      closeModal()
      showSuccess(isEdit ? 'Cupón actualizado correctamente.' : 'Cupón creado correctamente.')
    } catch (error) {
      setDashboardMessage(error.message)
    }
  }

  async function handleDeleteItem() {
    const { type, item } = deleteState

    if (!type || !item) {
      return
    }

    const labels = {
      category: 'esta categoría',
      product: 'esta publicación',
      shipping: 'este destino',
      coupon: 'este cupón',
    }

    try {
      const paths = {
        category: `/categories/${item._id}`,
        product: `/products/${item._id}`,
        shipping: `/shipping-zones/${item._id}`,
        coupon: `/coupons/${item._id}`,
      }

      await apiRequest(paths[type], { method: 'DELETE' })

      if (type === 'category') {
        setCategories((current) => current.filter((category) => category._id !== item._id))
      }

      if (type === 'product') {
        setProducts((current) => current.filter((product) => product._id !== item._id))
      }

      if (type === 'shipping') {
        setShippingZones((current) => current.filter((zone) => zone._id !== item._id))
      }

      if (type === 'coupon') {
        setCoupons((current) => current.filter((coupon) => coupon._id !== item._id))
      }

      closeDeleteModal()
      showSuccess('Registro eliminado correctamente.')
    } catch (error) {
      setDashboardMessage(error.message)
    }
  }

  async function handleSendMarketingEmail() {
    try {
      if (!selectedMarketingCustomerIds.length) {
        throw new Error('Selecciona al menos un cliente para enviar la campaña.')
      }

      if (!marketingForm.subject.trim() || !marketingForm.message.trim()) {
        throw new Error('Escribe asunto y mensaje para la campaña.')
      }

      setIsSendingMarketingEmail(true)

      const result = await apiRequest('/marketing/email', {
        method: 'POST',
        body: JSON.stringify({
          customerIds: selectedMarketingCustomerIds,
          subject: marketingForm.subject,
          message: marketingForm.message,
        }),
      })

      const summary = result.skippedCount
        ? `Campaña enviada a ${result.sentCount} cliente(s). ${result.skippedCount} omitido(s) por falta de Brevo.`
        : `Campaña enviada a ${result.sentCount} cliente(s).`

      if (result.failed?.length) {
        setDashboardMessage(`Algunos envíos fallaron: ${result.failed.map((item) => item.email).join(', ')}`)
      } else {
        setDashboardMessage('')
      }

      showSuccess(summary)
    } catch (error) {
      setDashboardMessage(error.message)
    } finally {
      setIsSendingMarketingEmail(false)
    }
  }

  function handleToggleAllMarketingCustomers() {
    if (areAllVisibleMarketingCustomersSelected) {
      setSelectedMarketingCustomerIds((current) =>
        current.filter(
          (customerId) => !filteredMarketingCustomers.some((customer) => customer._id === customerId),
        ),
      )
      return
    }

    setSelectedMarketingCustomerIds((current) => {
      const next = new Set(current)
      filteredMarketingCustomers.forEach((customer) => next.add(customer._id))
      return [...next]
    })
  }

  function handleToggleAllCouponProducts(checked) {
    setCouponForm((current) => ({
      ...current,
      productIds: checked ? products.map((product) => product._id) : [],
    }))

    if (checked) {
      setCouponCategorySelection('')
    }
  }

  function handleCouponCategorySelection(categoryId) {
    setCouponCategorySelection(categoryId)

    if (!categoryId) {
      return
    }

    const categoryProductIds = products
      .filter((product) => product.category?._id === categoryId)
      .map((product) => product._id)

    setCouponForm((current) => ({
      ...current,
      productIds: categoryProductIds,
    }))
  }

  function renderModal() {
    if (!modalState.type) {
      return null
    }

    const isEdit = modalState.mode === 'edit'

    if (modalState.type === 'category') {
      return (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Categorías</p>
                <h3>{isEdit ? 'Modificar categoría' : 'Crear nueva categoría'}</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>Cerrar</button>
            </div>
            <form className="stack-form" onSubmit={handleCategorySubmit}>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ej. Nicho árabe"
              />
              <textarea
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Describe el enfoque de esta categoría"
                rows="4"
              />
              <button type="submit">{isEdit ? 'Guardar cambios' : 'Crear categoría'}</button>
            </form>
          </div>
        </div>
      )
    }

    if (modalState.type === 'product') {
      return (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card modal-card--wide" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Publicaciones</p>
                <h3>{isEdit ? 'Modificar publicación' : 'Crear nueva publicación'}</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>Cerrar</button>
            </div>
            <form className="grid-form" onSubmit={handleProductSubmit}>
              <label className="toggle-field">
                <span>Nombre del perfume</span>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Nombre del perfume"
                />
              </label>
              <label className="toggle-field">
                <span>Categoría</span>
                <select
                  value={productForm.categoryId}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, categoryId: event.target.value }))
                  }
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label className="toggle-field">
                <span>Precio base</span>
                <input
                  type="number"
                  min="0"
                  value={productForm.basePrice}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, basePrice: event.target.value }))
                  }
                  placeholder="Precio base COP"
                />
              </label>
              <label className="toggle-field">
                <span>Precio de oferta</span>
                <input
                  type="number"
                  min="0"
                  value={productForm.offerPrice}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, offerPrice: event.target.value }))
                  }
                  placeholder="Precio oferta COP"
                />
              </label>
              <label className="toggle-field">
                <span>Stock disponible</span>
                <input
                  type="number"
                  min="0"
                  value={productForm.stock}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, stock: event.target.value }))
                  }
                  placeholder="Stock disponible"
                />
              </label>
              <label className="toggle-field">
                <span>Rating</span>
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={productForm.rating}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, rating: event.target.value }))
                  }
                  placeholder="Rating de 0 a 5"
                />
              </label>
              <label className="toggle-field">
                <span>Número de reseñas</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.reviewCount}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, reviewCount: event.target.value }))
                  }
                  placeholder="Número de reseñas"
                />
              </label>
              <label className="file-dropzone">
                <span>Subir imágenes</span>
                <strong>
                  {productFiles.length
                    ? 'Vista previa de las imágenes seleccionadas'
                    : 'Selecciona una o varias imágenes'}
                </strong>
                <div className="file-dropzone__action" role="button" tabIndex="0">
                  Elegir imágenes
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setProductFiles(Array.from(event.target.files || []))}
                />
              </label>
              {productFilePreviewUrls.length ? (
                <div className="uploaded-preview-grid uploaded-preview-grid--pending">
                  {productFilePreviewUrls.map((file, index) => (
                    <div key={file.previewUrl} className="uploaded-preview-card">
                      <button
                        type="button"
                        className="uploaded-preview__remove"
                        aria-label={`Borrar ${file.fileName}`}
                        onClick={() => handleRemovePendingProductFile(index)}
                      >
                        x
                      </button>
                      <img src={file.previewUrl} alt={file.fileName} className="uploaded-preview" />
                    </div>
                  ))}
                </div>
              ) : null}
              <label className="toggle-field grid-form__field--wide">
                <span>Descripción</span>
                <textarea
                  value={productForm.description}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Resumen olfativo o comercial"
                  rows="4"
                />
              </label>
              <div className="uploaded-preview-grid">
                {productForm.imageUrls.map((imageUrl) => (
                  <div key={imageUrl} className="uploaded-preview-card">
                    <button
                      type="button"
                      className="uploaded-preview__remove"
                      aria-label="Borrar imagen subida"
                      onClick={() => handleRemoveUploadedProductImage(imageUrl)}
                      disabled={deletingImageUrl === imageUrl}
                    >
                      {deletingImageUrl === imageUrl ? '...' : 'x'}
                    </button>
                    <img src={imageUrl} alt="Vista previa del perfume" className="uploaded-preview" />
                  </div>
                ))}
              </div>
              <button type="submit" disabled={isUploadingImages || Boolean(deletingImageUrl)}>
                {isUploadingImages
                  ? 'Subiendo imágenes...'
                  : isEdit
                    ? 'Guardar cambios'
                    : 'Crear publicación'}
              </button>
            </form>
          </div>
        </div>
      )
    }

    if (modalState.type === 'tracking') {
      return (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Órdenes</p>
                <h3>Añadir número de seguimiento</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>Cerrar</button>
            </div>
            <form className="stack-form" onSubmit={handleTrackingSubmit}>
              <input
                type="text"
                value={trackingForm.shippingCarrier}
                onChange={(event) =>
                  setTrackingForm((current) => ({ ...current, shippingCarrier: event.target.value }))
                }
                placeholder="Transportadora"
              />
              <input
                type="text"
                value={trackingForm.trackingNumber}
                onChange={(event) =>
                  setTrackingForm((current) => ({ ...current, trackingNumber: event.target.value }))
                }
                placeholder="Número de seguimiento"
              />
              <button type="submit">Guardar y notificar</button>
            </form>
          </div>
        </div>
      )
    }

    if (modalState.type === 'coupon') {
      return (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card modal-card--wide" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Cupones</p>
                <h3>{isEdit ? 'Modificar cupón' : 'Crear nuevo cupón'}</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>Cerrar</button>
            </div>
            <form className="grid-form" onSubmit={handleCouponSubmit}>
              <input
                type="text"
                value={couponForm.name}
                onChange={(event) =>
                  setCouponForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Nombre del cupón"
              />
              <select
                value={couponForm.discountType}
                onChange={(event) =>
                  setCouponForm((current) => ({ ...current, discountType: event.target.value }))
                }
              >
                <option value="percentage">Descuento porcentual</option>
                <option value="fixed">Descuento fijo en COP</option>
              </select>
              <input
                type="number"
                min="0"
                value={couponForm.discountValue}
                onChange={(event) =>
                  setCouponForm((current) => ({ ...current, discountValue: event.target.value }))
                }
                placeholder={couponForm.discountType === 'percentage' ? 'Porcentaje de descuento' : 'Valor fijo en COP'}
              />
              <label className="toggle-field">
                <span>Fecha inicial</span>
                <input
                  type="date"
                  value={couponForm.startsAt}
                  onChange={(event) =>
                    setCouponForm((current) => ({ ...current, startsAt: event.target.value }))
                  }
                />
              </label>
              <label className="toggle-field">
                <span>Fecha final</span>
                <input
                  type="date"
                  value={couponForm.endsAt}
                  onChange={(event) =>
                    setCouponForm((current) => ({
                      ...current,
                      endsAt: event.target.value,
                      hasNoExpiry: event.target.value ? false : current.hasNoExpiry,
                    }))
                  }
                />
              </label>
              <label className={couponForm.hasNoExpiry ? 'selector-toggle selector-toggle--active' : 'selector-toggle'}>
                <input
                  type="checkbox"
                  checked={couponForm.hasNoExpiry}
                  onChange={(event) =>
                    setCouponForm((current) => ({
                      ...current,
                      hasNoExpiry: event.target.checked,
                      endsAt: event.target.checked ? '' : current.endsAt,
                    }))
                  }
                />
                <span className="selector-checkmark" aria-hidden="true" />
                <span>Sin fecha de caducidad</span>
              </label>
              <div className="product-selector">
                <p className="eyebrow">Publicaciones activas</p>
                <div className="product-selector__controls">
                  <label className={areAllCouponProductsSelected ? 'selector-toggle selector-toggle--active' : 'selector-toggle'}>
                    <input
                      type="checkbox"
                      checked={areAllCouponProductsSelected}
                      onChange={(event) => handleToggleAllCouponProducts(event.target.checked)}
                    />
                    <span className="selector-checkmark" aria-hidden="true" />
                    <span>Seleccionar todas las publicaciones</span>
                  </label>
                  <label className="product-selector__category-field">
                    <span>Seleccionar una categoría</span>
                    <select
                      value={couponCategorySelection}
                      onChange={(event) => handleCouponCategorySelection(event.target.value)}
                    >
                      <option value="">Selecciona una categoría</option>
                      {categories.map((category) => (
                        <option key={category._id} value={category._id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="product-selector__grid">
                  {products.map((product) => {
                    const checked = couponForm.productIds.includes(product._id)

                    return (
                      <label key={product._id} className={checked ? 'selector-chip selector-chip--active' : 'selector-chip'}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setCouponForm((current) => ({
                              ...current,
                              productIds: event.target.checked
                                ? [...new Set([...current.productIds, product._id])]
                                : current.productIds.filter((productId) => productId !== product._id),
                            }))
                          }
                        />
                        <span className="selector-checkmark" aria-hidden="true" />
                        <strong>{product.name}</strong>
                        <span>{formatCurrency(product.offerPrice)}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <button type="submit">{isEdit ? 'Guardar cambios' : 'Crear cupón'}</button>
            </form>
          </div>
        </div>
      )
    }

    return (
      <div className="modal-backdrop" onClick={closeModal}>
        <div className="modal-card" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <div>
              <p className="eyebrow">Envíos</p>
              <h3>{isEdit ? 'Modificar destino' : 'Crear nuevo destino'}</h3>
            </div>
            <button type="button" className="modal-close" onClick={closeModal}>Cerrar</button>
          </div>
          <form className="stack-form" onSubmit={handleShippingSubmit}>
            <input
              type="text"
              value={shippingForm.place}
              onChange={(event) =>
                setShippingForm((current) => ({ ...current, place: event.target.value }))
              }
              placeholder="Ciudad o zona"
            />
            <input
              type="number"
              min="0"
              value={shippingForm.price}
              onChange={(event) =>
                setShippingForm((current) => ({ ...current, price: event.target.value }))
              }
              placeholder="Costo de envío"
            />
            <button type="submit">{isEdit ? 'Guardar cambios' : 'Crear destino'}</button>
          </form>
        </div>
      </div>
    )
  }

  function renderDeleteModal() {
    if (!deleteState.type || !deleteState.item) {
      return null
    }

    const labels = {
      category: 'categoría',
      product: 'publicación',
      shipping: 'destino de envío',
      coupon: 'cupón',
    }

    const itemName =
      deleteState.item.name ||
      deleteState.item.place ||
      deleteState.item.trackingNumber ||
      'este registro'

    return (
      <div className="modal-backdrop" onClick={closeDeleteModal}>
        <div className="modal-card modal-card--danger" onClick={(event) => event.stopPropagation()}>
          <div className="danger-modal__icon" aria-hidden="true">
            <WarningIcon />
          </div>
          <div className="danger-modal__copy">
            <p className="eyebrow">Confirmar eliminación</p>
            <h3>Eliminar {labels[deleteState.type] || 'registro'}</h3>
            <p>
              Vas a eliminar <strong>{itemName}</strong>. Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="danger-modal__actions">
            <button type="button" className="modal-close" onClick={closeDeleteModal}>
              Cancelar
            </button>
            <button type="button" className="danger-modal__confirm" onClick={handleDeleteItem}>
              Eliminar ahora
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-shell">
        <section className="auth-hero">
          <div className="brand-mark" aria-hidden="true">
            <img src={loginBrandImageUrl} alt="" />
          </div>
          <p className="eyebrow">Portal Administrativo</p>
          <h1>Saval Fragance</h1>
          <p className="lead">
            Gestiona colecciones, inventario y reglas de envío con acceso privado.
          </p>
        </section>

        <section className="auth-panel">
          <div className="panel-copy">
            <p className="eyebrow">Acceso seguro</p>
            <h2>Inicia sesión como administrador</h2>
          </div>

          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label>
              Correo administrativo
              <input
                type="email"
                value={loginData.email}
                onChange={(event) =>
                  setLoginData((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="cfrap555@gmail.com"
              />
            </label>

            <label>
              Contraseña
              <input
                type="password"
                value={loginData.password}
                onChange={(event) =>
                  setLoginData((current) => ({ ...current, password: event.target.value }))
                }
                placeholder=""
              />
            </label>

            {loginError ? <p className="form-error">{loginError}</p> : null}

            <button type="submit">Entrar al portal</button>
          </form>
        </section>
      </main>
    )
  }

  function renderPage() {
    if (activePage === 'dashboard') {
      return (
        <section className="admin-section">
          <header className="dashboard-header">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h1 className="dashboard-title">Control administrativo</h1>
            </div>
          </header>

          <section className="stats-grid stats-grid--dashboard">
            {stats.map((item) => (
              <article key={item.label} className="stat-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </section>
        </section>
      )
    }

    if (activePage === 'categorias') {
      return (
        <section className="admin-section">
          {dashboardMessage ? <p className="status-note">{dashboardMessage}</p> : null}
          <article className="admin-card">
            <div className="section-header">
              <div className="card-heading">
                <p className="eyebrow">Módulo 01</p>
                <h3>Categorías</h3>
                <p>Crea familias para organizar el catálogo y filtrar el escaparate cliente.</p>
              </div>
              <button type="button" onClick={() => openCreateModal('category')}>
                Crear nueva categoría
              </button>
            </div>

            <div className="list-stack">
              {categories.map((category) => (
                <div key={category._id} className="list-item list-item--category">
                  <div className="list-item__content">
                    <strong>{category.name}</strong>
                    <span>{category.description || 'Sin descripción todavía.'}</span>
                  </div>
                  <div className="list-item__toolbar">
                    <button type="button" className="list-item__edit" onClick={() => openEditModal('category', category)}>
                      Modificar
                    </button>
                    <button type="button" className="list-item__delete" onClick={() => openDeleteModal('category', category)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      )
    }

    if (activePage === 'publicaciones') {
      return (
        <section className="admin-section">
          {dashboardMessage ? <p className="status-note">{dashboardMessage}</p> : null}
          <article className="admin-card">
            <div className="section-header">
              <div className="card-heading">
                <p className="eyebrow">Módulo 02</p>
                <h3>Publicaciones de perfumes</h3>
                <p>
                  Agrega productos a una categoría, define precio, stock, foto y la descripción
                  base para la tienda pública.
                </p>
              </div>
              <button type="button" onClick={() => openCreateModal('product')}>
                Crear nueva publicación
              </button>
            </div>

            <div className="table-list">
              {products.map((product) => (
                <div key={product._id} className="table-row">
                  <div className="table-row__product-copy">
                    <strong>{product.name}</strong>
                    {product.description ? (
                      <>
                        <span
                          className={
                            expandedProductDescriptions[product._id]
                              ? 'table-row__description table-row__description--expanded'
                              : 'table-row__description'
                          }
                        >
                          {product.description}
                        </span>
                        {product.description.length > 180 ? (
                          <button
                            type="button"
                            className="table-row__description-toggle"
                            onClick={() => toggleProductDescription(product._id)}
                          >
                            {expandedProductDescriptions[product._id] ? 'Ver menos' : 'Ver más'}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className="table-row__description">Sin descripción.</span>
                    )}
                  </div>
                  <span>{product.category?.name || 'Sin categoría'}</span>
                  <span>
                    {formatCurrency(product.offerPrice)}
                    <small className="table-row__subcopy">Base {formatCurrency(product.basePrice)}</small>
                  </span>
                  <span>{product.stock || 0} und</span>
                  <div className="row-actions">
                    <button type="button" className="table-row__edit" onClick={() => openEditModal('product', product)}>
                      Modificar
                    </button>
                    <button type="button" className="table-row__delete" onClick={() => openDeleteModal('product', product)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      )
    }

    if (activePage === 'envios') {
      return (
        <section className="admin-section">
          {dashboardMessage ? <p className="status-note">{dashboardMessage}</p> : null}
          <article className="admin-card">
            <div className="section-header">
              <div className="card-heading">
                <p className="eyebrow">Módulo 03</p>
                <h3>Lugares de envío</h3>
                <p>Define destinos y el costo logistico para mostrarlos luego en checkout.</p>
              </div>
              <button type="button" onClick={() => openCreateModal('shipping')}>
                Crear nuevo destino
              </button>
            </div>

            <form className="shipping-fallback-form" onSubmit={handleOtherShippingSubmit}>
              <label className="shipping-fallback-form__field">
                <span>Valor para Otra ciudad</span>
                <input
                  type="number"
                  min="0"
                  value={otherShippingPrice}
                  onChange={(event) => setOtherShippingPrice(event.target.value)}
                  placeholder="Costo por defecto para Otra"
                />
              </label>
              <button type="submit">
                Guardar valor de Otra
              </button>
            </form>

            <div className="list-stack">
              {standardShippingZones.map((zone) => (
                <div key={zone._id} className="list-item list-item--inline">
                  <strong>{zone.place}</strong>
                  <span>{formatCurrency(zone.price)}</span>
                  <div className="row-actions row-actions--inline">
                    <button type="button" className="list-item__edit list-item__edit--inline" onClick={() => openEditModal('shipping', zone)}>
                      Modificar
                    </button>
                    <button type="button" className="list-item__delete list-item__delete--inline" onClick={() => openDeleteModal('shipping', zone)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      )
    }

    if (activePage === 'cupones') {
      return (
        <section className="admin-section">
          {dashboardMessage ? <p className="status-note">{dashboardMessage}</p> : null}
          <article className="admin-card">
            <div className="section-header">
              <div className="card-heading">
                <p className="eyebrow">Módulo 04</p>
                <h3>Cupones</h3>
                <p>
                  Crea descuentos por porcentaje o valor fijo y enlázalos a una o varias
                  publicaciones activas del catálogo.
                </p>
              </div>
              <button type="button" onClick={() => openCreateModal('coupon')}>
                Crear nuevo cupón
              </button>
            </div>

            <div className="coupon-list">
              {coupons.map((coupon) => (
                <div key={coupon._id} className="coupon-row">
                  <div>
                    <strong>{coupon.name}</strong>
                    <span>
                      {coupon.discountType === 'percentage'
                        ? `${coupon.discountValue}% de descuento`
                        : `${formatCurrency(coupon.discountValue)} de descuento`}
                    </span>
                  </div>
                  <div>
                    <strong>{getCouponStatus(coupon)}</strong>
                    <span>
                      {coupon.startsAt && coupon.endsAt
                        ? `${formatDate(coupon.startsAt)} a ${formatDate(coupon.endsAt)}`
                        : 'Sin rango definido'}
                    </span>
                  </div>
                  <div>
                    <strong>Aplica en</strong>
                    <span>{(coupon.products || []).map((product) => product.name).join(', ') || 'Sin publicaciones'}</span>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="table-row__edit" onClick={() => openEditModal('coupon', coupon)}>
                      Modificar
                    </button>
                    <button type="button" className="table-row__delete" onClick={() => openDeleteModal('coupon', coupon)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}

              {!coupons.length ? <p className="empty-state">Todavía no hay cupones creados.</p> : null}
            </div>
          </article>
        </section>
      )
    }

    if (activePage === 'ordenes') {
      return (
        <section className="admin-section">
          {dashboardMessage ? <p className="status-note">{dashboardMessage}</p> : null}
          <article className="admin-card">
            <div className="card-heading">
              <p className="eyebrow">Módulo 05</p>
              <h3>Órdenes</h3>
              <p>
                Revisa compras realizadas, confirma el estado y agrega la guía de envío para
                notificar automáticamente al cliente.
              </p>
            </div>

            <div className="order-list">
              {orders.map((order) => (
                <div key={order._id} className="order-row">
                  <div>
                    <strong>{order.product?.name || 'Producto sin referencia'}</strong>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  <div>
                    <strong>
                      {order.customer?.firstName} {order.customer?.lastName}
                    </strong>
                    <span>{order.customer?.email}</span>
                  </div>
                  <div>
                    <strong>{order.customer?.phone}</strong>
                    <span>{order.customer?.city}</span>
                  </div>
                  <div>
                    <strong>{order.status === 'shipped' ? 'Despachado' : 'Preparando'}</strong>
                    <span>
                      {order.trackingNumber
                        ? `${order.shippingCarrier} · ${order.trackingNumber}`
                        : 'Sin guía todavía'}
                    </span>
                  </div>
                  <div>
                    <strong>{formatCurrency(order.totalAmount || order.product?.offerPrice || 0)}</strong>
                    <span>
                      {order.couponName
                        ? `${order.couponName} · -${formatCurrency(order.discountAmount || 0)}`
                        : 'Sin cupón'}
                    </span>
                  </div>
                  <button type="button" className="table-row__edit" onClick={() => openTrackingModal(order)}>
                    Añadir número de seguimiento
                  </button>
                </div>
              ))}

              {!orders.length ? <p className="empty-state">Todavía no hay órdenes registradas.</p> : null}
            </div>
          </article>
        </section>
      )
    }

    if (activePage === 'marketing') {
      return (
        <section className="admin-section">
          {dashboardMessage ? <p className="status-note">{dashboardMessage}</p> : null}

          <article className="admin-card">
            <div className="card-heading">
              <p className="eyebrow">Módulo 06</p>
              <h3>Marketing</h3>
              <p>
                Filtra clientes, selecciona una audiencia y envíale campañas promocionales por
                correo o WhatsApp.
              </p>
            </div>

            <div className="marketing-toolbar">
              <input
                type="text"
                value={marketingFilter}
                onChange={(event) => setMarketingFilter(event.target.value)}
                placeholder="Filtrar por cliente, correo, teléfono, ciudad o producto"
              />
              <label className={areAllVisibleMarketingCustomersSelected ? 'marketing-select-all marketing-select-all--active' : 'marketing-select-all'}>
                <input
                  type="checkbox"
                  checked={areAllVisibleMarketingCustomersSelected}
                  onChange={handleToggleAllMarketingCustomers}
                />
                <span className="marketing-checkmark" aria-hidden="true">✓</span>
                <span>Seleccionar visibles</span>
              </label>
              <select
                value={marketingForm.channel}
                onChange={(event) =>
                  setMarketingForm((current) => ({ ...current, channel: event.target.value }))
                }
              >
                <option value="email">Enviar por email</option>
                <option value="whatsapp">Enviar por WhatsApp</option>
              </select>
              <button type="button" className="table-row__delete" onClick={() => setSelectedMarketingCustomerIds([])}>
                Limpiar selección
              </button>
            </div>

            <div className="marketing-grid">
              <div className="marketing-card marketing-card--audience">
                <div className="marketing-card__header">
                  <strong>Audiencia</strong>
                  <span>{selectedMarketingCustomerIds.length} seleccionado(s)</span>
                </div>
                <div className="marketing-customer-list">
                  {filteredMarketingCustomers.map((customer) => {
                    const selected = selectedMarketingCustomerIds.includes(customer._id)

                    return (
                      <label
                        key={customer._id}
                        className={selected ? 'marketing-customer marketing-customer--active' : 'marketing-customer'}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) =>
                            setSelectedMarketingCustomerIds((current) =>
                              event.target.checked
                                ? [...current, customer._id]
                                : current.filter((customerId) => customerId !== customer._id),
                            )
                          }
                        />
                        <div>
                          <strong>{customer.firstName} {customer.lastName}</strong>
                          <span>{customer.email}</span>
                        </div>
                        <div>
                          <strong>{customer.phone}</strong>
                          <span>{customer.product?.name || 'Sin producto ligado'}</span>
                        </div>
                      </label>
                    )
                  })}

                  {!filteredMarketingCustomers.length ? (
                    <p className="empty-state">No hay clientes que coincidan con el filtro.</p>
                  ) : null}
                </div>
              </div>

              <div className="marketing-card marketing-card--composer">
                <div className="marketing-card__header">
                  <strong>Mensaje promocional</strong>
                  <span>{marketingForm.channel === 'email' ? 'Canal email' : 'Canal WhatsApp'}</span>
                </div>
                <div className="stack-form">
                  {marketingForm.channel === 'email' ? (
                    <input
                      type="text"
                      value={marketingForm.subject}
                      onChange={(event) =>
                        setMarketingForm((current) => ({ ...current, subject: event.target.value }))
                      }
                      placeholder="Asunto del correo"
                    />
                  ) : null}
                  <textarea
                    rows="6"
                    value={marketingForm.message}
                    onChange={(event) =>
                      setMarketingForm((current) => ({ ...current, message: event.target.value }))
                    }
                    placeholder="Escribe aquí tu mensaje promocional"
                  />
                  {marketingForm.channel === 'email' ? (
                    <button type="button" onClick={handleSendMarketingEmail} disabled={isSendingMarketingEmail}>
                      {isSendingMarketingEmail ? 'Enviando correos...' : 'Enviar correo promocional'}
                    </button>
                  ) : null}
                </div>

                {marketingForm.channel === 'whatsapp' ? (
                  <div className="marketing-whatsapp">
                    <div className="marketing-card__header">
                      <strong>WhatsApp promocional</strong>
                      <span>Enlaces rápidos</span>
                    </div>
                    <div className="marketing-whatsapp__list">
                      {selectedMarketingCustomers.map((customer) => (
                        <a
                          key={customer._id}
                          className="marketing-whatsapp__link"
                          href={buildMarketingWhatsAppLink(
                            customer.phone,
                            `Hola ${customer.firstName}, ${marketingForm.message || 'tenemos una promoción especial para ti en Saval Fragance.'}`,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Enviar mensaje
                        </a>
                      ))}

                      {!selectedMarketingCustomers.length ? (
                        <p className="empty-state">Selecciona clientes para generar enlaces de WhatsApp.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        </section>
      )
    }

    return (
      <section className="admin-section">
        {dashboardMessage ? <p className="status-note">{dashboardMessage}</p> : null}
        <article className="admin-card">
          <div className="card-heading">
            <p className="eyebrow">Módulo 07</p>
            <h3>Base de datos</h3>
            <p>
              Consulta los clientes que han dejado sus datos de compra y filtra por nombre,
              correo, teléfono, ciudad o producto.
            </p>
          </div>

          <input
            type="text"
            value={customerFilter}
            onChange={(event) => setCustomerFilter(event.target.value)}
            placeholder="Filtrar por cliente, correo, teléfono, ciudad o producto"
          />

          <div className="customer-table">
            <div className="customer-table__head">
              <span>Cliente</span>
              <span>Contacto</span>
              <span>Ubicación</span>
              <span>Producto</span>
              <span>Fecha</span>
            </div>

            <div className="customer-table__body">
              {filteredCustomers.map((customer) => (
                <div key={customer._id} className="customer-row">
                  <div>
                    <strong>{customer.firstName} {customer.lastName}</strong>
                    <span>{customer.address}</span>
                  </div>
                  <div>
                    <strong>{customer.phone}</strong>
                    <span>{customer.email}</span>
                  </div>
                  <div>
                    <strong>{customer.city}</strong>
                    <span>{customer.notes || 'Sin notas'}</span>
                  </div>
                  <div>
                    <strong>{customer.product?.name || 'Compra sin producto ligado'}</strong>
                  </div>
                  <div>
                    <strong>{formatDate(customer.createdAt)}</strong>
                  </div>
                </div>
              ))}

              {!filteredCustomers.length ? (
                <p className="empty-state">Todavía no hay clientes registrados.</p>
              ) : null}
            </div>
          </div>
        </article>
      </section>
    )
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-lockup">
            <div className="brand-lockup__mark">
              <img src={sidebarBrandImageUrl} alt="Saval Fragance" />
            </div>
            <div>
              <p className="eyebrow">Admin Console</p>
              <h2>Saval Fragance</h2>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activePage === item.id ? 'sidebar-nav__item sidebar-nav__item--active' : 'sidebar-nav__item'}
                onClick={() => setActivePage(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-card">
          <span>Sesión activa</span>
          <strong>{adminEmail}</strong>
          <button type="button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <section className="dashboard-content">{renderPage()}</section>
      {renderModal()}
      {renderDeleteModal()}
      {dashboardMessage ? (
        <div className="modal-backdrop modal-backdrop--light" onClick={closeErrorModal}>
          <div className="error-modal" onClick={(event) => event.stopPropagation()}>
            <div className="danger-modal__icon" aria-hidden="true">
              <WarningIcon />
            </div>
            <p className="eyebrow">Error del servidor</p>
            <h3>{dashboardMessage}</h3>
            <button type="button" className="error-modal__button" onClick={closeErrorModal}>
              Entendido
            </button>
          </div>
        </div>
      ) : null}
      {successMessage ? (
        <div className="modal-backdrop modal-backdrop--light" onClick={closeSuccessModal}>
          <div className="success-modal" onClick={(event) => event.stopPropagation()}>
            <div className="success-modal__icon" aria-hidden="true">
              <SuccessIcon />
            </div>
            <p className="eyebrow">Operacion completada</p>
            <h3>{successMessage}</h3>
            <button type="button" className="success-modal__button" onClick={closeSuccessModal}>
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
