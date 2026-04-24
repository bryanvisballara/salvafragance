import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import DecantSettings from '../models/DecantSettings.js'

const router = Router()

router.use(requireAuth)

function normalizeSizes(rawSizes) {
  const sizes = Array.isArray(rawSizes) ? rawSizes : []

  return sizes.map((size, index) => {
    const sizeMl = Number(size?.sizeMl)
    const label = size?.label?.trim() || `${sizeMl} ml`

    if (!Number.isFinite(sizeMl) || sizeMl <= 0) {
      throw createHttpError(400, `El tamaño del decant #${index + 1} debe ser un número mayor a 0.`)
    }

    return {
      ...(size?._id ? { _id: size._id } : {}),
      sizeMl,
      label,
    }
  })
}

async function getOrCreateSettings() {
  let settings = await DecantSettings.findOne({ key: 'default' })

  if (!settings) {
    settings = await DecantSettings.create({ key: 'default', sizes: [] })
  }

  return settings
}

router.get(
  '/',
  asyncHandler(async (_request, response) => {
    const settings = await getOrCreateSettings()
    response.json(settings.toObject())
  }),
)

router.put(
  '/',
  asyncHandler(async (request, response) => {
    const sizes = normalizeSizes(request.body?.sizes)
    const uniqueKeys = new Set()

    sizes.forEach((size) => {
      const key = String(size.sizeMl)

      if (uniqueKeys.has(key)) {
        throw createHttpError(400, 'No repitas tamaños de decants con el mismo valor en ml.')
      }

      uniqueKeys.add(key)
    })

    const settings = await getOrCreateSettings()
    settings.sizes = sizes
    await settings.save()

    response.json(settings.toObject())
  }),
)

export default router