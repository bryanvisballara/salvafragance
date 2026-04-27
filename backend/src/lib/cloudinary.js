import { v2 as cloudinary } from 'cloudinary'

let configured = false

function getCloudinaryConfigHint() {
  return 'Verifica CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en Render.'
}

function getCloudinaryCredentials() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || '',
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() || '',
  }
}

function getPublicIdFromCloudinaryUrl(imageUrl) {
  const parsedUrl = new URL(imageUrl)
  const uploadSegment = '/upload/'
  const uploadIndex = parsedUrl.pathname.indexOf(uploadSegment)

  if (uploadIndex === -1) {
    throw new Error('Invalid Cloudinary URL')
  }

  const assetPath = parsedUrl.pathname.slice(uploadIndex + uploadSegment.length)
  const assetSegments = assetPath.split('/').filter(Boolean)

  if (!assetSegments.length) {
    throw new Error('Invalid Cloudinary URL')
  }

  const versionOffset = assetSegments[0].startsWith('v') ? 1 : 0
  const publicIdWithExtension = assetSegments.slice(versionOffset).join('/')

  if (!publicIdWithExtension) {
    throw new Error('Invalid Cloudinary URL')
  }

  return publicIdWithExtension.replace(/\.[^.]+$/, '')
}

function ensureCloudinary() {
  if (configured) {
    return
  }

  const credentials = getCloudinaryCredentials()

  if (credentials.cloudName.includes(' ')) {
    throw new Error('CLOUDINARY_CLOUD_NAME debe ser el cloud name tecnico de Cloudinary, sin espacios. ' + getCloudinaryConfigHint())
  }

  cloudinary.config({
    cloud_name: credentials.cloudName,
    api_key: credentials.apiKey,
    api_secret: credentials.apiSecret,
  })
  configured = true
}

function normalizePublicId(fileName) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

function formatCloudinaryError(operation, error) {
  const message = error?.message || `Cloudinary ${operation} failed`

  if (/invalid signature/i.test(message)) {
    return new Error(`Cloudinary rechazo la firma durante ${operation}. ${getCloudinaryConfigHint()} Detalle: ${message}`)
  }

  return new Error(`Cloudinary fallo durante ${operation}. ${message}`)
}

export async function uploadImageBuffer(fileBuffer, fileName) {
  ensureCloudinary()

  const credentials = getCloudinaryCredentials()

  if (!credentials.cloudName || !credentials.apiKey || !credentials.apiSecret) {
    throw new Error('Cloudinary credentials are missing')
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'saval-fragance/products',
        public_id: normalizePublicId(fileName),
        resource_type: 'image',
        format: 'webp',
        transformation: [
          { width: 1080, height: 1080, crop: 'fill', gravity: 'auto', quality: 'auto:good' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(formatCloudinaryError('la subida de imagenes', error))
          return
        }

        resolve(result.secure_url)
      },
    )

    stream.end(fileBuffer)
  })
}

export async function deleteImageByUrl(imageUrl) {
  ensureCloudinary()

  const credentials = getCloudinaryCredentials()

  if (!credentials.cloudName || !credentials.apiKey || !credentials.apiSecret) {
    throw new Error('Cloudinary credentials are missing')
  }

  const publicId = getPublicIdFromCloudinaryUrl(imageUrl)
  let result

  try {
    result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })
  } catch (error) {
    throw formatCloudinaryError('el borrado de imagenes', error)
  }

  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error('Cloudinary image could not be deleted')
  }
}