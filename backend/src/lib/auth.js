import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const expiresIn = '7d'

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken(payload) {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET is required')
  }

  return jwt.sign(payload, secret, { expiresIn })
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET is required')
  }

  return jwt.verify(token, secret)
}