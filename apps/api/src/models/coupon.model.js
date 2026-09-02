import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumPurchase: {
      type: Number,
      default: 0,
      min: 0,
    },
    maximumDiscount: {
      type: Number,
      min: 0,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    applicableCategories: [String],
    applicableProductIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    ],
    applicableCollectionIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    ],
    excludedProductIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    ],
    excludedCollectionIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    ],
  },
  { timestamps: true }
);

couponSchema.index({ validFrom: 1, validUntil: 1, isActive: 1 });

couponSchema.methods.isValidForCart = function (cartItems, subtotal) {
  const now = new Date();

  if (!this.isActive) {
    return { valid: false, message: 'Coupon is inactive.' };
  }

  if (now < this.validFrom) {
    return { valid: false, message: 'Coupon is not yet valid.' };
  }

  if (now > this.validUntil) {
    return { valid: false, message: 'Coupon has expired.' };
  }

  if (this.usageLimit && this.usageCount >= this.usageLimit) {
    return { valid: false, message: 'Coupon usage limit reached.' };
  }

  if (subtotal < this.minimumPurchase) {
    return {
      valid: false,
      message: `Minimum purchase of ₦${this.minimumPurchase.toLocaleString()} required.`,
    };
  }

  if (
    this.applicableCategories.length > 0 ||
    this.applicableProductIds.length > 0 ||
    this.applicableCollectionIds.length > 0
  ) {
    const hasApplicableItem = cartItems.some((item) => {
      if (item.itemType === 'Product' && item.item) {
        const productId = item.item._id || item.item;
        const category = item.item.category;

        if (this.excludedProductIds.some((id) => id.equals(productId))) {
          return false;
        }

        if (
          this.applicableProductIds.length > 0 &&
          this.applicableProductIds.some((id) => id.equals(productId))
        ) {
          return true;
        }

        if (
          this.applicableCategories.length > 0 &&
          this.applicableCategories.includes(category)
        ) {
          return true;
        }
      }

      if (item.itemType === 'Collection' && item.item) {
        const collectionId = item.item._id || item.item;

        if (
          this.excludedCollectionIds.some((id) => id.equals(collectionId))
        ) {
          return false;
        }

        if (
          this.applicableCollectionIds.length > 0 &&
          this.applicableCollectionIds.some((id) => id.equals(collectionId))
        ) {
          return true;
        }
      }

      return false;
    });

    if (!hasApplicableItem) {
      return {
        valid: false,
        message: 'Coupon not applicable to cart items.',
      };
    }
  }

  return { valid: true };
};

couponSchema.methods.calculateDiscount = function (subtotal) {
  let discount = 0;

  if (this.discountType === 'percentage') {
    discount = (subtotal * this.discountValue) / 100;
    if (this.maximumDiscount && discount > this.maximumDiscount) {
      discount = this.maximumDiscount;
    }
  } else if (this.discountType === 'fixed') {
    discount = Math.min(this.discountValue, subtotal);
  }

  return Math.round(discount * 100) / 100;
};

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
