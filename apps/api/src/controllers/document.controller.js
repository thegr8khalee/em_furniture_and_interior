import { generateCustomDocumentPDF } from '../lib/invoiceGenerator.js';
import { logger } from '../lib/logger.js';
import {
  saveCustomDocument,
  listCustomDocuments,
  getCustomDocumentById,
  updateCustomDocumentStatus,
  deleteCustomDocument,
  generateDocumentNumber,
  issueReceiptForInvoice,
  getLinkedDocuments,
} from '../services/documents.js';

/**
 * Validates document input payload.
 */
const validateDocumentPayload = (body) => {
  const { documentType, clientName, items, sections } = body;

  if (!clientName || !String(clientName).trim()) {
    return 'Client name is required';
  }

  if (!documentType || !['invoice', 'receipt', 'quotation'].includes(documentType.toLowerCase())) {
    return 'documentType must be invoice, receipt, or quotation';
  }

  const hasSections = sections && Array.isArray(sections) && sections.length > 0;
  if (!hasSections && (!items || !Array.isArray(items) || items.length === 0)) {
    return 'At least one line item (or section for quotations) is required';
  }

  if (items && Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.description || typeof item.description !== 'string' || !item.description.trim()) {
        return `Item ${i + 1}: description is required`;
      }
      if (item.price == null || isNaN(Number(item.price)) || Number(item.price) < 0) {
        return `Item ${i + 1}: price must be a non-negative number`;
      }
      if (item.quantity != null && (isNaN(Number(item.quantity)) || Number(item.quantity) < 1)) {
        return `Item ${i + 1}: quantity must be at least 1`;
      }
    }
  }

  if (hasSections) {
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (!s.name || typeof s.name !== 'string' || !s.name.trim()) {
        return `Section ${i + 1}: name is required`;
      }
      if (!s.items || !Array.isArray(s.items) || s.items.length === 0) {
        return `Section "${s.name}": at least one item is required`;
      }
      for (let j = 0; j < s.items.length; j++) {
        const item = s.items[j];
        if (!item.description || typeof item.description !== 'string' || !item.description.trim()) {
          return `Section "${s.name}", Item ${j + 1}: description is required`;
        }
        if (item.price == null || isNaN(Number(item.price)) || Number(item.price) < 0) {
          return `Section "${s.name}", Item ${j + 1}: price must be a non-negative number`;
        }
      }
    }
  }

  return null;
};

/**
 * POST /api/admin/documents/generate
 * Generate custom PDF and persist the document record.
 */
export const generateCustomDocument = async (req, res) => {
  try {
    const errorMsg = validateDocumentPayload(req.body);
    if (errorMsg) {
      return res.status(400).json({ message: errorMsg });
    }

    const {
      documentType,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      customerId,
      items,
      sections,
      notes,
      validityDays,
      depositPercent,
      totalAmount,
      amountPaid,
      discountType,
      discountValue,
      miscellaneousFee,
      projectFeeType,
      projectFeeValue,
      depositType,
      depositValue,
      relatedDocumentId,
      relatedDocumentNumber,
      paymentMethod,
      paymentReference,
      status = 'issued',
    } = req.body;

    const documentNumber = req.body.documentNumber || generateDocumentNumber(documentType);

    // Save to PostgreSQL
    const saved = await saveCustomDocument(
      {
        ...req.body,
        documentNumber,
        status,
      },
      req.admin?.id
    );

    const hasSections = sections && Array.isArray(sections) && sections.length > 0;

    res.setHeader('X-Document-Id', saved.id);
    res.setHeader('X-Document-Number', saved.documentNumber);
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition, X-Document-Id, X-Document-Number'
    );

    await generateCustomDocumentPDF(
      {
        documentType,
        documentNumber: saved.documentNumber,
        relatedDocumentNumber: saved.relatedDocumentNumber || relatedDocumentNumber,
        paymentMethod: saved.paymentMethod || paymentMethod,
        paymentReference: saved.paymentReference || paymentReference,
        clientName: clientName?.trim(),
        clientEmail: clientEmail?.trim(),
        clientPhone: clientPhone?.trim(),
        clientAddress: clientAddress?.trim(),
        items: items
          ? items.map((it) => ({
              description: it.description.trim(),
              quantity: Number(it.quantity) || 1,
              price: Number(it.price),
            }))
          : [],
        sections: hasSections
          ? sections.map((s) => ({
              name: s.name.trim(),
              items: s.items.map((it) => ({
                description: it.description.trim(),
                quantity: Number(it.quantity) || 1,
                price: Number(it.price),
              })),
            }))
          : undefined,
        notes: notes?.trim(),
        validityDays: validityDays ? Number(validityDays) : 14,
        depositPercent: depositPercent != null ? Number(depositPercent) : undefined,
        subtotal: saved.subtotal,
        totalAmount: saved.totalAmount,
        amountPaid: amountPaid != null ? Number(amountPaid) : undefined,
        discountType,
        discountValue: discountValue != null ? Number(discountValue) : undefined,
        miscellaneousFee: miscellaneousFee != null ? Number(miscellaneousFee) : undefined,
        projectFeeType,
        projectFeeValue: projectFeeValue != null ? Number(projectFeeValue) : undefined,
        depositType,
        depositValue: depositValue != null ? Number(depositValue) : undefined,
      },
      res
    );
  } catch (error) {
    logger.error({ err: error }, 'Error generating custom document');
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate document' });
    }
  }
};

/**
 * POST /api/admin/documents
 * Save or update a document draft/record without streaming PDF.
 */
export const saveDocument = async (req, res) => {
  try {
    const errorMsg = validateDocumentPayload(req.body);
    if (errorMsg) {
      return res.status(400).json({ message: errorMsg });
    }

    const saved = await saveCustomDocument(req.body, req.admin?.id);
    res.status(201).json({ message: 'Document saved successfully', document: saved });
  } catch (error) {
    logger.error({ err: error }, 'Error saving custom document');
    res.status(500).json({ message: error.message || 'Failed to save document' });
  }
};

/**
 * POST /api/admin/documents/:id/receipt
 * Issues a receipt linked directly to an invoice.
 */
export const issueReceipt = async (req, res) => {
  try {
    const { amountPaid, paymentMethod, paymentReference, notes } = req.body;
    if (!amountPaid || isNaN(Number(amountPaid)) || Number(amountPaid) <= 0) {
      return res.status(400).json({ message: 'Valid amountPaid is required' });
    }

    const result = await issueReceiptForInvoice(
      {
        invoiceId: req.params.id,
        amountPaid: Number(amountPaid),
        paymentMethod,
        paymentReference,
        notes,
        staffId: req.admin?.id,
      }
    );

    res.status(201).json({
      message: 'Receipt issued successfully',
      receipt: result.receipt,
      invoice: result.invoice,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error issuing receipt for invoice');
    res.status(error.status || 500).json({ message: error.message || 'Failed to issue receipt' });
  }
};

/**
 * GET /api/admin/documents/:id/linked
 * Get linked receipts for an invoice, or parent invoice for a receipt.
 */
export const getLinked = async (req, res) => {
  try {
    const result = await getLinkedDocuments(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.status(200).json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error getting linked documents');
    res.status(500).json({ message: 'Failed to retrieve linked documents' });
  }
};

/**
 * GET /api/admin/documents
 * List saved custom documents with pagination and filtering.
 */
export const listDocuments = async (req, res) => {
  try {
    const result = await listCustomDocuments(req.query);
    res.status(200).json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error listing custom documents');
    res.status(500).json({ message: 'Failed to retrieve documents' });
  }
};

/**
 * GET /api/admin/documents/:id
 * Get single custom document by UUID.
 */
export const getDocument = async (req, res) => {
  try {
    const document = await getCustomDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.status(200).json({ document });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching custom document');
    res.status(500).json({ message: 'Failed to fetch document' });
  }
};

/**
 * GET /api/admin/documents/:id/pdf
 * Re-download PDF for a previously saved custom document.
 */
export const downloadSavedDocumentPDF = async (req, res) => {
  try {
    const document = await getCustomDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const {
      documentType,
      documentNumber,
      relatedDocumentNumber,
      paymentMethod,
      paymentReference,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      notes,
      validityDays,
      depositPercent,
      subtotal,
      totalAmount,
      amountPaid,
      discountType,
      discountValue,
      projectFeeType,
      projectFeeValue,
      depositType,
      depositValue,
      items = [],
      sections = [],
    } = document;

    const hasSections = Array.isArray(sections) && sections.length > 0;

    res.setHeader('X-Document-Id', document.id);
    res.setHeader('X-Document-Number', document.documentNumber);
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition, X-Document-Id, X-Document-Number'
    );

    await generateCustomDocumentPDF(
      {
        documentType,
        documentNumber,
        relatedDocumentNumber,
        paymentMethod,
        paymentReference,
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        items,
        sections: hasSections ? sections : undefined,
        notes,
        validityDays,
        depositPercent,
        subtotal,
        totalAmount,
        amountPaid,
        discountType,
        discountValue,
        projectFeeType,
        projectFeeValue,
        depositType,
        depositValue,
      },
      res
    );
  } catch (error) {
    logger.error({ err: error }, 'Error downloading saved document PDF');
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to download document PDF' });
    }
  }
};

/**
 * PATCH /api/admin/documents/:id/status
 * Update saved document status.
 */
export const updateDocumentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const updated = await updateCustomDocumentStatus(req.params.id, status);
    res.status(200).json({ message: 'Document status updated', document: updated });
  } catch (error) {
    logger.error({ err: error }, 'Error updating document status');
    res.status(error.status || 500).json({ message: error.message || 'Failed to update status' });
  }
};

/**
 * DELETE /api/admin/documents/:id
 * Delete saved document.
 */
export const deleteDocument = async (req, res) => {
  try {
    const deleted = await deleteCustomDocument(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting custom document');
    res.status(error.status || 500).json({ message: error.message || 'Failed to delete document' });
  }
};
