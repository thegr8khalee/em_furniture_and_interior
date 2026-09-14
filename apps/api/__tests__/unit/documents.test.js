import { jest } from '@jest/globals';
import {
  calculateDocumentTotals,
  generateDocumentNumber,
  saveCustomDocument,
  issueReceiptForInvoice,
  getLinkedDocuments,
  listCustomDocuments,
} from '../../src/services/documents.js';
import { customDocumentHTML } from '../../src/lib/documentTemplates.js';

describe('Document Service Unit Tests', () => {
  describe('generateDocumentNumber', () => {
    it('generates a prefixed document number for invoices', () => {
      const docNum = generateDocumentNumber('invoice');
      expect(docNum).toMatch(/^INV-\d+-\d+$/);
    });

    it('generates a prefixed document number for quotations', () => {
      const docNum = generateDocumentNumber('quotation');
      expect(docNum).toMatch(/^QUO-\d+-\d+$/);
    });

    it('generates a prefixed document number for receipts', () => {
      const docNum = generateDocumentNumber('receipt');
      expect(docNum).toMatch(/^REC-\d+-\d+$/);
    });
  });

  describe('calculateDocumentTotals', () => {
    it('calculates flat item subtotal and totals correctly without discount', () => {
      const items = [
        { description: 'Dining Table', quantity: 1, price: 250000 },
        { description: 'Dining Chair', quantity: 4, price: 40000 },
      ];

      const totals = calculateDocumentTotals({
        documentType: 'invoice',
        items,
      });

      expect(totals.subtotal).toBe(410000);
      expect(totals.discountAmount).toBe(0);
      expect(totals.totalAfterDiscount).toBe(410000);
      expect(totals.grandTotal).toBe(410000);
      expect(totals.paid).toBe(0);
      expect(totals.balance).toBe(410000);
    });

    it('applies percentage discount correctly', () => {
      const items = [{ description: 'Bespoke Bed', quantity: 1, price: 500000 }];

      const totals = calculateDocumentTotals({
        documentType: 'invoice',
        items,
        discountType: 'percentage',
        discountValue: 10,
      });

      expect(totals.subtotal).toBe(500000);
      expect(totals.discountAmount).toBe(50000);
      expect(totals.totalAfterDiscount).toBe(450000);
      expect(totals.grandTotal).toBe(450000);
    });

    it('applies fixed amount discount correctly', () => {
      const items = [{ description: 'Sofa Set', quantity: 1, price: 750000 }];

      const totals = calculateDocumentTotals({
        documentType: 'invoice',
        items,
        discountType: 'fixed',
        discountValue: 50000,
      });

      expect(totals.subtotal).toBe(750000);
      expect(totals.discountAmount).toBe(50000);
      expect(totals.totalAfterDiscount).toBe(700000);
      expect(totals.grandTotal).toBe(700000);
    });

    it('calculates quotation with multiple sections and project fee', () => {
      const sections = [
        {
          name: 'Living Room',
          items: [
            { description: 'Sectional Sofa', quantity: 1, price: 800000 },
            { description: 'Coffee Table', quantity: 1, price: 150000 },
          ],
        },
        {
          name: 'Master Bedroom',
          items: [
            { description: 'King Bed Frame', quantity: 1, price: 600000 },
            { description: 'Nightstand', quantity: 2, price: 750000 / 5 },
          ],
        },
      ];

      const totals = calculateDocumentTotals({
        documentType: 'quotation',
        sections,
        discountType: 'percentage',
        discountValue: 5,
        projectFeeType: 'percentage',
        projectFeeValue: 10,
      });

      expect(totals.subtotal).toBe(1850000);
      expect(totals.discountAmount).toBe(92500);
      expect(totals.totalAfterDiscount).toBe(1757500);
      expect(totals.projectFeeAmount).toBe(175750);
      expect(totals.grandTotal).toBe(1933250);
    });

    it('computes amount paid and remaining balance', () => {
      const items = [{ description: 'Office Desk', quantity: 2, price: 100000 }];

      const totals = calculateDocumentTotals({
        documentType: 'receipt',
        items,
        amountPaid: 150000,
      });

      expect(totals.grandTotal).toBe(200000);
      expect(totals.paid).toBe(150000);
      expect(totals.balance).toBe(50000);
    });
  });

  describe('Invoice & Receipt Template Cross-Referencing', () => {
    it('renders receipt template with parent invoice reference and payment details', () => {
      const html = customDocumentHTML({
        documentType: 'receipt',
        documentNumber: 'REC-2026-789',
        relatedDocumentNumber: 'INV-2026-101',
        paymentMethod: 'bank_transfer',
        paymentReference: 'TXN-99887766',
        clientName: 'Senator Danjuma',
        totalAmount: 1000000,
        amountPaid: 700000,
        items: [{ description: 'Conference Table', quantity: 1, price: 1000000 }],
      });

      expect(html).toContain('Payment Receipt');
      expect(html).toContain('Receipt No:');
      expect(html).toContain('REC-2026-789');
      expect(html).toContain('For Invoice:');
      expect(html).toContain('INV-2026-101');
      expect(html).toContain('Payment Method:');
      expect(html).toContain('Bank Transfer');
      expect(html).toContain('Payment Ref:');
      expect(html).toContain('TXN-99887766');
      expect(html).toContain('Invoice Total');
      expect(html).toContain('Amount Received (This Receipt)');
      expect(html).toContain('Remaining Balance (30%)');
    });

    it('renders invoice template with amount paid and remaining balance when payments exist', () => {
      const html = customDocumentHTML({
        documentType: 'invoice',
        documentNumber: 'INV-2026-101',
        clientName: 'Senator Danjuma',
        totalAmount: 1000000,
        amountPaid: 700000,
        items: [{ description: 'Conference Table', quantity: 1, price: 1000000 }],
      });

      expect(html).toContain('Payment Invoice');
      expect(html).toContain('Invoice No:');
      expect(html).toContain('INV-2026-101');
      expect(html).toContain('Amount Paid');
      expect(html).toContain('Balance Due');
    });

    it('applies discount only once in invoice HTML without double discounting', () => {
      const html = customDocumentHTML({
        documentType: 'invoice',
        documentNumber: 'INV-2026-DISC',
        clientName: 'Alhaji Bello',
        items: [{ description: 'Custom Sofa', quantity: 1, price: 400000 }],
        subtotal: 400000,
        totalAmount: 360000,
        discountType: 'percentage',
        discountValue: 10,
      });

      expect(html).toContain('Payment Invoice');
      expect(html).toContain('Subtotal');
      expect(html).toContain('400,000');
      expect(html).toContain('40,000');
      expect(html).toContain('360,000');
      expect(html).not.toContain('324,000');
    });

    it('applies discount only once in receipt HTML without double discounting', () => {
      const html = customDocumentHTML({
        documentType: 'receipt',
        documentNumber: 'REC-2026-DISC',
        clientName: 'Alhaji Bello',
        items: [{ description: 'Custom Sofa', quantity: 1, price: 400000 }],
        subtotal: 400000,
        totalAmount: 360000,
        amountPaid: 360000,
        discountType: 'percentage',
        discountValue: 10,
      });

      expect(html).toContain('Payment Receipt');
      expect(html).toContain('Subtotal');
      expect(html).toContain('400,000');
      expect(html).toContain('40,000');
      expect(html).toContain('360,000');
      expect(html).not.toContain('324,000');
    });
  });

  describe('listCustomDocuments and Staff Join', () => {
    it('queries staff username as created_by_name and not non-existent full_name', async () => {
      let capturedSql = '';
      const mockDb = {
        query: jest.fn(async (sql) => {
          capturedSql += sql + '\n';
          if (sql.trim().startsWith('SELECT count(*)')) {
            return [{ count: 1 }];
          }
          return [
            {
              id: '11111111-1111-4111-8111-111111111111',
              document_number: 'INV-2026-001',
              document_type: 'invoice',
              client_name: 'Test Client',
              subtotal_kobo: 10000000,
              total_kobo: 10000000,
              amount_paid_kobo: 0,
              balance_kobo: 10000000,
              status: 'issued',
              created_by: 'staff-1',
              created_by_name: 'admin_operator',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ];
        }),
      };

      const result = await listCustomDocuments({ page: 1, limit: 10 }, mockDb);
      expect(mockDb.query).toHaveBeenCalled();
      expect(capturedSql).toContain('s.username AS created_by_name');
      expect(capturedSql).not.toContain('s.full_name');
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].createdByName).toBe('admin_operator');
    });
  });

  describe('Invoice-Receipt Relational Logic', () => {
    it('updates parent invoice balance and sets partially_paid when receipt is issued', async () => {
      const parentInvoiceRow = {
        id: '11111111-1111-4111-8111-111111111111',
        document_number: 'INV-TEST-001',
        document_type: 'invoice',
        client_name: 'Test Client',
        subtotal_kobo: 50000000, // ₦500,000
        total_kobo: 50000000,
        amount_paid_kobo: 0,
        balance_kobo: 50000000,
        status: 'issued',
        data: {},
      };

      const mockDb = {
        query: jest.fn(async (sql, opts) => {
          if (sql.includes('SELECT * FROM custom_documents WHERE id = :id')) {
            return [parentInvoiceRow];
          }
          if (sql.startsWith('INSERT INTO custom_documents')) {
            return [
              [
                {
                  id: '22222222-2222-4222-8222-222222222222',
                  document_number: 'REC-TEST-001',
                  document_type: 'receipt',
                  client_name: 'Test Client',
                  related_document_id: parentInvoiceRow.id,
                  related_document_number: parentInvoiceRow.document_number,
                  payment_method: 'bank_transfer',
                  payment_reference: 'REF-001',
                  subtotal_kobo: 50000000,
                  total_kobo: 50000000,
                  amount_paid_kobo: 35000000, // ₦350,000
                  balance_kobo: 15000000,
                  status: 'issued',
                  data: {},
                },
              ],
            ];
          }
          if (sql.includes('UPDATE custom_documents')) {
            // Verify parent invoice is updated with partially_paid
            expect(opts.replacements.newParentPaid).toBe(35000000);
            expect(opts.replacements.newParentBalance).toBe(15000000);
            expect(opts.replacements.newParentStatus).toBe('partially_paid');
            return [1];
          }
          return [];
        }),
      };

      const receipt = await saveCustomDocument(
        {
          documentType: 'receipt',
          documentNumber: 'REC-TEST-001',
          relatedDocumentId: parentInvoiceRow.id,
          clientName: 'Test Client',
          totalAmount: 500000,
          amountPaid: 350000,
          paymentMethod: 'bank_transfer',
          paymentReference: 'REF-001',
          items: [{ description: 'Test Item', quantity: 1, price: 500000 }],
        },
        null,
        mockDb
      );

      expect(receipt.documentType).toBe('receipt');
      expect(receipt.relatedDocumentId).toBe(parentInvoiceRow.id);
      expect(receipt.relatedDocumentNumber).toBe('INV-TEST-001');
      expect(receipt.amountPaid).toBe(350000);
    });

    it('sets parent invoice to paid when full balance is receipted', async () => {
      const parentInvoiceRow = {
        id: '11111111-1111-4111-8111-111111111111',
        document_number: 'INV-TEST-002',
        document_type: 'invoice',
        client_name: 'Test Client 2',
        subtotal_kobo: 20000000, // ₦200,000
        total_kobo: 20000000,
        amount_paid_kobo: 0,
        balance_kobo: 20000000,
        status: 'issued',
        data: {},
      };

      const mockDb = {
        query: jest.fn(async (sql, opts) => {
          if (sql.includes('SELECT * FROM custom_documents WHERE id = :id')) {
            return [parentInvoiceRow];
          }
          if (sql.startsWith('INSERT INTO custom_documents')) {
            return [
              [
                {
                  id: '33333333-3333-4333-8333-333333333333',
                  document_number: 'REC-TEST-002',
                  document_type: 'receipt',
                  client_name: 'Test Client 2',
                  related_document_id: parentInvoiceRow.id,
                  related_document_number: parentInvoiceRow.document_number,
                  subtotal_kobo: 20000000,
                  total_kobo: 20000000,
                  amount_paid_kobo: 20000000, // full payment
                  balance_kobo: 0,
                  status: 'issued',
                  data: {},
                },
              ],
            ];
          }
          if (sql.includes('UPDATE custom_documents')) {
            expect(opts.replacements.newParentPaid).toBe(20000000);
            expect(opts.replacements.newParentBalance).toBe(0);
            expect(opts.replacements.newParentStatus).toBe('paid');
            return [1];
          }
          return [];
        }),
      };

      const receipt = await saveCustomDocument(
        {
          documentType: 'receipt',
          documentNumber: 'REC-TEST-002',
          relatedDocumentId: parentInvoiceRow.id,
          clientName: 'Test Client 2',
          totalAmount: 200000,
          amountPaid: 200000,
          items: [{ description: 'Test Item', quantity: 1, price: 200000 }],
        },
        null,
        mockDb
      );

      expect(receipt.balance).toBe(0);
    });
  });
});
