import mongoose from 'mongoose'

const partnerPayoutSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    salesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    revenueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

partnerPayoutSchema.index({ partner: 1, periodStart: 1, periodEnd: 1 }, { unique: true })

export default mongoose.model('PartnerPayout', partnerPayoutSchema)