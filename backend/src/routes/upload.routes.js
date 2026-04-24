import crypto from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { asyncHandler } from '../lib/async-handler.js'
import { requireAuth } from '../middleware/auth.js'
import { uploadImageBuffer } from '../lib/cloudinary.js'

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

export default router