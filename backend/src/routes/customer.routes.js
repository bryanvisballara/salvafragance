import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { requireAuth } from '../middleware/auth.js'
import Customer from '../models/Customer.js'

const router = Router()

router.use(requireAuth)

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    const customers = await Customer.find()
      .populate('product', 'name')
      .sort({ createdAt: -1 })
      .lean()

    response.json(customers)
  }),
)

export default router