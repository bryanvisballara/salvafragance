import mongoose from 'mongoose'

const shippingZoneSchema = new mongoose.Schema(
  {
    place: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    eta: {
      type: String,
      default: '',
      trim: true,
    },
    isFallback: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

export default mongoose.model('ShippingZone', shippingZoneSchema)