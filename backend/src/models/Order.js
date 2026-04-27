import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    variantLabel: {
      type: String,
      default: '',
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true },
)

const orderSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      default: '',
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    items: {
      type: [orderItemSchema],
      default: [],
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    couponName: {
      type: String,
      default: '',
      trim: true,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    partnerCouponName: {
      type: String,
      default: '',
      trim: true,
    },
    partnerCommissionAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountType: {
      type: String,
      default: '',
      trim: true,
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtotalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMethod: {
      type: String,
      default: '',
      trim: true,
    },
    shippingPlace: {
      type: String,
      default: '',
      trim: true,
    },
    shippingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingEta: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      default: 'preparing',
      enum: ['preparing', 'shipped'],
    },
    shippingCarrier: {
      type: String,
      default: '',
      trim: true,
    },
    trackingNumber: {
      type: String,
      default: '',
      trim: true,
    },
    trackingSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

export default mongoose.model('Order', orderSchema)