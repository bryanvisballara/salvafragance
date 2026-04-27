import AdminUser from '../models/AdminUser.js'
import { hashPassword } from '../lib/auth.js'

async function upsertAdminUser({ email, password, role, name = '', migrateSingleAdmin = false }) {
  if (!email || !password) {
    return
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedRole = role === 'operator' || role === 'partner' ? role : 'admin'
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

    if ((existingUser.name || '') !== name.trim()) {
      existingUser.name = name.trim()
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
      adminUsers[0].name = name.trim()
      await adminUsers[0].save()
      return
    }
  }

  await AdminUser.create({
    email: normalizedEmail,
    name: name.trim(),
    passwordHash,
    role: normalizedRole,
  })
}

export async function seedAdminUsers() {
  await upsertAdminUser({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME || 'Administrador Saval',
    role: 'admin',
    migrateSingleAdmin: true,
  })

  await upsertAdminUser({
    email: process.env.OPERATOR_EMAIL,
    password: process.env.OPERATOR_PASSWORD,
    name: process.env.OPERATOR_NAME || 'Operario Saval',
    role: 'operator',
  })

  await upsertAdminUser({
    email: process.env.PARTNER_EMAIL,
    password: process.env.PARTNER_PASSWORD,
    name: process.env.PARTNER_NAME || 'Socio de prueba',
    role: 'partner',
  })
}