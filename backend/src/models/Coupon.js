import mongoose from 'mongoose'

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    products: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Product',
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0
        },
        message: 'Coupon must apply to at least one product',
      },
    },
    discountType: {
      type: String,
      required: true,
      enum: ['percentage', 'fixed'],
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

export default mongoose.model('Coupon', couponSchema)