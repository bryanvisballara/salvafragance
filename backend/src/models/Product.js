import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    offerPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator(value) {
          if (typeof this?.getUpdate === 'function') {
            const update = this.getUpdate() || {}
            const nextBasePrice = Number(update.basePrice ?? update.$set?.basePrice)

            if (Number.isFinite(nextBasePrice)) {
              return nextBasePrice > value
            }
          }

          return this.basePrice > value
        },
        message: 'Base price must be greater than offer price',
      },
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviewCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    imageUrls: {
      type: [String],
      default: [],
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

productSchema.virtual('price').get(function getPrice() {
  return this.offerPrice
})

productSchema.virtual('imageUrl').get(function getImageUrl() {
  return this.imageUrls[0] || ''
})

productSchema.set('toJSON', { virtuals: true })
productSchema.set('toObject', { virtuals: true })

export default mongoose.model('Product', productSchema)