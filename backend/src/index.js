import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { connectDatabase } from './lib/database.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import authRouter from './routes/auth.routes.js'
import categoryRouter from './routes/category.routes.js'
import productRouter from './routes/product.routes.js'
import shippingRouter from './routes/shipping.routes.js'
import publicRouter from './routes/public.routes.js'
import customerRouter from './routes/customer.routes.js'
import orderRouter from './routes/order.routes.js'
import couponRouter from './routes/coupon.routes.js'
import decantRouter from './routes/decant.routes.js'
import marketingRouter from './routes/marketing.routes.js'
import uploadRouter from './routes/upload.routes.js'
import { seedAdminUser } from './services/seed-admin.js'

const app = express()
const port = Number(process.env.PORT || 10000)

const defaultAllowedOrigins = [
  'https://savalfragance.com',
  'https://www.savalfragance.com',
  'https://salvafragance.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

const allowedOrigins = [...defaultAllowedOrigins, ...(process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)]

const normalizedAllowedOrigins = [...new Set(allowedOrigins)]

app.use(
  cors({
    origin: normalizedAllowedOrigins.length ? normalizedAllowedOrigins : true,
    credentials: true,
  }),
)
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'savalfragance-api' })
})

app.use('/api/auth', authRouter)
app.use('/api/categories', categoryRouter)
app.use('/api/products', productRouter)
app.use('/api/shipping-zones', shippingRouter)
app.use('/api/customers', customerRouter)
app.use('/api/orders', orderRouter)
app.use('/api/coupons', couponRouter)
app.use('/api/decants', decantRouter)
app.use('/api/marketing', marketingRouter)
app.use('/api/uploads', uploadRouter)
app.use('/api/storefront', publicRouter)

app.use(notFoundHandler)
app.use(errorHandler)

async function startServer() {
  await connectDatabase()
  await seedAdminUser()

  app.listen(port, () => {
    console.log(`Saval Fragance API listening on port ${port}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start API', error)
  process.exit(1)
})