import { generateCustomDocumentPDF } from '../lib/invoiceGenerator.js';

/**
 * POST /api/admin/documents/generate
 * Generate a custom invoice, receipt, or quotation PDF from manual line items.
 */
export const generateCustomDocument = async (req, res) => {
  try {
    const {
      documentType,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      items,
      sections,
      notes,
      validityDays,
      depositPercent,
      totalAmount,
      amountPaid,
    } = req.body;

    // Validate
    if (!documentType || !['invoice', 'receipt', 'quotation'].includes(documentType.toLowerCase())) {
      return res.status(400).json({ message: 'documentType must be invoice, receipt, or quotation' });
    }

    // Quotations can use sections instead of flat items
    const isQuotation = documentType.toLowerCase() === 'quotation';
    const hasSections = sections && Array.isArray(sections) && sections.length > 0;

    if (!hasSections && (!items || !Array.isArray(items) || items.length === 0)) {
      return res.status(400).json({ message: 'At least one line item (or section for quotations) is required' });
    }

    // Validate flat items if provided
    if (items && Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.description || typeof item.description !== 'string' || !item.description.trim()) {
          return res.status(400).json({ message: `Item ${i + 1}: description is required` });
        }
        if (item.price == null || isNaN(Number(item.price)) || Number(item.price) < 0) {
          return res.status(400).json({ message: `Item ${i + 1}: price must be a non-negative number` });
        }
        if (item.quantity != null && (isNaN(Number(item.quantity)) || Number(item.quantity) < 1)) {
          return res.status(400).json({ message: `Item ${i + 1}: quantity must be at least 1` });
        }
      }
    }

    // Validate sections if provided
    if (hasSections) {
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        if (!s.name || typeof s.name !== 'string' || !s.name.trim()) {
          return res.status(400).json({ message: `Section ${i + 1}: name is required` });
        }
        if (!s.items || !Array.isArray(s.items) || s.items.length === 0) {
          return res.status(400).json({ message: `Section "${s.name}": at least one item is required` });
        }
        for (let j = 0; j < s.items.length; j++) {
          const item = s.items[j];
          if (!item.description || typeof item.description !== 'string' || !item.description.trim()) {
            return res.status(400).json({ message: `Section "${s.name}", Item ${j + 1}: description is required` });
          }
          if (item.price == null || isNaN(Number(item.price)) || Number(item.price) < 0) {
            return res.status(400).json({ message: `Section "${s.name}", Item ${j + 1}: price must be a non-negative number` });
          }
        }
      }
    }

    // Build a document number: DOC-<type prefix>-<timestamp>
    const prefix = documentType.substring(0, 3).toUpperCase();
    const documentNumber = `${prefix}-${Date.now()}`;

    await generateCustomDocumentPDF(
      {
        documentType,
        documentNumber,
        clientName: clientName?.trim(),
        clientEmail: clientEmail?.trim(),
        clientPhone: clientPhone?.trim(),
        clientAddress: clientAddress?.trim(),
        items: items ? items.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          price: Number(it.price),
        })) : [],
        sections: hasSections ? sections.map(s => ({
          name: s.name.trim(),
          items: s.items.map(it => ({
            description: it.description.trim(),
            quantity: Number(it.quantity) || 1,
            price: Number(it.price),
          })),
        })) : undefined,
        notes: notes?.trim(),
        validityDays: validityDays ? Number(validityDays) : 14,
        depositPercent: depositPercent != null ? Number(depositPercent) : undefined,
        totalAmount: totalAmount != null ? Number(totalAmount) : undefined,
        amountPaid: amountPaid != null ? Number(amountPaid) : undefined,
      },
      res
    );
  } catch (error) {
    console.error('Error generating custom document:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate document' });
    }
  }
};
