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

export function requireRole(...allowedRoles) {
  const normalizedRoles = allowedRoles
    .map((role) => String(role || '').trim().toLowerCase())
    .filter(Boolean)

  return (request, _response, next) => {
    const currentRole = String(request.admin?.role || '').trim().toLowerCase()

    if (!currentRole || !normalizedRoles.includes(currentRole)) {
      next(createHttpError(403, 'You do not have permission to access this resource'))
      return
    }

    next()
  }
}