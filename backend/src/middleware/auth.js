import { verifyToken } from '../lib/auth.js'
import { createHttpError } from '../lib/http-error.js'
import AdminUser from '../models/AdminUser.js'

export async function requireAuth(request, _response, next) {
  try {
    const authorization = request.headers.authorization || ''
    const [scheme, token] = authorization.split(' ')

    if (scheme !== 'Bearer' || !token) {
      throw createHttpError(401, 'Authentication required')
    }

    const payload = verifyToken(token)
    const admin = await AdminUser.findById(payload.sub).lean()

    if (!admin) {
      throw createHttpError(401, 'Invalid session')
    }

    request.admin = admin
    next()
  } catch (error) {
    next(error.status ? error : createHttpError(401, 'Invalid token'))
  }
}