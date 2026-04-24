import crypto from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { asyncHandler } from '../lib/async-handler.js'
import { createHttpError } from '../lib/http-error.js'
import { deleteImageByUrl, uploadImageBuffer } from '../lib/cloudinary.js'
import { requireAuth } from '../middleware/auth.js'
import Product from '../models/Product.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.use(requireAuth)

router.post(
  '/product-images',
  upload.array('images', 8),
  asyncHandler(async (request, response) => {
    const files = request.files || []

    const imageUrls = await Promise.all(
      files.map((file) =>
        uploadImageBuffer(file.buffer, `${Date.now()}-${crypto.randomUUID()}-${file.originalname}`),
      ),
    )

    response.status(201).json({ imageUrls })
  }),
)

router.delete(
  '/product-images',
  asyncHandler(async (request, response) => {
    const { imageUrl, productId } = request.body || {}

    if (!imageUrl) {
      throw createHttpError(400, 'La imagen que deseas borrar es obligatoria.')
    }

    await deleteImageByUrl(imageUrl)

    if (productId) {
      await Product.findByIdAndUpdate(productId, {
        $pull: { imageUrls: imageUrl },
      })
    }

    response.status(204).send()
  }),
)

export default router