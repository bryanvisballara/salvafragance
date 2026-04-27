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
  const passwordHash = await hashPassword(password)

  if (existingAdmin) {
    if (existingAdmin.passwordHash !== passwordHash) {
      existingAdmin.passwordHash = passwordHash
      await existingAdmin.save()
    }

    return
  }

  const adminUsers = await AdminUser.find().sort({ createdAt: 1 })

  if (adminUsers.length === 1) {
    adminUsers[0].email = normalizedEmail
    adminUsers[0].passwordHash = passwordHash
    await adminUsers[0].save()
    return
  }

  await AdminUser.create({
    email: normalizedEmail,
    passwordHash,
  })
}