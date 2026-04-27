import mongoose from 'mongoose'

const checkoutSessionItemSchema = new mongoose.Schema(
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
    decantSizeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { _id: true },
)

const checkoutSessionSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'voided', 'error', 'expired'],
      default: 'pending',
      index: true,
    },
    paymentProvider: {
      type: String,
      default: 'wompi',
      trim: true,
    },
    paymentMethod: {
      type: String,
      default: 'online',
      trim: true,
    },
    customer: {
      firstName: {
        type: String,
        required: true,
        trim: true,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
      },
      documentType: {
        type: String,
        default: '',
        trim: true,
      },
      documentNumber: {
        type: String,
        default: '',
        trim: true,
      },
      phoneCountryCode: {
        type: String,
        default: '+57',
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
      address: {
        type: String,
        required: true,
        trim: true,
      },
      neighborhood: {
        type: String,
        default: '',
        trim: true,
      },
      state: {
        type: String,
        default: '',
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
    },
    items: {
      type: [checkoutSessionItemSchema],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'Checkout session items are required',
      },
    },
    shippingZone: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      place: {
        type: String,
        default: '',
        trim: true,
      },
      price: {
        type: Number,
        default: 0,
        min: 0,
      },
      eta: {
        type: String,
        default: '',
        trim: true,
      },
    },
    coupon: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      name: {
        type: String,
        default: '',
        trim: true,
      },
      discountAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      eligibleProductIds: {
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
      },
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
    shippingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    surchargeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    whatsappUrl: {
      type: String,
      default: '',
      trim: true,
    },
    wompiTransactionId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    wompiStatus: {
      type: String,
      default: '',
      trim: true,
    },
    wompiPaymentMethodType: {
      type: String,
      default: '',
      trim: true,
    },
    wompiEventAt: {
      type: Date,
      default: null,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

export default mongoose.model('CheckoutSession', checkoutSessionSchema)