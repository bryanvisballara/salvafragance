import { v2 as cloudinary } from 'cloudinary'

let configured = false

function ensureCloudinary() {
  if (configured) {
    return
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
  configured = true
}

export async function uploadImageBuffer(fileBuffer, fileName) {
  ensureCloudinary()

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials are missing')
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'saval-fragance/products',
        public_id: fileName,
        resource_type: 'image',
        format: 'webp',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'webp' },
          { width: 1600, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error)
          return
        }

        resolve(result.secure_url)
      },
    )

    stream.end(fileBuffer)
  })
}