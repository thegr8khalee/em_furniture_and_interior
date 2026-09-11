import { deliveryNoteHTML, purchaseOrderHTML, payslipHTML, orderDocumentHTML } from '../../src/lib/documentTemplates.js';

describe('Operational Documents HTML Generators', () => {
  describe('deliveryNoteHTML', () => {
    const mockOrder = {
      orderNumber: 'ORD-2026-9901',
      createdAt: new Date('2026-09-10T10:00:00Z'),
      shippingMethod: 'Dedicated Truck Dispatch',
      trackingNumber: 'TRK-KD-4401',
      notes: 'Fragile dining table glass top. Handle with extreme care.',
      shippingAddress: {
        fullName: 'Amina Bello',
        streetAddress: 'Plot 4, Independence Way',
        city: 'Kaduna',
        state: 'Kaduna State',
        phone: '+2348031234567',
        email: 'amina.bello@example.com',
      },
      items: [
        {
          name: 'Royal Mahogany Dining Table',
          variant: '6-Seater, Dark Walnut',
          quantity: 1,
          subtotal: 450000,
        },
        {
          name: 'Upholstered Dining Chair',
          variant: 'Cream Velvet',
          quantity: 6,
          subtotal: 360000,
        },
      ],
    };

    it('renders delivery note with all consignee and dispatch details', () => {
      const html = deliveryNoteHTML(mockOrder);
      expect(html).toContain('DELIVERY NOTE / WAYBILL');
      expect(html).toContain('ORD-2026-9901');
      expect(html).toContain('Amina Bello');
      expect(html).toContain('Plot 4, Independence Way');
      expect(html).toContain('Kaduna State');
      expect(html).toContain('+2348031234567');
      expect(html).toContain('Dedicated Truck Dispatch');
      expect(html).toContain('TRK-KD-4401');
      expect(html).toContain('Royal Mahogany Dining Table');
      expect(html).toContain('Upholstered Dining Chair');
      expect(html).toContain('Fragile dining table glass top');
    });

    it('includes all three required signature verification blocks', () => {
      const html = deliveryNoteHTML(mockOrder);
      expect(html).toContain('1. Dispatched By');
      expect(html).toContain('2. Delivered By');
      expect(html).toContain('3. Received in Good Condition');
      expect(html).toContain('I confirm receipt of the goods in complete and undamaged condition');
    });

    it('is dispatched via orderDocumentHTML with delivery_note type', () => {
      const html = orderDocumentHTML(mockOrder, 'delivery_note');
      expect(html).toContain('DELIVERY NOTE / WAYBILL');
      expect(html).toContain('ORD-2026-9901');

      const htmlHyphen = orderDocumentHTML(mockOrder, 'delivery-note');
      expect(htmlHyphen).toContain('DELIVERY NOTE / WAYBILL');
    });
  });

  describe('purchaseOrderHTML', () => {
    const mockPO = {
      poNumber: 'PO-2026-104',
      createdAt: new Date('2026-09-08T12:00:00Z'),
      expectedOn: new Date('2026-09-20'),
      status: 'sent',
      notes: 'Kiln-dried hardwood timber. Delivery to Kaduna workshop bay 2.',
      total: 750000,
      vendor: {
        name: 'Northern Timber & Teak Mills',
        phone: '+2348029876543',
        email: 'sales@northerntimber.com',
        address: 'Industrial Layout, Kakuri, Kaduna',
      },
      items: [
        {
          name: 'Teak Planks 2x4 (Pack of 50)',
          quantity: 10,
          unitCost: 50000,
          lineTotal: 500000,
        },
        {
          name: 'Marine Plywood Sheets 18mm',
          quantity: 25,
          unitCost: 10000,
          lineTotal: 250000,
        },
      ],
    };

    it('renders supplier details and purchase order header', () => {
      const html = purchaseOrderHTML(mockPO);
      expect(html).toContain('PURCHASE ORDER');
      expect(html).toContain('PO-2026-104');
      expect(html).toMatch(/Northern Timber (&|&amp;) Teak Mills/);
      expect(html).toContain('sales@northerntimber.com');
      expect(html).toContain('Industrial Layout, Kakuri, Kaduna');
      expect(html).toContain('SENT');
    });

    it('renders ordered items, unit costs, and total PO value', () => {
      const html = purchaseOrderHTML(mockPO);
      expect(html).toContain('Teak Planks 2x4 (Pack of 50)');
      expect(html).toContain('Marine Plywood Sheets 18mm');
      expect(html).toContain('750,000');
      expect(html).toContain('Kiln-dried hardwood timber');
    });

    it('includes procurement authorization and supplier acceptance signature blocks', () => {
      const html = purchaseOrderHTML(mockPO);
      expect(html).toContain('Authorized Procurement');
      expect(html).toContain('Supplier Acceptance');
      expect(html).toContain('Acknowledged &amp; Agreed');
    });
  });

  describe('payslipHTML', () => {
    const mockRun = {
      _id: 'run-uuid-12345678',
      period: '2026-09-01',
      status: 'approved',
    };

    const mockSlip = {
      _id: 'slip-uuid-87654321',
      employee: {
        fullName: 'Ibrahim Danladi',
        jobTitle: 'Senior Carpenter',
        bankName: 'Taj Bank',
        bankAccount: '0019876543',
      },
      gross: 350000,
      paye: 35000,
      pension: 28000,
      employerPension: 35000,
      otherDeductions: 5000,
      net: 282000,
    };

    it('renders employee information and pay period', () => {
      const html = payslipHTML(mockSlip, mockRun);
      expect(html).toContain('EMPLOYEE PAYSLIP');
      expect(html).toContain('Ibrahim Danladi');
      expect(html).toContain('Senior Carpenter');
      expect(html).toContain('Taj Bank');
      expect(html).toContain('0019876543');
      expect(html).toContain('September 2026');
      expect(html).toContain('PAY-202609-SLIP-UUI');
    });

    it('renders gross earnings and statutory deductions breakdown', () => {
      const html = payslipHTML(mockSlip, mockRun);
      expect(html).toContain('350,000.00'); // Gross
      expect(html).toContain('35,000.00'); // PAYE
      expect(html).toContain('28,000.00'); // Employee pension
      expect(html).toContain('5,000.00'); // Other deductions
      expect(html).toContain('68,000.00'); // Total deductions
    });

    it('renders net take-home pay and employer pension contribution notice', () => {
      const html = payslipHTML(mockSlip, mockRun);
      expect(html).toContain('Net Take-Home Pay');
      expect(html).toContain('282,000.00');
      expect(html).toContain('Employer Pension Contribution (10%)');
      expect(html).toContain('Contributed by the company directly to the employee pension fund administrator (PFA)');
    });
  });

  describe('Security & XSS Hardening in Document Templates', () => {
    it('escapes malicious script and html tags across templates', () => {
      const xssPayload = '<script>alert("pwned")</script><img src=x onerror=alert(1)>';
      
      const maliciousOrder = {
        orderNumber: 'ORD-<XSS>',
        createdAt: new Date(),
        shippingAddress: {
          fullName: `Mallam ${xssPayload}`,
          streetAddress: `Plot ${xssPayload}`,
          city: 'Kaduna',
          state: 'Kaduna',
          phone: '+234800000000',
          notes: xssPayload,
        },
        items: [
          {
            name: `Table ${xssPayload}`,
            quantity: 1,
            price: 50000,
            subtotal: 50000,
          },
        ],
      };

      const dnHtml = deliveryNoteHTML(maliciousOrder);
      expect(dnHtml).not.toContain('<script>');
      expect(dnHtml).not.toContain('<img src=x');
      expect(dnHtml).toContain('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;');

      const poMalicious = {
        poNumber: `PO-${xssPayload}`,
        status: 'draft',
        vendor: {
          name: `Vendor ${xssPayload}`,
          address: `Address ${xssPayload}`,
        },
        notes: xssPayload,
        items: [{ name: `Wood ${xssPayload}`, quantity: 1, unitCost: 100, lineTotal: 100 }],
      };

      const poHtml = purchaseOrderHTML(poMalicious);
      expect(poHtml).not.toContain('<script>');
      expect(poHtml).not.toContain('<img src=x');
      expect(poHtml).toContain('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;');

      const slipMalicious = {
        employee: {
          fullName: `Employee ${xssPayload}`,
          jobTitle: `Role ${xssPayload}`,
        },
        gross: 100000,
      };
      const runMock = { period: '2026-09-01' };
      const slipHtml = payslipHTML(slipMalicious, runMock);
      expect(slipHtml).not.toContain('<script>');
      expect(slipHtml).not.toContain('<img src=x');
      expect(slipHtml).toContain('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;');
    });
  });
});
