import { toMajor, toMinor } from '../lib/money.js';
import { logger } from '../lib/logger.js';
import {
  CouponError,
  createCoupon as createCouponRow,
  deleteCoupon as deleteCouponRow,
  getCoupon,
  listCoupons,
  quote,
  updateCoupon as updateCouponRow,
} from '../services/coupons.js';

/*
 * Coupons. The rules and the arithmetic are in services/coupons.js, which is
 * also what checkout uses — so the figure quoted here and the figure charged
 * there come from one piece of code rather than two that agreed when they were
 * written.
 */

const fail = (error, res, where) => {
  if (error instanceof CouponError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, `Error in ${where} controller`);
  return res.status(500).json({ message: 'Internal Server Error' });
};

export const validateCoupon = async (req, res) => {
  const { code, subtotal } = req.body;

  if (!code || subtotal === undefined) {
    return res.status(400).json({ message: 'Coupon code and subtotal are required.' });
  }

  try {
    const subtotalMinor = toMinor(Number(subtotal));
    const { coupon, discount } = await quote(code, subtotalMinor);

    res.status(200).json({
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      discount: toMajor(discount),
      finalTotal: toMajor(subtotalMinor - discount),
    });
  } catch (error) {
    fail(error, res, 'validateCoupon');
  }
};

/**
 * What a code is worth, before there is a cart to apply it to.
 *
 * Quoted against a zero subtotal, so a code with a minimum purchase is reported
 * as not yet applicable rather than as valid — which is what the old endpoint
 * did, and it let the storefront show a discount the checkout then refused.
 */
export const applyCoupon = async (req, res) => {
  const { code, subtotal = 0 } = req.body;

  if (!code) return res.status(400).json({ message: 'Coupon code is required.' });

  try {
    const { coupon } = await quote(code, toMinor(Number(subtotal)));

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
    fail(error, res, 'applyCoupon');
  }
};

export const createCoupon = async (req, res) => {
  try {
    res.status(201).json(await createCouponRow(req.body));
  } catch (error) {
    fail(error, res, 'createCoupon');
  }
};

export const updateCoupon = async (req, res) => {
  try {
    res.status(200).json(await updateCouponRow(req.params.couponId, req.body));
  } catch (error) {
    fail(error, res, 'updateCoupon');
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    if (!(await deleteCouponRow(req.params.couponId))) {
      return res.status(404).json({ message: 'Coupon not found.' });
    }
    res.status(200).json({ message: 'Coupon deleted successfully.' });
  } catch (error) {
    fail(error, res, 'deleteCoupon');
  }
};

export const getCoupons = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  try {
    const { coupons, total } = await listCoupons({ page, limit });

    res.status(200).json({
      coupons,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    fail(error, res, 'getCoupons');
  }
};

export const getCouponById = async (req, res) => {
  try {
    res.status(200).json(await getCoupon(req.params.couponId));
  } catch (error) {
    fail(error, res, 'getCouponById');
  }
};
