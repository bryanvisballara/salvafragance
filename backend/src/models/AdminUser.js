import mongoose from 'mongoose'

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: '',
      trim: true,
    },
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
      enum: ['admin', 'operator', 'partner'],
      default: 'admin',
    },
    assignedCoupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    commissionType: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed',
    },
    commissionAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
)

export default mongoose.model('AdminUser', adminUserSchema)