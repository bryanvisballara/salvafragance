import mongoose from 'mongoose'

const adminUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'operator'],
      default: 'admin',
    },
  },
  { timestamps: true },
)

export default mongoose.model('AdminUser', adminUserSchema)