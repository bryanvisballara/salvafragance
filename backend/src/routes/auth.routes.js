import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { signToken, verifyPassword } from '../lib/auth.js'
import { createHttpError } from '../lib/http-error.js'
import AdminUser from '../models/AdminUser.js'

const router = Router()

router.post(
  '/login',
  asyncHandler(async (request, response) => {
    const email = request.body.email?.trim().toLowerCase()
    const password = request.body.password || ''

    if (!email || !password) {
      throw createHttpError(400, 'Email and password are required')
    }

    const admin = await AdminUser.findOne({ email })

    if (!admin) {
      throw createHttpError(401, 'Invalid credentials')
    }

    const isValidPassword = await verifyPassword(password, admin.passwordHash)

    if (!isValidPassword) {
      throw createHttpError(401, 'Invalid credentials')
    }

    response.json({
      token: signToken({ sub: admin.id, email: admin.email, role: admin.role }),
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name || '',
        role: admin.role,
      },
    })
  }),
)

export default router