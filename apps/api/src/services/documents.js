import { QueryTypes } from 'sequelize';
import { getSequelize } from '../db/sequelize.js';
import { toMajor, toMinor } from '../lib/money.js';
import { isValidId } from './catalog.js';

export class DocumentServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'DocumentServiceError';
    this.status = status;
  }
}

const select = (db, sql, replacements = {}, opts = {}) =>
  db.query(sql, { replacements, type: QueryTypes.SELECT, ...opts });

const selectOne = async (db, sql, replacements = {}, opts = {}) =>
  (await select(db, sql, replacements, opts))[0] ?? null;

export const mapDocument = (row) => ({
  id: row.id,
  _id: row.id,
  documentNumber: row.document_number,
  documentType: row.document_type,
  clientName: row.client_name,
  clientEmail: row.client_email,
  clientPhone: row.client_phone,
  clientAddress: row.client_address,
  customerId: row.customer_id,
  notes: row.notes,
  validityDays: row.validity_days,
  depositPercent: row.deposit_percent != null ? Number(row.deposit_percent) : undefined,
  depositType: row.deposit_type,
  depositValue: row.deposit_value != null ? Number(row.deposit_value) : undefined,
  projectFeeType: row.project_fee_type,
  projectFeeValue: row.project_fee_value != null ? Number(row.project_fee_value) : undefined,
  discountType: row.discount_type,
  discountValue: row.discount_value != null ? Number(row.discount_value) : undefined,
  subtotal: toMajor(Number(row.subtotal_kobo) || 0),
  totalAmount: toMajor(Number(row.total_kobo) || 0),
  amountPaid: toMajor(Number(row.amount_paid_kobo) || 0),
  balance: toMajor(Number(row.balance_kobo) || 0),
  status: row.status,
  relatedDocumentId: row.related_document_id || null,
  relatedDocumentNumber: row.related_document_number || null,
  paymentMethod: row.payment_method || null,
  paymentReference: row.payment_reference || null,
  linkedReceiptCount: row.linked_receipt_count != null ? Number(row.linked_receipt_count) : 0,
  data: row.data || {},
  items: row.data?.items || [],
  sections: row.data?.sections || [],
  createdBy: row.created_by,
  createdByName: row.created_by_name || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Calculates subtotals and totals from items/sections and options.
 */
export const calculateDocumentTotals = ({
  documentType = 'invoice',
  items = [],
  sections = [],
  discountType = 'percentage',
  discountValue = 0,
  projectFeeType = 'percentage',
  projectFeeValue = 0,
  amountPaid = 0,
  totalAmount = null,
}) => {
  const isQuotation = documentType === 'quotation';
  const hasSections = Array.isArray(sections) && sections.length > 0;

  let subtotal = 0;
  if (hasSections) {
    for (const sec of sections) {
      for (const it of sec.items || []) {
        subtotal += (Number(it.price) || 0) * (Number(it.quantity) || 1);
      }
    }
  } else {
    for (const it of items || []) {
      subtotal += (Number(it.price) || 0) * (Number(it.quantity) || 1);
    }
  }

  const discountVal = Number(discountValue) || 0;
  const discountAmount =
    discountType === 'percentage'
      ? Math.round(subtotal * (discountVal / 100))
      : discountVal;

  const totalAfterDiscount = Math.max(0, subtotal - discountAmount);

  let projectFeeAmount = 0;
  if (isQuotation && Number(projectFeeValue) > 0) {
    projectFeeAmount =
      projectFeeType === 'percentage'
        ? Math.round(totalAfterDiscount * (Number(projectFeeValue) / 100))
        : Number(projectFeeValue);
  }

  const grandTotal = totalAmount != null ? Number(totalAmount) : totalAfterDiscount + projectFeeAmount;
  const paid = Number(amountPaid) || 0;
  const balance = Math.max(0, grandTotal - paid);

  return {
    subtotal,
    discountAmount,
    totalAfterDiscount,
    projectFeeAmount,
    grandTotal,
    paid,
    balance,
  };
};

/**
 * Generates a unique document number if not provided.
 */
export const generateDocumentNumber = (type = 'invoice') => {
  const prefix = type.substring(0, 3).toUpperCase();
  const timestamp = Date.now();
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${timestamp}-${randomSuffix}`;
};

/**
 * Saves a document (create or update) in PostgreSQL.
 * If a receipt is linked to an invoice, it automatically updates the parent invoice's balance and status.
 */
export const saveCustomDocument = async (payload, staffId = null, db = getSequelize()) => {
  const {
    id,
    documentType,
    clientName,
    clientEmail,
    clientPhone,
    clientAddress,
    customerId,
    items,
    sections,
    notes,
    validityDays = 14,
    depositPercent,
    depositType,
    depositValue,
    projectFeeType,
    projectFeeValue,
    discountType,
    discountValue,
    totalAmount,
    amountPaid,
    relatedDocumentId,
    relatedDocumentNumber,
    paymentMethod,
    paymentReference,
    status = 'issued',
  } = payload;

  if (!clientName || !String(clientName).trim()) {
    throw new DocumentServiceError('Client name is required');
  }

  const docType = String(documentType).toLowerCase();
  if (!['invoice', 'receipt', 'quotation'].includes(docType)) {
    throw new DocumentServiceError('Invalid documentType');
  }

  const { subtotal, grandTotal, paid, balance } = calculateDocumentTotals({
    documentType: docType,
    items,
    sections,
    discountType,
    discountValue,
    projectFeeType,
    projectFeeValue,
    amountPaid,
    totalAmount,
  });

  const subtotalKobo = toMinor(subtotal);
  const totalKobo = toMinor(grandTotal);
  const paidKobo = toMinor(paid);
  const balanceKobo = toMinor(balance);

  const dataPayload = {
    items: Array.isArray(items) ? items : [],
    sections: Array.isArray(sections) ? sections : [],
    notes: notes || '',
    validityDays: validityDays ? Number(validityDays) : 14,
    depositPercent: depositPercent != null ? Number(depositPercent) : undefined,
    depositType,
    depositValue: depositValue != null ? Number(depositValue) : undefined,
    projectFeeType,
    projectFeeValue: projectFeeValue != null ? Number(projectFeeValue) : undefined,
    discountType,
    discountValue: discountValue != null ? Number(discountValue) : undefined,
  };

  // Verify and link parent document if provided
  let relDocId = relatedDocumentId && isValidId(relatedDocumentId) ? relatedDocumentId : null;
  let relDocNumber = relatedDocumentNumber?.trim() || null;
  let parentInvoice = null;

  if (relDocId) {
    parentInvoice = await selectOne(db, 'SELECT * FROM custom_documents WHERE id = :id', { id: relDocId });
    if (parentInvoice) {
      relDocNumber = parentInvoice.document_number;
    } else {
      relDocId = null;
    }
  }

  // If updating an existing document
  if (id && isValidId(id)) {
    const existing = await selectOne(db, 'SELECT * FROM custom_documents WHERE id = :id', { id });
    if (existing) {
      const [updated] = await db.query(
        `UPDATE custom_documents
         SET client_name = :clientName,
             client_email = :clientEmail,
             client_phone = :clientPhone,
             client_address = :clientAddress,
             customer_id = :customerId,
             notes = :notes,
             validity_days = :validityDays,
             deposit_percent = :depositPercent,
             deposit_type = :depositType,
             deposit_value = :depositValue,
             project_fee_type = :projectFeeType,
             project_fee_value = :projectFeeValue,
             discount_type = :discountType,
             discount_value = :discountValue,
             subtotal_kobo = :subtotalKobo,
             total_kobo = :totalKobo,
             amount_paid_kobo = :paidKobo,
             balance_kobo = :balanceKobo,
             related_document_id = :relatedDocumentId,
             related_document_number = :relatedDocumentNumber,
             payment_method = :paymentMethod,
             payment_reference = :paymentReference,
             status = :status,
             data = :data,
             updated_at = now()
         WHERE id = :id
         RETURNING *`,
        {
          replacements: {
            id,
            clientName: clientName.trim(),
            clientEmail: clientEmail?.trim() || null,
            clientPhone: clientPhone?.trim() || null,
            clientAddress: clientAddress?.trim() || null,
            customerId: customerId && isValidId(customerId) ? customerId : null,
            notes: notes?.trim() || null,
            validityDays: Number(validityDays) || 14,
            depositPercent: depositPercent != null ? Number(depositPercent) : null,
            depositType: depositType || null,
            depositValue: depositValue != null ? Number(depositValue) : null,
            projectFeeType: projectFeeType || null,
            projectFeeValue: projectFeeValue != null ? Number(projectFeeValue) : null,
            discountType: discountType || null,
            discountValue: discountValue != null ? Number(discountValue) : null,
            subtotalKobo,
            totalKobo,
            paidKobo,
            balanceKobo,
            relatedDocumentId: relDocId,
            relatedDocumentNumber: relDocNumber,
            paymentMethod: paymentMethod?.trim() || null,
            paymentReference: paymentReference?.trim() || null,
            status,
            data: JSON.stringify(dataPayload),
          },
          type: QueryTypes.UPDATE,
        }
      );
      return mapDocument(updated[0] || updated);
    }
  }

  const documentNumber = payload.documentNumber || generateDocumentNumber(docType);

  const [inserted] = await db.query(
    `INSERT INTO custom_documents (
       document_number,
       document_type,
       client_name,
       client_email,
       client_phone,
       client_address,
       customer_id,
       notes,
       validity_days,
       deposit_percent,
       deposit_type,
       deposit_value,
       project_fee_type,
       project_fee_value,
       discount_type,
       discount_value,
       subtotal_kobo,
       total_kobo,
       amount_paid_kobo,
       balance_kobo,
       related_document_id,
       related_document_number,
       payment_method,
       payment_reference,
       status,
       data,
       created_by
     ) VALUES (
       :documentNumber,
       :documentType,
       :clientName,
       :clientEmail,
       :clientPhone,
       :clientAddress,
       :customerId,
       :notes,
       :validityDays,
       :depositPercent,
       :depositType,
       :depositValue,
       :projectFeeType,
       :projectFeeValue,
       :discountType,
       :discountValue,
       :subtotalKobo,
       :totalKobo,
       :paidKobo,
       :balanceKobo,
       :relatedDocumentId,
       :relatedDocumentNumber,
       :paymentMethod,
       :paymentReference,
       :status,
       :data,
       :staffId
     )
     RETURNING *`,
    {
      replacements: {
        documentNumber,
        documentType: docType,
        clientName: clientName.trim(),
        clientEmail: clientEmail?.trim() || null,
        clientPhone: clientPhone?.trim() || null,
        clientAddress: clientAddress?.trim() || null,
        customerId: customerId && isValidId(customerId) ? customerId : null,
        notes: notes?.trim() || null,
        validityDays: Number(validityDays) || 14,
        depositPercent: depositPercent != null ? Number(depositPercent) : null,
        depositType: depositType || null,
        depositValue: depositValue != null ? Number(depositValue) : null,
        projectFeeType: projectFeeType || null,
        projectFeeValue: projectFeeValue != null ? Number(projectFeeValue) : null,
        discountType: discountType || null,
        discountValue: discountValue != null ? Number(discountValue) : null,
        subtotalKobo,
        totalKobo,
        paidKobo,
        balanceKobo,
        relatedDocumentId: relDocId,
        relatedDocumentNumber: relDocNumber,
        paymentMethod: paymentMethod?.trim() || null,
        paymentReference: paymentReference?.trim() || null,
        status,
        data: JSON.stringify(dataPayload),
        staffId: staffId && isValidId(staffId) ? staffId : null,
      },
      type: QueryTypes.INSERT,
    }
  );

  const createdDoc = mapDocument(inserted[0] || inserted);

  // If this is a new receipt linked to an invoice, automatically update parent invoice totals and status
  if (docType === 'receipt' && parentInvoice && parentInvoice.document_type === 'invoice') {
    const paymentKobo = paidKobo > 0 ? paidKobo : totalKobo;
    const currentParentPaid = Number(parentInvoice.amount_paid_kobo) || 0;
    const parentTotal = Number(parentInvoice.total_kobo) || 0;
    const newParentPaid = currentParentPaid + paymentKobo;
    const newParentBalance = Math.max(0, parentTotal - newParentPaid);
    const newParentStatus = newParentBalance === 0 ? 'paid' : 'partially_paid';

    await db.query(
      `UPDATE custom_documents
       SET amount_paid_kobo = :newParentPaid,
           balance_kobo = :newParentBalance,
           status = :newParentStatus,
           updated_at = now()
       WHERE id = :parentInvoiceId`,
      {
        replacements: {
          parentInvoiceId: parentInvoice.id,
          newParentPaid,
          newParentBalance,
          newParentStatus,
        },
        type: QueryTypes.UPDATE,
      }
    );
  }

  return createdDoc;
};

/**
 * Issues a receipt directly for an invoice in one action.
 */
export const issueReceiptForInvoice = async (
  { invoiceId, amountPaid, paymentMethod = 'bank_transfer', paymentReference, notes, staffId },
  db = getSequelize()
) => {
  if (!invoiceId || !isValidId(invoiceId)) {
    throw new DocumentServiceError('Invalid invoice ID', 400);
  }

  const invoice = await getCustomDocumentById(invoiceId, db);
  if (!invoice) {
    throw new DocumentServiceError('Invoice not found', 404);
  }

  if (invoice.documentType !== 'invoice') {
    throw new DocumentServiceError('Can only issue a receipt for an invoice', 400);
  }

  const paymentNum = Number(amountPaid);
  if (isNaN(paymentNum) || paymentNum <= 0) {
    throw new DocumentServiceError('Amount paid must be greater than 0', 400);
  }

  const receiptDocNumber = generateDocumentNumber('receipt');
  const receipt = await saveCustomDocument(
    {
      documentType: 'receipt',
      documentNumber: receiptDocNumber,
      relatedDocumentId: invoice.id,
      relatedDocumentNumber: invoice.documentNumber,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientPhone: invoice.clientPhone,
      clientAddress: invoice.clientAddress,
      customerId: invoice.customerId,
      items: invoice.items,
      sections: invoice.sections,
      discountType: invoice.discountType,
      discountValue: invoice.discountValue,
      totalAmount: invoice.totalAmount,
      amountPaid: paymentNum,
      paymentMethod,
      paymentReference,
      notes: notes || `Payment for Invoice ${invoice.documentNumber}`,
      status: 'issued',
    },
    staffId,
    db
  );

  const updatedInvoice = await getCustomDocumentById(invoiceId, db);
  return { receipt, invoice: updatedInvoice };
};

/**
 * Gets linked documents (e.g. all receipts for an invoice, or parent invoice for a receipt).
 */
export const getLinkedDocuments = async (id, db = getSequelize()) => {
  if (!id || !isValidId(id)) return null;

  const doc = await getCustomDocumentById(id, db);
  if (!doc) return null;

  if (doc.documentType === 'invoice') {
    const receipts = await db.query(
      `SELECT d.*, s.username AS created_by_name
       FROM custom_documents d
       LEFT JOIN staff s ON s.id = d.created_by
       WHERE d.related_document_id = :id AND d.document_type = 'receipt'
       ORDER BY d.created_at ASC`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    return {
      document: doc,
      receipts: receipts.map(mapDocument),
    };
  }

  if (doc.documentType === 'receipt') {
    let parentInvoice = null;
    if (doc.relatedDocumentId) {
      parentInvoice = await getCustomDocumentById(doc.relatedDocumentId, db);
    }
    return {
      document: doc,
      parentInvoice,
    };
  }

  return { document: doc };
};

/**
 * Lists custom documents with search, type, and status filtering.
 */
export const listCustomDocuments = async (
  { page = 1, limit = 20, type, status, search },
  db = getSequelize()
) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const where = [];
  const replacements = { limit: safeLimit, offset };

  if (type && ['invoice', 'receipt', 'quotation'].includes(type.toLowerCase())) {
    where.push('d.document_type = :type');
    replacements.type = type.toLowerCase();
  }

  if (status && ['draft', 'issued', 'partially_paid', 'paid', 'cancelled'].includes(status.toLowerCase())) {
    where.push('d.status = :status');
    replacements.status = status.toLowerCase();
  }

  if (search && String(search).trim() !== '') {
    where.push(
      '(d.document_number ILIKE :search OR d.client_name ILIKE :search OR d.client_email ILIKE :search OR d.related_document_number ILIKE :search)'
    );
    replacements.search = `%${String(search).trim()}%`;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [{ count }] = await db.query(
    `SELECT count(*)::int AS count FROM custom_documents d ${whereClause}`,
    { replacements, type: QueryTypes.SELECT }
  );

  const rows = await db.query(
    `SELECT d.*, s.username AS created_by_name,
            (SELECT count(*)::int FROM custom_documents r WHERE r.related_document_id = d.id AND r.document_type = 'receipt') AS linked_receipt_count
     FROM custom_documents d
     LEFT JOIN staff s ON s.id = d.created_by
     ${whereClause}
     ORDER BY d.created_at DESC
     LIMIT :limit OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT }
  );

  return {
    documents: rows.map(mapDocument),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(count),
      pages: Math.ceil(Number(count) / safeLimit) || 1,
    },
  };
};

/**
 * Gets a single document by UUID.
 */
export const getCustomDocumentById = async (id, db = getSequelize()) => {
  if (!id || !isValidId(id)) return null;

  const row = await selectOne(
    db,
    `SELECT d.*, s.username AS created_by_name,
            (SELECT count(*)::int FROM custom_documents r WHERE r.related_document_id = d.id AND r.document_type = 'receipt') AS linked_receipt_count
     FROM custom_documents d
     LEFT JOIN staff s ON s.id = d.created_by
     WHERE d.id = :id`,
    { id }
  );

  return row ? mapDocument(row) : null;
};

/**
 * Updates document status.
 */
export const updateCustomDocumentStatus = async (id, status, db = getSequelize()) => {
  if (!id || !isValidId(id)) {
    throw new DocumentServiceError('Invalid document ID', 400);
  }

  if (!['draft', 'issued', 'partially_paid', 'paid', 'cancelled'].includes(status)) {
    throw new DocumentServiceError('Invalid status', 400);
  }

  const [updated] = await db.query(
    `UPDATE custom_documents
     SET status = :status, updated_at = now()
     WHERE id = :id
     RETURNING *`,
    { replacements: { id, status }, type: QueryTypes.UPDATE }
  );

  const row = updated[0] || updated;
  if (!row) {
    throw new DocumentServiceError('Document not found', 404);
  }

  return mapDocument(row);
};

/**
 * Deletes a document by UUID. If a linked receipt is deleted, reverts the balance on the parent invoice.
 */
export const deleteCustomDocument = async (id, db = getSequelize()) => {
  if (!id || !isValidId(id)) {
    throw new DocumentServiceError('Invalid document ID', 400);
  }

  const existing = await selectOne(db, 'SELECT * FROM custom_documents WHERE id = :id', { id });
  if (!existing) return false;

  // If this was a receipt linked to an invoice, revert the payment from parent invoice
  if (existing.document_type === 'receipt' && existing.related_document_id) {
    const parent = await selectOne(db, 'SELECT * FROM custom_documents WHERE id = :parentId', { parentId: existing.related_document_id });
    if (parent) {
      const revertedPaid = Math.max(0, Number(parent.amount_paid_kobo) - Number(existing.amount_paid_kobo));
      const revertedBalance = Math.max(0, Number(parent.total_kobo) - revertedPaid);
      const revertedStatus = revertedPaid === 0 ? 'issued' : (revertedBalance === 0 ? 'paid' : 'partially_paid');
      await db.query(
        `UPDATE custom_documents
         SET amount_paid_kobo = :revertedPaid,
             balance_kobo = :revertedBalance,
             status = :revertedStatus,
             updated_at = now()
         WHERE id = :parentId`,
        {
          replacements: {
            parentId: parent.id,
            revertedPaid,
            revertedBalance,
            revertedStatus,
          },
          type: QueryTypes.UPDATE,
        }
      );
    }
  }

  const [result] = await db.query(
    'DELETE FROM custom_documents WHERE id = :id RETURNING id',
    { replacements: { id }, type: QueryTypes.DELETE }
  );

  return Boolean(result && result.length > 0);
};
