import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import Collection from '../models/collection.model.js';
import Coupon from '../models/coupon.model.js';
import GuestSession from '../models/guest.model.js';
import User from '../models/user.model.js';
import LoyaltyTransaction from '../models/loyaltyTransaction.model.js';
import { generateInvoicePDF, generateOrderDocumentPDF } from '../lib/invoiceGenerator.js';
import { createNotification } from './notification.controller.js';
import { sendEmail } from '../services/gmail.service.js';

// Create a new order (for authenticated users and guests)
export const createOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      billingAddress,
      useSameAddressForBilling,
      couponCode,
      shippingCost,
      taxAmount,
      notes,
      paymentMethod
    } = req.body;

    // Validate required fields
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address is required' });
    }

    // Fetch item details and calculate subtotal
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      let itemDetails;
      let price;
      let name;
      let imageUrl;

      if (item.itemType === 'Product') {
        itemDetails = await Product.findById(item.item);
        if (!itemDetails) {
          return res.status(404).json({ message: `Product ${item.item} not found` });
        }
        price = itemDetails.discountedPrice || itemDetails.price;
        name = itemDetails.name;
        imageUrl = itemDetails.images?.[0];
      } else if (item.itemType === 'Collection') {
        itemDetails = await Collection.findById(item.item);
        if (!itemDetails) {
          return res.status(404).json({ message: `Collection ${item.item} not found` });
        }
        price = itemDetails.discountedPrice || itemDetails.price;
        name = itemDetails.name;
        imageUrl = itemDetails.images?.[0];
      } else {
        return res.status(400).json({ message: 'Invalid item type' });
      }

      const itemSubtotal = price * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        item: item.item,
        itemType: item.itemType,
        name,
        imageUrl,
        price,
        quantity: item.quantity,
        subtotal: itemSubtotal
      });
    }

    // Apply coupon if provided
    let discount = 0;
    let couponId = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      
      if (coupon) {
        // Validate coupon
        const validation = await coupon.isValidForCart(orderItems, subtotal);
        
        if (validation.valid) {
          discount = coupon.calculateDiscount(subtotal);
          couponId = coupon._id;

          // Increment usage count
          coupon.usageCount += 1;
          await coupon.save();
        }
      }
    }

    // Calculate total
    const totalAmount = subtotal - discount + (shippingCost || 0) + (taxAmount || 0);

    // Determine if this is a guest order and get IDs
    const isGuestOrder = !req.user;
    const userId = req.user ? req.user._id : null;
    
    // For guest orders, find or use the guest session
    let guestId = null;
    if (!req.user && req.guestSession) {
      const guestSession = await GuestSession.findOne({ anonymousId: req.guestSession.anonymousId });
      if (guestSession) {
        guestId = guestSession._id;
      }
    }

    // Create order
    const order = new Order({
      user: userId,
      guest: guestId,
      isGuestOrder,
      items: orderItems,
      shippingAddress,
      billingAddress: useSameAddressForBilling ? shippingAddress : billingAddress,
      useSameAddressForBilling,
      subtotal,
      discount,
      couponCode: couponCode?.toUpperCase() || null,
      couponId,
      shippingCost: shippingCost || 0,
      taxAmount: taxAmount || 0,
      totalAmount,
      notes: notes || '',
      paymentMethod: paymentMethod || 'whatsapp',
      status: 'pending',
      paymentStatus: 'pending'
    });

    await order.save();

    if (userId) {
      await createNotification({
        userId,
        title: 'Order placed successfully',
        message: `Your order ${order.orderNumber} has been placed and is pending confirmation.`,
        type: 'order',
        relatedOrder: order._id,
      });
    }

    // Send order confirmation email
    const recipientEmail = order.shippingAddress?.email;
    if (recipientEmail) {
      const itemsList = orderItems.map(i => `${i.name} x${i.quantity} — ₦${i.subtotal.toLocaleString()}`).join('\n');
      try {
        await sendEmail({
          to: recipientEmail,
          subject: `Order Confirmation — ${order.orderNumber}`,
          text: `Your order ${order.orderNumber} has been placed.\n\nItems:\n${itemsList}\n\nTotal: ₦${totalAmount.toLocaleString()}\n\nWe'll notify you when it ships.`,
          html: `
            <h2>Order Confirmation</h2>
            <p>Hi, your order <strong>${order.orderNumber}</strong> has been placed successfully.</p>
            <h3>Items</h3>
            <ul>${orderItems.map(i => `<li>${i.name} x${i.quantity} — ₦${i.subtotal.toLocaleString()}</li>`).join('')}</ul>
            <p><strong>Total: ₦${totalAmount.toLocaleString()}</strong></p>
            <p>We'll notify you when your order status changes.</p>
            <p>Thank you,<br/>EM Furniture and Interior Team</p>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all orders for the authenticated user
export const getMyOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (req.user) {
      query = { user: req.user._id };
    } else if (req.guestSession) {
      // For guest users, find their session and get orders
      const guestSession = await GuestSession.findOne({ anonymousId: req.guestSession.anonymousId });
      if (guestSession) {
        query = { guest: guestSession._id };
      } else {
        // No guest session found, return empty array
        return res.json({
          success: true,
          orders: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0
          }
        });
      }
    } else {
      // No user or guest session
      return res.json({
        success: true,
        orders: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        }
      });
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-adminNotes -statusHistory');

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single order by ID
export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('couponId', 'code discountType discountValue')
      .select('-adminNotes');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check authorization
    const isUserOrder = req.user && order.user?.toString() === req.user._id.toString();
    
    let isGuestOrder = false;
    if (!req.user && req.guestSession) {
      const guestSession = await GuestSession.findOne({ anonymousId: req.guestSession.anonymousId });
      if (guestSession && order.guest?.toString() === guestSession._id.toString()) {
        isGuestOrder = true;
      }
    }

    if (!isUserOrder && !isGuestOrder) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get order by order number (for tracking without login)
export const getOrderByNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'Email is required for order tracking' });
    }

    const order = await Order.findOne({ 
      orderNumber,
      'shippingAddress.email': email
    }).select('-adminNotes -statusHistory');

    if (!order) {
      return res.status(404).json({ message: 'Order not found or email does not match' });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Get all orders with filters
export const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, paymentStatus, search } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.email': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName email')
      .populate('couponId', 'code');

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note, trackingNumber, trackingUrl, carrier, estimatedDeliveryDate } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update status
    if (status) {
      order.status = status;
      
      // If delivered, set delivered date
      if (status === 'delivered' && !order.deliveredAt) {
        order.deliveredAt = new Date();
      }
    }

    // Update tracking info
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (trackingUrl) order.trackingUrl = trackingUrl;
    if (carrier) order.carrier = carrier;
    if (estimatedDeliveryDate) order.estimatedDeliveryDate = new Date(estimatedDeliveryDate);

    // Add to status history
    if (note || status) {
      order.statusHistory.push({
        status: status || order.status,
        updatedBy: req.admin._id,
        timestamp: new Date(),
        note: note || ''
      });
    }

    await order.save();

    if (order.user) {
      await createNotification({
        userId: order.user,
        title: 'Order status updated',
        message: `Your order ${order.orderNumber} is now ${order.status.toUpperCase()}.`,
        type: 'order',
        relatedOrder: order._id,
      });
    }

    // Send status-update email
    const recipientEmail = order.shippingAddress?.email;
    if (recipientEmail && status) {
      try {
        const trackingInfo = trackingNumber ? `<p>Tracking: ${trackingNumber}${trackingUrl ? ` — <a href="${trackingUrl}">Track here</a>` : ''}</p>` : '';
        await sendEmail({
          to: recipientEmail,
          subject: `Order ${order.orderNumber} — ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          text: `Your order ${order.orderNumber} is now ${status}.${trackingNumber ? ` Tracking: ${trackingNumber}` : ''}`,
          html: `
            <h2>Order Status Update</h2>
            <p>Your order <strong>${order.orderNumber}</strong> is now <strong>${status.toUpperCase()}</strong>.</p>
            ${trackingInfo}
            <p>Thank you,<br/>EM Furniture and Interior Team</p>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send order status email:', emailError);
      }
    }

    if (
      status === 'delivered' &&
      order.user &&
      !order.loyaltyPointsCredited
    ) {
      const points = Math.floor(order.totalAmount / 1000);
      if (points > 0) {
        await User.findByIdAndUpdate(order.user, {
          $inc: { loyaltyPoints: points },
        });

        await LoyaltyTransaction.create({
          user: order.user,
          order: order._id,
          type: 'earn',
          points,
          description: `Points earned from order ${order.orderNumber}`,
        });

        order.loyaltyPointsEarned = points;
        order.loyaltyPointsCredited = true;
        await order.save();
      }
    }

    res.json({
      success: true,
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Update payment status
export const updatePaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus, note } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.paymentStatus = paymentStatus;

    if (note) {
      order.statusHistory.push({
        status: order.status,
        updatedBy: req.admin._id,
        timestamp: new Date(),
        note: `Payment status changed to ${paymentStatus}: ${note}`
      });
    }

    await order.save();

    // Clear cart when payment is confirmed
    if (paymentStatus === 'paid') {
      if (order.user) {
        await User.findByIdAndUpdate(order.user, { cart: [] });
      } else if (order.guest) {
        await GuestSession.findByIdAndUpdate(order.guest, { cart: [] });
      }
    }

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      order
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: Delete order
export const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByIdAndDelete(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generate invoice PDF
export const generateInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('couponId', 'code');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Generate and stream the PDF
    await generateInvoicePDF(order, res);
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generate receipt PDF (paid orders only)
export const generateReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('couponId', 'code');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Receipt available only for paid orders' });
    }

    await generateOrderDocumentPDF(order, res, 'receipt');
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generate quotation PDF
export const generateQuotation = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('couponId', 'code');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await generateOrderDocumentPDF(order, res, 'quotation');
  } catch (error) {
    console.error('Error generating quotation:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
