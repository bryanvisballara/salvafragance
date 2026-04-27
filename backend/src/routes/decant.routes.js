import { Router } from 'express'
import { asyncHandler } from '../lib/async-handler.js'
import { createHttpError } from '../lib/http-error.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import DecantSettings from '../models/DecantSettings.js'

const router = Router()

router.use(requireAuth, requireRole('admin'))

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

function normalizeSortOrder(rawSortOrder, fallbackSortOrder) {
  if (rawSortOrder === undefined || rawSortOrder === null || rawSortOrder === '') {
    return fallbackSortOrder
  }

  const sortOrder = Number(rawSortOrder)

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw createHttpError(400, 'El orden de Decants debe ser un número entero mayor o igual a 0.')
  }

  return sortOrder
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
    const settings = await getOrCreateSettings()
    const sortOrder = normalizeSortOrder(request.body?.sortOrder, settings.sortOrder)
    const uniqueKeys = new Set()

    sizes.forEach((size) => {
      const key = String(size.sizeMl)

      if (uniqueKeys.has(key)) {
        throw createHttpError(400, 'No repitas tamaños de decants con el mismo valor en ml.')
      }

      uniqueKeys.add(key)
    })

    settings.sizes = sizes
    settings.sortOrder = sortOrder
    await settings.save()

    response.json(settings.toObject())
  }),
)

export default router