import AdminUser from '../models/AdminUser.js'
import { hashPassword } from '../lib/auth.js'

export async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    return
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existingAdmin = await AdminUser.findOne({ email: normalizedEmail })

  if (existingAdmin) {
    return
  }

  const passwordHash = await hashPassword(password)

  await AdminUser.create({
    email: normalizedEmail,
    passwordHash,
  })
}