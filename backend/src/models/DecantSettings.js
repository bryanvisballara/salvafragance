import mongoose from 'mongoose'

const decantSizeSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      default: '',
      trim: true,
    },
    sizeMl: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: true },
)

const decantSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    sizes: {
      type: [decantSizeSchema],
      default: [],
    },
  },
  { timestamps: true },
)

export default mongoose.model('DecantSettings', decantSettingsSchema)