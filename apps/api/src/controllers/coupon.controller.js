import Coupon from '../models/coupon.model.js';
import mongoose from 'mongoose';

export const validateCoupon = async (req, res) => {
  const { code, cartItems, subtotal } = req.body;

  if (!code || !cartItems || subtotal === undefined) {
    return res.status(400).json({
      message: 'Coupon code, cart items, and subtotal are required.',
    });
  }

  try {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() })
      .populate('applicableProductIds', 'name category')
      .populate('applicableCollectionIds', 'name')
      .populate('excludedProductIds', 'name')
      .populate('excludedCollectionIds', 'name');

    if (!coupon) {
      return res.status(404).json({ message: 'Invalid coupon code.' });
    }

    const validation = coupon.isValidForCart(cartItems, subtotal);

    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const discount = coupon.calculateDiscount(subtotal);

    res.status(200).json({
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      discount,
      finalTotal: Math.max(0, subtotal - discount),
    });
  } catch (error) {
    console.error('Error in validateCoupon controller:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const applyCoupon = async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: 'Coupon code is required.' });
  }

  try {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({ message: 'Invalid coupon code.' });
    }

    const now = new Date();
    if (!coupon.isActive || now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({ message: 'Coupon is not valid.' });
    }

    res.status(200).json({
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minimumPurchase: coupon.minimumPurchase,
        maximumDiscount: coupon.maximumDiscount,
      },
    });
  } catch (error) {
    console.error('Error in applyCoupon controller:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const createCoupon = async (req, res) => {
  const {
    code,
    description,
    discountType,
    discountValue,
    minimumPurchase,
    maximumDiscount,
    validFrom,
    validUntil,
    usageLimit,
    applicableCategories,
    applicableProductIds,
    applicableCollectionIds,
    excludedProductIds,
    excludedCollectionIds,
  } = req.body;

  if (!code || !discountType || !discountValue || !validUntil) {
    return res.status(400).json({
      message: 'Code, discount type, discount value, and valid until are required.',
    });
  }

  try {
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ message: 'Coupon code already exists.' });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minimumPurchase: minimumPurchase || 0,
      maximumDiscount,
      validFrom: validFrom || Date.now(),
      validUntil,
      usageLimit,
      applicableCategories: applicableCategories || [],
      applicableProductIds: applicableProductIds || [],
      applicableCollectionIds: applicableCollectionIds || [],
      excludedProductIds: excludedProductIds || [],
      excludedCollectionIds: excludedCollectionIds || [],
    });

    const savedCoupon = await newCoupon.save();

    res.status(201).json(savedCoupon);
  } catch (error) {
    console.error('Error in createCoupon controller:', error.message);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ message: 'Validation failed', errors });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateCoupon = async (req, res) => {
  const { couponId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    return res.status(400).json({ message: 'Invalid coupon ID format.' });
  }

  try {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found.' });
    }

    const updates = req.body;
    Object.keys(updates).forEach((key) => {
      if (key !== 'code' && key !== 'usageCount') {
        coupon[key] = updates[key];
      }
    });

    const updatedCoupon = await coupon.save();
    res.status(200).json(updatedCoupon);
  } catch (error) {
    console.error('Error in updateCoupon controller:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const deleteCoupon = async (req, res) => {
  const { couponId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    return res.status(400).json({ message: 'Invalid coupon ID format.' });
  }

  try {
    const coupon = await Coupon.findByIdAndDelete(couponId);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found.' });
    }

    res.status(200).json({ message: 'Coupon deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteCoupon controller:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    const totalCoupons = await Coupon.countDocuments(query);
    const coupons = await Coupon.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      coupons,
      currentPage: page,
      totalCoupons,
      hasMore: page * limit < totalCoupons,
    });
  } catch (error) {
    console.error('Error in getCoupons controller:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getCouponById = async (req, res) => {
  const { couponId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    return res.status(400).json({ message: 'Invalid coupon ID format.' });
  }

  try {
    const coupon = await Coupon.findById(couponId)
      .populate('applicableProductIds', 'name')
      .populate('applicableCollectionIds', 'name')
      .populate('excludedProductIds', 'name')
      .populate('excludedCollectionIds', 'name');

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found.' });
    }

    res.status(200).json(coupon);
  } catch (error) {
    console.error('Error in getCouponById controller:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
