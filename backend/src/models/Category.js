import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema(
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
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    hasFreeShipping: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
)

export default mongoose.model('Category', categorySchema)