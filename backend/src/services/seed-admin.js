import AdminUser from '../models/AdminUser.js'
import { hashPassword } from '../lib/auth.js'

async function upsertAdminUser({ email, password, role, migrateSingleAdmin = false }) {
  if (!email || !password) {
    return
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedRole = role === 'operator' ? 'operator' : 'admin'
  const passwordHash = await hashPassword(password)
  const existingUser = await AdminUser.findOne({ email: normalizedEmail })

  if (existingUser) {
    let shouldSave = false

    if (existingUser.passwordHash !== passwordHash) {
      existingUser.passwordHash = passwordHash
      shouldSave = true
    }

    if (existingUser.role !== normalizedRole) {
      existingUser.role = normalizedRole
      shouldSave = true
    }

    if (shouldSave) {
      await existingUser.save()
    }

    return
  }

  if (migrateSingleAdmin) {
    const adminUsers = await AdminUser.find().sort({ createdAt: 1 })

    if (adminUsers.length === 1 && adminUsers[0].role === 'admin') {
      adminUsers[0].email = normalizedEmail
      adminUsers[0].passwordHash = passwordHash
      adminUsers[0].role = normalizedRole
      await adminUsers[0].save()
      return
    }
  }

  await AdminUser.create({
    email: normalizedEmail,
    passwordHash,
    role: normalizedRole,
  })
}

export async function seedAdminUsers() {
  await upsertAdminUser({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: 'admin',
    migrateSingleAdmin: true,
  })

  await upsertAdminUser({
    email: process.env.OPERATOR_EMAIL,
    password: process.env.OPERATOR_PASSWORD,
    role: 'operator',
  })
}