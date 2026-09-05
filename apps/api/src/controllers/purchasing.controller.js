import { logger } from '../lib/logger.js';
import {
  PurchasingError,
  approveExpense,
  cancelPurchaseOrder,
  createExpense,
  createPurchaseOrder,
  createVendor,
  getExpense,
  getPurchaseOrder,
  listExpenses,
  listPurchaseOrders,
  listVendors,
  payExpense,
  payablesAgeing,
  receivePurchaseOrder,
  removeVendor,
  sendPurchaseOrder,
  updateVendor,
  voidExpense,
} from '../services/purchasing.js';

/*
 * The buying side, over HTTP.
 *
 * Thin on purpose: every rule about what may be approved, paid or received
 * lives in the service, next to the SQL and inside the transaction that posts
 * it. These handlers parse, delegate and shape a response.
 */

const fail = (error, res, where) => {
  if (error instanceof PurchasingError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error({ err: error }, where);
  return res.status(500).json({ message: 'Server error' });
};

const paged = (req) => ({
  page: Math.max(parseInt(req.query.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200),
});

// --- vendors ---------------------------------------------------------------

export const getVendors = async (req, res) => {
  try {
    res.json({ success: true, vendors: await listVendors({ activeOnly: req.query.active === 'true' }) });
  } catch (error) {
    fail(error, res, 'Error listing vendors');
  }
};

export const postVendor = async (req, res) => {
  try {
    res.status(201).json({ success: true, vendor: await createVendor(req.body) });
  } catch (error) {
    fail(error, res, 'Error creating a vendor');
  }
};

export const patchVendor = async (req, res) => {
  try {
    res.json({ success: true, vendor: await updateVendor(req.params.vendorId, req.body) });
  } catch (error) {
    fail(error, res, 'Error updating a vendor');
  }
};

export const deleteVendor = async (req, res) => {
  try {
    const result = await removeVendor(req.params.vendorId);
    if (!result.removed) return res.status(404).json({ message: 'Vendor not found.' });

    res.json({
      success: true,
      deactivated: result.deactivated,
      message: result.deactivated
        ? 'This vendor has history, so it was deactivated rather than deleted.'
        : 'Vendor deleted.',
    });
  } catch (error) {
    fail(error, res, 'Error removing a vendor');
  }
};

// --- expenses --------------------------------------------------------------

export const getExpenses = async (req, res) => {
  const { page, limit } = paged(req);

  try {
    const { expenses, total, totalValue } = await listExpenses({
      page,
      limit,
      status: req.query.status || null,
      vendorId: req.query.vendor || null,
      from: req.query.from || null,
      to: req.query.to || null,
    });

    res.json({
      success: true,
      expenses,
      totalValue,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    fail(error, res, 'Error listing expenses');
  }
};

export const getOneExpense = async (req, res) => {
  try {
    res.json({ success: true, expense: await getExpense(req.params.expenseId) });
  } catch (error) {
    fail(error, res, 'Error loading an expense');
  }
};

export const postExpense = async (req, res) => {
  try {
    const expense = await createExpense(req.body, req.admin?.id ?? null);
    res.status(201).json({ success: true, expense });
  } catch (error) {
    fail(error, res, 'Error recording an expense');
  }
};

export const postExpenseApproval = async (req, res) => {
  try {
    const expense = await approveExpense(req.params.expenseId, req.admin?.id ?? null);
    res.json({ success: true, expense, message: `${expense.expenseNumber} approved.` });
  } catch (error) {
    fail(error, res, 'Error approving an expense');
  }
};

export const postExpensePayment = async (req, res) => {
  try {
    const expense = await payExpense(req.params.expenseId, {
      paymentMethod: req.body?.paymentMethod,
      paidOn: req.body?.paidOn ?? null,
    });
    res.json({ success: true, expense, message: `${expense.expenseNumber} paid.` });
  } catch (error) {
    fail(error, res, 'Error paying an expense');
  }
};

export const postExpenseVoid = async (req, res) => {
  try {
    res.json({ success: true, expense: await voidExpense(req.params.expenseId) });
  } catch (error) {
    fail(error, res, 'Error voiding an expense');
  }
};

export const getPayables = async (req, res) => {
  try {
    res.json({ success: true, payables: await payablesAgeing() });
  } catch (error) {
    fail(error, res, 'Error building the payables ageing');
  }
};

// --- purchase orders -------------------------------------------------------

export const getPurchaseOrders = async (req, res) => {
  const { page, limit } = paged(req);

  try {
    const { purchaseOrders, total } = await listPurchaseOrders({
      page,
      limit,
      status: req.query.status || null,
      vendorId: req.query.vendor || null,
    });

    res.json({
      success: true,
      purchaseOrders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    fail(error, res, 'Error listing purchase orders');
  }
};

export const getOnePurchaseOrder = async (req, res) => {
  try {
    res.json({ success: true, purchaseOrder: await getPurchaseOrder(req.params.orderId) });
  } catch (error) {
    fail(error, res, 'Error loading a purchase order');
  }
};

export const postPurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await createPurchaseOrder(req.body, req.admin?.id ?? null);
    res.status(201).json({ success: true, purchaseOrder });
  } catch (error) {
    fail(error, res, 'Error creating a purchase order');
  }
};

export const postPurchaseOrderSend = async (req, res) => {
  try {
    res.json({ success: true, purchaseOrder: await sendPurchaseOrder(req.params.orderId) });
  } catch (error) {
    fail(error, res, 'Error sending a purchase order');
  }
};

export const postPurchaseOrderReceipt = async (req, res) => {
  try {
    const purchaseOrder = await receivePurchaseOrder(req.params.orderId, {
      receivedOn: req.body?.receivedOn ?? null,
      staffId: req.admin?.id ?? null,
    });
    res.json({
      success: true,
      purchaseOrder,
      message: `${purchaseOrder.poNumber} received; stock and payables updated.`,
    });
  } catch (error) {
    fail(error, res, 'Error receiving a purchase order');
  }
};

export const postPurchaseOrderCancel = async (req, res) => {
  try {
    res.json({ success: true, purchaseOrder: await cancelPurchaseOrder(req.params.orderId) });
  } catch (error) {
    fail(error, res, 'Error cancelling a purchase order');
  }
};
