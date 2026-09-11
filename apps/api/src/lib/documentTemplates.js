/**
 * HTML templates for PDF document generation.
 *
 * Edit the HTML/CSS below to restyle your invoices, receipts, and quotations.
 * Each function returns a full HTML string that Puppeteer renders to PDF.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ── helpers ─────────────────────────────────────────── */

export const escapeHtml = (value) => {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatCurrency = (amount) =>
  `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const formatDate = (date) => new Date(date).toLocaleDateString('en-NG', {
  year: 'numeric', month: 'long', day: 'numeric',
});

/* ── document configuration ───────────────────────────── */

// Load images as base64 data URIs for Puppeteer rendering
const bgImagePath = path.join(__dirname, 'document-bg.png');
const bgImageDataUri = fs.existsSync(bgImagePath)
  ? 'data:image/png;base64,' + fs.readFileSync(bgImagePath).toString('base64')
  : '';

const logoPath = path.join(__dirname, 'em_logo.png');
const logoDataUri = fs.existsSync(logoPath)
  ? 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
  : '';

const docConfig = {
  logoUrl: logoDataUri,
  bgImageUrl: bgImageDataUri,
  companyAddress: 'C15 Bamaiyi Road, Kaduna',
  companyPhone: '+2349037691860',
  companyWebsite: 'www.emfurnitureandinterior.com',
  rcNumber: '8153295',
  // Bank details for invoices/receipts
  bankName: 'Taj Bank',
  accountNumber: '0012353692',
  accountName: 'EM Modern Furniture and Interior Ltd',
  // Bank details for quotations (different account)
  quotationBankName: 'Taj Bank',
  quotationAccountNumber: '0012353692',
  quotationAccountName: 'EM Modern Furniture and Interior Ltd',
  // Default deposit percentage for quotations / invoices
  depositPercent: 70,
};

const formatReceiptAmount = (amount) =>
  `\u20A6${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/* ── shared CSS ──────────────────────────────────────── */

const baseStyles = `
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: #1a1a1a;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 30px;
  }

  .company-name {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #111;
  }

  .company-details {
    font-size: 11px;
    color: #666;
    margin-top: 6px;
    line-height: 1.6;
  }

  .doc-title {
    font-size: 28px;
    font-weight: 700;
    text-align: right;
    color: #333;
    text-transform: uppercase;
  }

  .doc-meta {
    text-align: right;
    font-size: 11px;
    color: #666;
    margin-top: 6px;
    line-height: 1.6;
  }

  .separator {
    border: none;
    border-top: 2px solid #e0e0e0;
    margin: 24px 0;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 30px;
  }

  .info-block h3 {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #999;
    margin-bottom: 8px;
  }

  .info-block p {
    font-size: 12px;
    line-height: 1.7;
    color: #333;
  }

  /* ── table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }

  thead th {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #999;
    padding: 10px 8px;
    border-bottom: 2px solid #e0e0e0;
    text-align: left;
  }

  thead th.right { text-align: right; }
  thead th.center { text-align: center; }

  tbody td {
    padding: 10px 8px;
    font-size: 12px;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: top;
  }

  tbody td.right { text-align: right; }
  tbody td.center { text-align: center; }

  tbody tr:last-child td { border-bottom: none; }

  /* ── totals ── */
  .totals {
    margin-left: auto;
    width: 280px;
  }

  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 12px;
    color: #555;
  }

  .totals-row.grand {
    border-top: 2px solid #e0e0e0;
    margin-top: 8px;
    padding-top: 12px;
    font-size: 16px;
    font-weight: 700;
    color: #111;
  }

  .totals-row .discount { color: #16a34a; }

  /* ── notes ── */
  .notes {
    margin-top: 40px;
    padding: 16px;
    background: #fafafa;
    border-left: 3px solid #e0e0e0;
  }

  .notes h4 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #999;
    margin-bottom: 6px;
  }

  .notes p {
    font-size: 12px;
    line-height: 1.6;
    color: #555;
  }

  /* ── footer ── */
  .footer {
    margin-top: 60px;
    text-align: center;
    font-size: 10px;
    color: #aaa;
    line-height: 1.8;
  }
`;

/* ── RECEIPT STYLES ───────────────────────────────────── */

const receiptStyles = `
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 14px;
    color: #1a1a1a;
    width: 100%;
    min-height: 100vh;
    position: relative;
    background: transparent;
  }

  .receipt-bg {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
    z-index: -1;
  }

  .receipt-bg.lines-pattern {
    background: repeating-linear-gradient(
      135deg,
      transparent,
      transparent 120px,
      rgba(0, 0, 0, 0.025) 120px,
      rgba(0, 0, 0, 0.025) 121px
    );
  }

  .receipt-content {
    position: relative;
    z-index: 1;
  }

  .logo-section {
    text-align: center;
    margin-bottom: 8px;
  }

  .logo-section img {
    width: 90px;
    height: auto;
  }

  .company-name {
    text-align: center;
    font-size: 17px;
    letter-spacing: 1.5px;
    margin-bottom: 30px;
    color: #222;
  }

  .company-name .brand {
    font-weight: 700;
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  }

  .company-name .fancy {
    font-style: italic;
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  }

  .receipt-title {
    text-align: center;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 10px;
    text-transform: uppercase;
    margin-bottom: 40px;
    color: #222;
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  }

  .meta-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 50px;
    padding-top: 20px;
  }

  .issued-to .label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #222;
  }

  .issued-to .name {
    font-size: 14px;
    margin-top: 6px;
    color: #333;
  }

  .invoice-meta {
    text-align: right;
  }

  .invoice-meta p {
    font-size: 13px;
    line-height: 2;
    color: #222;
  }

  .invoice-meta .label {
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  .items-table thead th {
    background: #d9d9d9;
    color: #000000;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 14px 24px;
    text-align: left;
  }

  .items-table thead th.right {
    text-align: right;
  }

  .items-table thead th.center {
    text-align: center;
  }

  .items-table tbody td {
    padding: 14px 24px;
    font-size: 14px;
    border-bottom: 1px solid #eee;
    color: #333;
    background-color: #fafafa;
  }

  .items-table tbody td.right {
    text-align: right;
    font-weight: 500;
  }

  .items-table tbody td.center {
    text-align: center;
    font-weight: 500;
  }

  .items-table tbody tr:last-child td {
    border-bottom: none;
  }

  .summary-table {
    margin-top: 0;
  }

  .summary-table td {
    padding: 13px 24px;
    font-size: 13px;
    font-weight: 700;
    background: #d9d9d9;
    color: #000000;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .summary-table td.right {
    text-align: right;
  }

  .receipt-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: auto;
    padding-top: 50px;
  }

  .bank-details h4 {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
    color: #222;
  }

  .bank-details p {
    font-size: 11px;
    line-height: 1.9;
    color: #333;
    text-transform: uppercase;
  }

  .signature {
    text-align: right;
  }

  .signature p {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #222;
    line-height: 2;
  }

  .notes-block {
    margin-top: 30px;
    padding: 14px 18px;
    background: #fafafa;
    border-left: 3px solid #d0d0d0;
  }

  .notes-block h4 {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 6px;
    color: #222;
  }

  .notes-block p {
    font-size: 12px;
    line-height: 1.7;
    color: #444;
    white-space: pre-wrap;
  }
`;

const formatPaymentMethod = (method) => {
  if (!method) return '';
  const map = {
    bank_transfer: 'Bank Transfer',
    transfer: 'Bank Transfer',
    pos: 'POS / Card',
    cash: 'Cash',
    cheque: 'Cheque',
    online: 'Online Payment',
  };
  return map[String(method).toLowerCase()] || method;
};

/* ── BRANDED DOCUMENT HTML GENERATOR ──────────────────── */

const brandedDocumentHTML = ({
  title,
  clientName,
  invoiceNumber,
  receiptNumber,
  forInvoiceNumber,
  paymentMethod,
  paymentReference,
  date,
  items,
  summaryRows,
  notes,
}) => {
  const bgDiv = docConfig.bgImageUrl
    ? `<div class="receipt-bg" style="background-image: url('${docConfig.bgImageUrl}');"></div>`
    : `<div class="receipt-bg lines-pattern"></div>`;

  const logoImg = docConfig.logoUrl
    ? `<img src="${docConfig.logoUrl}" alt="EM Furniture">`
    : '';

  const itemsHTML = items.map(item => {
    const quantity = Number(item.quantity) || 1;
    const lineTotal = item.lineTotal != null ? Number(item.lineTotal) : Number(item.price) || 0;
    const unitPrice = item.unitPrice != null
      ? Number(item.unitPrice)
      : (quantity > 0 ? lineTotal / quantity : lineTotal);

    return `
    <tr>
      <td>${escapeHtml(item.description)}</td>
      <td class="center">${quantity}</td>
      <td class="right">${formatReceiptAmount(unitPrice)}</td>
      <td class="right">${formatReceiptAmount(lineTotal)}</td>
    </tr>
  `;
  }).join('');

  const summaryHTML = summaryRows.map(row => `
    <tr>
      <td>${escapeHtml(row.label)}</td>
      <td class="right">${formatReceiptAmount(row.amount)}</td>
    </tr>
  `).join('');

  const dateStr = typeof date === 'string' ? date : formatDate(date);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet"><style>${receiptStyles}</style></head>
<body>

  ${bgDiv}

  <table style="width: 100%; border-collapse: collapse; border-spacing: 0;">
    <thead><tr><td><div style="height: 40px;"></div></td></tr></thead>
    <tbody><tr><td style="padding: 0 50px;">
      <div class="receipt-content">

        <div class="logo-section">${logoImg}</div>

    <div class="company-name">
      <span class="brand">EM</span> <span class="fancy">Furniture &amp; interior</span>&#169;
    </div>

    <h1 class="receipt-title">${escapeHtml(title)}</h1>

    <div class="meta-section">
      <div class="issued-to">
        <div class="label">Issued To:</div>
        <div class="name">${escapeHtml(clientName)}</div>
      </div>
      <div class="invoice-meta">
        ${receiptNumber ? `<p><span class="label">Receipt No:</span>&nbsp;&nbsp;&nbsp;${escapeHtml(receiptNumber)}</p>` : ''}
        ${forInvoiceNumber ? `<p><span class="label">For Invoice:</span>&nbsp;&nbsp;&nbsp;${escapeHtml(forInvoiceNumber)}</p>` : ''}
        ${!receiptNumber && invoiceNumber ? `<p><span class="label">Invoice No:</span>&nbsp;&nbsp;&nbsp;${escapeHtml(invoiceNumber)}</p>` : ''}
        <p><span class="label">Date:</span>&nbsp;&nbsp;&nbsp;${escapeHtml(dateStr)}</p>
        ${paymentMethod ? `<p><span class="label">Payment Method:</span>&nbsp;&nbsp;&nbsp;${escapeHtml(formatPaymentMethod(paymentMethod))}</p>` : ''}
        ${paymentReference ? `<p><span class="label">Payment Ref:</span>&nbsp;&nbsp;&nbsp;${escapeHtml(paymentReference)}</p>` : ''}
        <p><span class="label">RC:</span>&nbsp;&nbsp;&nbsp;${docConfig.rcNumber}</p>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="center">Qty</th>
          <th class="right">Unit Price</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <table class="summary-table">
      ${summaryHTML}
    </table>

    ${notes && String(notes).trim() ? `<div class="notes-block"><h4>Notes</h4><p>${escapeHtml(String(notes).trim())}</p></div>` : ''}

    <div class="receipt-footer">
      <div class="bank-details">
        <h4>Bank Details</h4>
        <p>
          ${docConfig.bankName}<br>
          Account Number: ${docConfig.accountNumber}<br>
          Account Name: ${docConfig.accountName}
        </p>
      </div>
      <div class="signature">
        <p>Signed</p>
        <p>Management</p>
      </div>
    </div>

      </div>
    </td></tr></tbody>
    <tfoot><tr><td><div style="height: 40px;"></div></td></tr></tfoot>
  </table>

</body>
</html>`;
};

const receiptHTML = ({
  clientName,
  receiptNumber,
  invoiceNumber,
  forInvoiceNumber,
  paymentMethod,
  paymentReference,
  date,
  items,
  total,
  amountPaid,
  notes,
  discountType,
  discountValue,
}) => {
  const totalAmount = Number(total) || 0;
  
  let discountAmount = 0;
  if (discountType === 'percentage' && discountValue) {
    discountAmount = Math.round(totalAmount * Number(discountValue) / 100);
  } else if (discountType === 'fixed' && discountValue) {
    discountAmount = Number(discountValue);
  }
  const grandTotal = Math.max(0, totalAmount - discountAmount);

  const paid = amountPaid != null ? Number(amountPaid) : grandTotal;
  const balance = Math.max(0, grandTotal - paid);
  const balancePct = grandTotal > 0 ? Math.round((balance / grandTotal) * 100) : 0;
  
  const summaryRows = [{ label: discountAmount > 0 ? 'Subtotal' : (forInvoiceNumber ? 'Invoice Total' : 'Total'), amount: totalAmount }];
  if (discountAmount > 0) {
    summaryRows.push({ label: 'Discount', amount: discountAmount });
    summaryRows.push({ label: 'Grand Total', amount: grandTotal });
  }
  summaryRows.push(
    { label: forInvoiceNumber ? 'Amount Received (This Receipt)' : 'Paid', amount: paid },
    { label: `Remaining Balance (${balancePct}%)`, amount: balance }
  );

  return brandedDocumentHTML({
    title: 'Payment Receipt',
    clientName,
    receiptNumber: receiptNumber || invoiceNumber,
    forInvoiceNumber: forInvoiceNumber || null,
    paymentMethod,
    paymentReference,
    date,
    items,
    notes,
    summaryRows,
  });
};

const invoiceHTML = ({
  clientName,
  invoiceNumber,
  date,
  items,
  total,
  amountPaid,
  depositPercent,
  notes,
  discountType,
  discountValue,
}) => {
  const pct = depositPercent != null && !isNaN(Number(depositPercent))
    ? Number(depositPercent)
    : docConfig.depositPercent;
    
  let discountAmount = 0;
  if (discountType === 'percentage' && discountValue) {
    discountAmount = Math.round(Number(total) * Number(discountValue) / 100);
  } else if (discountType === 'fixed' && discountValue) {
    discountAmount = Number(discountValue);
  }
  const grandTotal = Math.max(0, Number(total) - discountAmount);

  const summaryRows = [{ label: discountAmount > 0 ? 'Subtotal' : 'Total', amount: total }];
  if (discountAmount > 0) {
    summaryRows.push({ label: 'Discount', amount: discountAmount });
    summaryRows.push({ label: 'Grand Total', amount: grandTotal });
  }

  const paid = Number(amountPaid) || 0;
  if (paid > 0) {
    const balance = Math.max(0, grandTotal - paid);
    summaryRows.push({ label: 'Amount Paid', amount: paid });
    summaryRows.push({ label: 'Balance Due', amount: balance });
  } else if (pct > 0 && pct < 100) {
    const deposit = Math.round(grandTotal * pct / 100);
    const balance = grandTotal - deposit;
    summaryRows.push({ label: `Deposit (${pct}%)`, amount: deposit });
    summaryRows.push({ label: `Balance (${100 - pct}%)`, amount: balance });
  }

  return brandedDocumentHTML({
    title: 'Payment Invoice',
    clientName,
    invoiceNumber,
    date,
    items,
    notes,
    summaryRows,
  });
};

/* ── QUOTATION STYLES ─────────────────────────────────── */

const quotationStyles = `
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 14px;
    color: #1a1a1a;
    background: transparent;
  }

  .q-page {
    position: relative;
    background: transparent;
  }

  .q-page.new-page {
    page-break-before: always;
    break-before: page;
  }

  .q-page-bg {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background-repeat: no-repeat;
    background-size: cover;
    background-position: center;
    z-index: -1;
  }

  .q-content {
    position: relative;
    z-index: 1;
  }

  .q-logo {
    text-align: center;
    margin-bottom: 8px;
  }

  .q-logo img {
    width: 90px;
    height: auto;
  }

  .q-company-name {
    text-align: center;
    font-size: 17px;
    letter-spacing: 1.5px;
    margin-bottom: 16px;
    color: #222;
  }

  .q-company-name .brand {
    font-weight: 700;
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  }

  .q-company-name .fancy {
    font-style: italic;
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  }

  .q-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
  }

  .q-company-info {
    font-size: 12px;
    color: #333;
    line-height: 1.8;
  }

  .q-title-block {
    text-align: right;
  }

  .q-title {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
    font-style: italic;
    font-size: 36px;
    color: #222;
    margin-bottom: 6px;
  }

  .q-ref {
    font-size: 13px;
    color: #222;
    line-height: 2;
  }

  .q-ref .label {
    font-weight: 700;
  }

  .q-client-box {
    background: #fafafa;
    padding: 16px 20px;
    margin-bottom: 30px;
  }

  .q-client-box h4 {
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #222;
  }

  .q-client-box p {
    font-size: 13px;
    color: #333;
    line-height: 1.8;
  }

  .q-client-box .lbl {
    font-weight: 700;
  }

  .q-section-title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #222;
    margin: 30px 0 12px;
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  }

  .q-items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0px;
  }

  .q-items-table thead th {
    background: #d9d9d9;
    color: #000000;
    font-size: 12px;
    font-weight: 700;
    padding: 10px 20px;
    text-align: left;
  }

  .q-items-table thead th.right {
    text-align: right;
  }

  .q-items-table tbody td {
    padding: 12px 20px;
    font-size: 14px;
    border-bottom: 1px solid #eee;
    color: #333;
    background-color: #fafafa;
  }

  .q-items-table tbody td.right {
    text-align: right;
  }

  .q-items-table tbody tr:last-child td {
    border-bottom: none;
  }

  .q-subtotal-row {
    display: flex;
    justify-content: flex-end;
    padding: 10px 20px;
    background: #d9d9d9;
    margin-bottom: 10px;
  }

  .q-subtotal-row span {
    font-size: 14px;
    font-weight: 700;
    color: #000000;
  }

  /* Summary page */
  .q-summary-title {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #222;
    margin-bottom: 16px;
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  }

  .q-summary-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }

  .q-summary-table thead th {
    background: #d9d9d9;
    color: #000000;
    font-size: 12px;
    font-weight: 700;
    padding: 10px 20px;
    text-align: left;
  }

  .q-summary-table thead th.right { text-align: right; }

  .q-summary-table tbody td {
    padding: 12px 20px;
    font-size: 14px;
    border-bottom: 1px solid #eee;
    color: #333;
    background-color: #fafafa;
  }

  .q-summary-table tbody td.right { text-align: right; }

  .q-summary-table tbody tr.total-row td {
    font-weight: 700;
    background: #d9d9d9;
    color: #000000;
    border-top: 2px solid #ccc;
    border-bottom: none;
  }

  .q-deposit-row {
    padding: 10px 20px;
    font-size: 14px;
    color: #222;
    display: flex;
    justify-content: space-between;
  }

  .q-deposit-row .lbl { font-weight: 700; }

  /* Terms */
  .q-terms-title {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #222;
    margin-bottom: 20px;
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  }

  .q-terms-title .amp {
    font-style: italic;
  }

  .q-term h5 {
    font-size: 13px;
    font-weight: 700;
    color: #222;
    margin-bottom: 4px;
  }

  .q-term p {
    font-size: 12px;
    color: #333;
    line-height: 1.7;
    margin-bottom: 16px;
  }

  /* Footer */
  .q-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: auto;
    padding-top: 50px;
  }

  .q-bank h4 {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
    color: #222;
  }

  .q-bank p {
    font-size: 11px;
    line-height: 1.9;
    color: #333;
    text-transform: uppercase;
  }

  .q-sig {
    text-align: right;
  }

  .q-sig p {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #222;
    line-height: 2;
  }

  .page-break { page-break-before: always; }

  .page-number {
    text-align: center;
    font-size: 11px;
    color: #999;
    margin-top: 40px;
  }

  .continued {
    text-align: center;
    font-size: 12px;
    color: #999;
    font-style: italic;
    margin-top: 20px;
  }
`;

/* ── TERMS & CONDITIONS ──────────────────────────────── */

const defaultTermsAndConditions = [
  {
    title: 'Price Review',
    body: 'A price review shall be conducted five (5) days after submission of this estimate if payment is not made within that period due to unstable market rates.',
  },
  {
    title: 'Estimated Cost',
    body: 'The above prices are estimates based on current market surveys. A final price review will be carried out at the end of the project to determine the actual cost. Items may be purchased at higher or lower prices than estimated. Any remaining balance will be reimbursed to the client.',
  },
  {
    title: 'Scope of Work',
    body: 'The above cost covers only the items listed in this quotation. Any additional major work or materials not included will attract extra charges.',
  },
  {
    title: 'Non-Returnable Items',
    body: 'Once purchased, most items cannot be returned or cancelled. Therefore, any request for return or cancellation will be handled without guarantee. Custom-made items are strictly non-refundable and non-cancellable.',
  },
  {
    title: 'Third-Party Procurement',
    body: 'The interior design team shall not be held accountable for the procurement of any items not paid for directly through the design team.',
  },
  {
    title: 'Unavailable Items',
    body: 'In cases where any item specified in the mood board is unavailable, a suitable alternative within the same price range will be presented to the client for approval before purchase.',
  },
  {
    title: 'Site Management',
    body: 'The interior design team shall include a professional site manager, available on-site from 9:00 AM to 5:00 PM throughout the project duration.',
  },
  {
    title: 'Vendor and Artisan Contacts',
    body: 'The interior designer is not obligated to provide contact information of vendors or artisans sourced by the design team. Clients are not permitted to accompany the interior designer to purchase items or visit artisans\\u2019 workshops.',
  },
  {
    title: 'Payments and Purchases',
    body: 'The interior designer shall be responsible for paying directly for all materials and works quoted in this estimate. Payments are not to be made directly by the client to vendors or artisans.',
  },
  {
    title: 'Working Hours',
    body: 'The official on-site working hours are 9:00 AM to 5:00 PM.',
  },
  {
    title: 'Photography Rights',
    body: 'The interior designer shall be allowed to take photographs of the work progress and completed project for documentation and portfolio purposes.',
  },
];

/* ── QUOTATION HTML GENERATOR ────────────────────────── */

/**
 * Generates a multi-page quotation PDF matching the branded design.
 *
 * @param {Object} opts
 * @param {string} opts.clientName
 * @param {string} [opts.clientPhone]
 * @param {string} opts.referenceNumber
 * @param {string} opts.date
 * @param {Array}  opts.sections - Array of { name: string, items: [{ description, price }] }
 * @param {number} [opts.depositPercent] - e.g. 80. Omit to skip deposit line.
 * @param {Array}  [opts.terms] - Custom terms array; falls back to defaults.
 */
const quotationHTML = ({
  clientName,
  clientPhone,
  referenceNumber,
  date,
  sections = [],
  depositPercent,
  depositType,
  depositValue,
  projectFeeType,
  projectFeeValue,
  miscellaneousFee,
  discountType,
  discountValue,
  terms,
}) => {
  const bgPageDiv = docConfig.bgImageUrl
    ? `<div class="q-page-bg" style="background-image: url('${docConfig.bgImageUrl}');"></div>`
    : '';

  const logoImg = docConfig.logoUrl
    ? `<img src="${docConfig.logoUrl}" alt="EM Furniture">`
    : '';

  const dateStr = typeof date === 'string' ? date : formatDate(date);
  const depPct = depositPercent ?? docConfig.depositPercent;
  const termsArr = terms || defaultTermsAndConditions;

  // Build section HTML blocks
  const sectionBlocks = sections.map(section => {
    let sectionTotal = 0;
    const rows = section.items.map(item => {
      const amt = Number(item.price) || 0;
      sectionTotal += amt;
      return `<tr><td>${escapeHtml(item.description)}</td><td class="right">${Number(amt).toLocaleString('en-NG')}</td></tr>`;
    }).join('');

    return `
      <h2 class="q-section-title">${escapeHtml(section.name)}</h2>
      <table class="q-items-table">
        <thead><tr><th>Items Description</th><th class="right">Total Cost</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="q-subtotal-row">
        <span>Subtotal : ${Number(sectionTotal).toLocaleString('en-NG')}</span>
      </div>`;
  }).join('');

  // Summary data
  let subtotal = 0;
  let summaryRows = sections.map(section => {
    const cost = section.items.reduce((sum, it) => sum + (Number(it.price) || 0), 0);
    subtotal += cost;
    return `<tr><td>${escapeHtml(section.name)}</td><td class="right">${Number(cost).toLocaleString('en-NG')}</td></tr>`;
  });

  let discountAmount = 0;
  if (discountType === 'percentage' && Number(discountValue) > 0) {
    discountAmount = Math.round(subtotal * Number(discountValue) / 100);
  } else if (discountType === 'fixed' && Number(discountValue) > 0) {
    discountAmount = Number(discountValue);
  }

  const totalAfterDiscount = Math.max(0, subtotal - discountAmount);
  if (discountAmount > 0) {
    summaryRows.push(`<tr><td>Discount</td><td class="right">-${Number(discountAmount).toLocaleString('en-NG')}</td></tr>`);
  }

  let computedProjectFee = 0;
  if (projectFeeType === 'percentage' && Number(projectFeeValue) > 0) {
    computedProjectFee = Math.round(totalAfterDiscount * Number(projectFeeValue) / 100);
  } else if (projectFeeType === 'fixed' && Number(projectFeeValue) > 0) {
    computedProjectFee = Number(projectFeeValue);
  } else if (Number(miscellaneousFee) > 0) {
    // Backward compatibility for older payloads.
    computedProjectFee = Number(miscellaneousFee);
  }

  const grandTotal = totalAfterDiscount + computedProjectFee;

  if (computedProjectFee > 0) {
    const projectFeeLabel = projectFeeType === 'percentage' && Number(projectFeeValue) > 0
      ? `Project Management & Procurement Fee (${Number(projectFeeValue)}%)`
      : 'Project Management & Procurement Fee';
    summaryRows.push(`<tr><td>${projectFeeLabel}</td><td class="right">${Number(computedProjectFee).toLocaleString('en-NG')}</td></tr>`);
  }

  const summaryRowsHtml = summaryRows.join('');

  let deposit = null;
  let balance = null;
  let depositLabel = '';
  let balanceLabel = 'Balance:';

  if (depositType === 'percentage' && Number(depositValue) > 0) {
    const pct = Number(depositValue);
    deposit = Math.round(grandTotal * pct / 100);
    balance = grandTotal - deposit;
    depositLabel = `Deposit (${pct}%):`;
    balanceLabel = `Balance (${100 - pct}%):`;
  } else if (depositType === 'fixed' && Number(depositValue) > 0) {
    deposit = Number(depositValue);
    balance = grandTotal - deposit;
    depositLabel = 'Deposit:';
  } else if (depPct) {
    // Backward compatibility for older payloads.
    deposit = Math.round(grandTotal * depPct / 100);
    balance = grandTotal - deposit;
    depositLabel = `Deposit (${depPct}%):`;
    balanceLabel = `Balance (${100 - depPct}%):`;
  }

  const depositRows = deposit != null ? `
    <div class="q-deposit-row">
      <span class="lbl">${depositLabel}</span>
      <span>${Number(deposit).toLocaleString('en-NG')}</span>
    </div>
    <div class="q-deposit-row">
      <span class="lbl">${balanceLabel}</span>
      <span>${Number(balance).toLocaleString('en-NG')}</span>
    </div>` : '';

  // Terms HTML
  const termsHTML = termsArr.map(t => `
    <div class="q-term">
      <h5>${t.title}</h5>
      <p>${t.body}</p>
    </div>`).join('');

  // Page 1: header + sections
  // If many sections, they naturally flow across pages via Puppeteer page breaks.
  // Summary page, terms page, and footer are separate sections.
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet"><style>${quotationStyles}</style></head>
<body>

  ${bgPageDiv}

  <!-- Header + Sections -->
  <table style="width: 100%; border-collapse: collapse; border-spacing: 0;">
    <thead><tr><td><div style="height: 40px;"></div></td></tr></thead>
    <tbody><tr><td style="padding: 0 50px;">
      <div class="q-page">
        <div class="q-content">

          <div class="q-logo">${logoImg}</div>

      <div class="q-company-name">
        <span class="brand">EM</span> <span class="fancy">Furniture &amp; interior</span>&#169;
      </div>

      <div class="q-header-row">
        <div class="q-company-info">
          ${docConfig.companyAddress}<br>
          ${docConfig.companyPhone}<br>
          ${docConfig.companyWebsite}<br>
          RC: ${docConfig.rcNumber}
        </div>
        <div class="q-title-block">
          <div class="q-title">Quotation</div>
          <div class="q-ref">
            <span class="label">Reference Number:</span>&nbsp;&nbsp;${escapeHtml(referenceNumber)}<br>
            <span class="label">Date:</span>&nbsp;&nbsp;${escapeHtml(dateStr)}
          </div>
        </div>
      </div>

      <div class="q-client-box">
        <h4>Client Information:</h4>
        <p>
          <span class="lbl">Name:</span> ${escapeHtml(clientName)}
          ${clientPhone ? `<br><span class="lbl">Phone Number:</span> ${escapeHtml(clientPhone)}` : ''}
        </p>
      </div>

      ${sectionBlocks}

        </div>
      </div>
    </td></tr></tbody>
    <tfoot><tr><td><div style="height: 40px;"></div></td></tr></tfoot>
  </table>

  <!-- Summary -->
  <table style="width: 100%; border-collapse: collapse; border-spacing: 0; page-break-before: always;">
    <thead><tr><td><div style="height: 40px;"></div></td></tr></thead>
    <tbody><tr><td style="padding: 0 50px;">
      <div class="q-page">
        <div class="q-content">

          <h2 class="q-summary-title">Summary</h2>
      <table class="q-summary-table">
        <thead><tr><th>Description</th><th class="right">Cost</th></tr></thead>
        <tbody>
          ${summaryRowsHtml}
          <tr class="total-row"><td><strong>Total</strong></td><td class="right">${Number(grandTotal).toLocaleString('en-NG')}</td></tr>
        </tbody>
      </table>
        ${computedProjectFee > 0 ? `<div style="margin-top: 8px; margin-bottom: 16px; font-size: 11px; color: #555; text-align: left;"><em>* Kindly note that any unutilized project management and procurement fee will be refunded upon completion of the project.</em></div>` : ''}
          ${depositRows}

        </div>
      </div>
    </td></tr></tbody>
    <tfoot><tr><td><div style="height: 40px;"></div></td></tr></tfoot>
  </table>

  <!-- Terms & Conditions -->
  <table style="width: 100%; border-collapse: collapse; border-spacing: 0; page-break-before: always;">
    <thead><tr><td><div style="height: 40px;"></div></td></tr></thead>
    <tbody><tr><td style="padding: 0 50px;">
      <div class="q-page">
        <div class="q-content">

          <h2 class="q-terms-title">Terms <span class="amp">&amp;</span> Conditions</h2>
      ${termsHTML}

      <div class="q-footer">
        <div class="q-bank">
          <h4>Account Details</h4>
          <p>
            ${docConfig.bankName}<br>
            Account Number: ${docConfig.accountNumber}<br>
            Account Name: ${docConfig.accountName}
          </p>
        </div>
        <div class="q-sig">
          <p>Signed</p>
          <p>Management</p>
        </div>
      </div>

        </div>
      </div>
    </td></tr></tbody>
    <tfoot><tr><td><div style="height: 40px;"></div></td></tr></tfoot>
  </table>

</body>
</html>`;
};

/* ── DELIVERY NOTE / WAYBILL TEMPLATE ────────────────── */

export const deliveryNoteHTML = (order) => {
  const bgDiv = docConfig.bgImageUrl
    ? `<div class="receipt-bg" style="background-image: url('${docConfig.bgImageUrl}');"></div>`
    : `<div class="receipt-bg lines-pattern"></div>`;

  const logoImg = docConfig.logoUrl
    ? `<img src="${docConfig.logoUrl}" alt="EM Furniture">`
    : '';

  const clientName = escapeHtml(order.shippingAddress?.fullName || order.customer?.name || 'Customer');
  const street = escapeHtml(order.shippingAddress?.streetAddress || '');
  const cityState = escapeHtml([order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', '));
  const phone = escapeHtml(order.shippingAddress?.phone || order.customer?.phone || '—');
  const email = escapeHtml(order.shippingAddress?.email || order.customer?.email || '—');
  const dateStr = escapeHtml(formatDate(order.createdAt || new Date()));
  const deliveryNotes = escapeHtml(order.shippingAddress?.notes || order.notes || '');
  const orderNumber = escapeHtml(order.orderNumber || '');
  const shippingMethod = escapeHtml(order.shippingMethod || 'Standard Delivery');
  const trackingNumber = escapeHtml(order.trackingNumber || 'Direct Dispatch');

  const itemsHTML = (order.items || []).map((item, idx) => {
    const qty = Number(item.quantity) || 1;
    const name = escapeHtml(item.name || 'Furniture Item');
    const variant = item.variant ? `<br><small style="color: #666;">Variant: ${escapeHtml(item.variant)}</small>` : '';
    return `
      <tr>
        <td style="text-align: center; width: 40px; color: #777;">${idx + 1}</td>
        <td><strong>${name}</strong>${variant}</td>
        <td style="text-align: center; width: 80px; font-weight: 600; font-size: 15px;">${qty}</td>
        <td style="text-align: center; width: 140px; color: #555; font-size: 11px;">[ &nbsp; ] Verified Good</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    ${receiptStyles}
    .dispatch-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
      font-size: 12px;
      line-height: 1.6;
    }
    .info-card {
      border: 1px solid #e5e5e5;
      background: rgba(255, 255, 255, 0.85);
      padding: 14px 16px;
      border-radius: 4px;
    }
    .info-card h4 {
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 1px;
      color: #777;
      margin-bottom: 6px;
      border-bottom: 1px solid #eee;
      padding-bottom: 4px;
    }
    .dn-items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }
    .dn-items th {
      background: #222;
      color: #fff;
      padding: 10px 12px;
      font-weight: 600;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .dn-items td {
      padding: 10px 12px;
      border-bottom: 1px solid #eee;
      background: rgba(255, 255, 255, 0.7);
    }
    .sign-blocks {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 30px;
    }
    .sign-card {
      border: 1px solid #ddd;
      background: rgba(255, 255, 255, 0.9);
      padding: 12px;
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.8;
    }
    .sign-card h5 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #222;
      margin-bottom: 8px;
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 4px;
    }
    .sign-line {
      margin-top: 24px;
      border-bottom: 1px solid #999;
      height: 1px;
    }
  </style>
</head>
<body>
  ${bgDiv}
  <table style="width: 100%; border-collapse: collapse;">
    <thead><tr><td><div style="height: 30px;"></div></td></tr></thead>
    <tbody><tr><td style="padding: 0 45px;">
      <div class="receipt-content">
        <div class="logo-section">${logoImg}</div>
        <div class="company-name">
          <span class="brand">EM</span> <span class="fancy">Furniture &amp; interior</span>&#169;
        </div>
        <h1 class="receipt-title" style="font-size: 24px; letter-spacing: 6px;">DELIVERY NOTE / WAYBILL</h1>

        <div class="dispatch-info">
          <div class="info-card">
            <h4>Deliver To (Consignee)</h4>
            <div style="font-weight: 600; font-size: 14px; color: #111;">${clientName}</div>
            ${street ? `<div>${street}</div>` : ''}
            ${cityState ? `<div>${cityState}</div>` : ''}
            <div><strong>Phone:</strong> ${phone}</div>
            ${email && email !== '—' ? `<div><strong>Email:</strong> ${email}</div>` : ''}
          </div>
          <div class="info-card">
            <h4>Waybill Details</h4>
            <div><strong>Waybill / Order No:</strong> ${orderNumber}</div>
            <div><strong>Dispatch Date:</strong> ${dateStr}</div>
            <div><strong>Delivery Method:</strong> ${shippingMethod}</div>
            <div><strong>Tracking / Courier:</strong> ${trackingNumber}</div>
            <div><strong>Company RC:</strong> ${docConfig.rcNumber}</div>
          </div>
        </div>

        <table class="dn-items">
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">#</th>
              <th>Description &amp; Specifications</th>
              <th style="text-align: center; width: 80px;">Quantity</th>
              <th style="text-align: center; width: 140px;">Check Status</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        ${deliveryNotes ? `
          <div class="info-card" style="margin-bottom: 20px;">
            <h4>Delivery Instructions / Notes</h4>
            <p style="font-size: 11px; color: #444;">${deliveryNotes}</p>
          </div>
        ` : ''}

        <div class="sign-blocks">
          <div class="sign-card">
            <h5>1. Dispatched By</h5>
            <div>Warehouse / Production</div>
            <div class="sign-line"></div>
            <div>Name: _____________________</div>
            <div>Signature: ________________</div>
            <div>Date: ____________________</div>
          </div>
          <div class="sign-card">
            <h5>2. Delivered By</h5>
            <div>Logistics / Driver</div>
            <div class="sign-line"></div>
            <div>Name: _____________________</div>
            <div>Vehicle: __________________</div>
            <div>Date: ____________________</div>
          </div>
          <div class="sign-card" style="border-color: #333;">
            <h5>3. Received in Good Condition</h5>
            <div style="font-size: 10px; color: #555; line-height: 1.3;">I confirm receipt of the goods in complete and undamaged condition.</div>
            <div class="sign-line"></div>
            <div>Recipient: ________________</div>
            <div>Signature: ________________</div>
            <div>Date: ____________________</div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #777;">
          ${docConfig.companyAddress} &bull; Tel: ${docConfig.companyPhone} &bull; ${docConfig.companyWebsite}
        </div>
      </div>
    </td></tr></tbody>
    <tfoot><tr><td><div style="height: 30px;"></div></td></tr></tfoot>
  </table>
</body>
</html>`;
};

/* ── PURCHASE ORDER TEMPLATE ─────────────────────────── */

export const purchaseOrderHTML = (po) => {
  const bgDiv = docConfig.bgImageUrl
    ? `<div class="receipt-bg" style="background-image: url('${docConfig.bgImageUrl}');"></div>`
    : `<div class="receipt-bg lines-pattern"></div>`;

  const logoImg = docConfig.logoUrl
    ? `<img src="${docConfig.logoUrl}" alt="EM Furniture">`
    : '';

  const poDate = escapeHtml(formatDate(po.createdAt || new Date()));
  const expectedDate = escapeHtml(po.expectedOn ? formatDate(po.expectedOn) : 'As agreed');
  const vendorName = escapeHtml(po.vendor?.name || 'Supplier');
  const vendorPhone = escapeHtml(po.vendor?.phone || '—');
  const vendorEmail = escapeHtml(po.vendor?.email || '—');
  const vendorAddress = escapeHtml(po.vendor?.address || '—');
  const poNumber = escapeHtml(po.poNumber || '');
  const poStatus = escapeHtml(String(po.status || 'draft').toUpperCase());
  const poNotes = escapeHtml(po.notes || '');

  const itemsHTML = (po.items || []).map((item, idx) => {
    const qty = Number(item.quantity) || 1;
    const unitCost = Number(item.unitCost) || 0;
    const lineTotal = Number(item.lineTotal) || (qty * unitCost);

    return `
      <tr>
        <td style="text-align: center; width: 40px; color: #777;">${idx + 1}</td>
        <td><strong>${escapeHtml(item.name || 'Materials / Stock Item')}</strong></td>
        <td style="text-align: center; width: 70px;">${qty}</td>
        <td style="text-align: right; width: 110px;">${formatCurrency(unitCost)}</td>
        <td style="text-align: right; width: 120px; font-weight: 600;">${formatCurrency(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    ${receiptStyles}
    .po-parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
      font-size: 12px;
      line-height: 1.6;
    }
    .party-card {
      border: 1px solid #e5e5e5;
      background: rgba(255, 255, 255, 0.85);
      padding: 14px 16px;
      border-radius: 4px;
    }
    .party-card h4 {
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 1px;
      color: #777;
      margin-bottom: 6px;
      border-bottom: 1px solid #eee;
      padding-bottom: 4px;
    }
    .po-items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .po-items th {
      background: #1e293b;
      color: #fff;
      padding: 10px 12px;
      font-weight: 600;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .po-items td {
      padding: 10px 12px;
      border-bottom: 1px solid #eee;
      background: rgba(255, 255, 255, 0.7);
    }
    .po-total-card {
      width: 280px;
      margin-left: auto;
      margin-bottom: 24px;
      border: 1px solid #222;
      background: #fff;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
    }
    .po-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 30px;
    }
    .sign-box {
      border: 1px solid #ddd;
      background: rgba(255, 255, 255, 0.9);
      padding: 14px;
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.8;
    }
    .sign-box h5 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #222;
      margin-bottom: 8px;
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 4px;
    }
    .line {
      margin-top: 30px;
      border-bottom: 1px solid #999;
      height: 1px;
    }
  </style>
</head>
<body>
  ${bgDiv}
  <table style="width: 100%; border-collapse: collapse;">
    <thead><tr><td><div style="height: 30px;"></div></td></tr></thead>
    <tbody><tr><td style="padding: 0 45px;">
      <div class="receipt-content">
        <div class="logo-section">${logoImg}</div>
        <div class="company-name">
          <span class="brand">EM</span> <span class="fancy">Furniture &amp; interior</span>&#169;
        </div>
        <h1 class="receipt-title" style="font-size: 24px; letter-spacing: 6px;">PURCHASE ORDER</h1>

        <div class="po-parties">
          <div class="party-card">
            <h4>Vendor / Supplier</h4>
            <div style="font-weight: 600; font-size: 14px; color: #111;">${vendorName}</div>
            ${vendorAddress && vendorAddress !== '—' ? `<div>${vendorAddress}</div>` : ''}
            <div><strong>Phone:</strong> ${vendorPhone}</div>
            <div><strong>Email:</strong> ${vendorEmail}</div>
          </div>
          <div class="party-card">
            <h4>Order Information</h4>
            <div><strong>PO Number:</strong> ${poNumber}</div>
            <div><strong>Date Issued:</strong> ${poDate}</div>
            <div><strong>Expected Delivery:</strong> ${expectedDate}</div>
            <div><strong>Status:</strong> ${poStatus}</div>
            <div><strong>Company RC:</strong> ${docConfig.rcNumber}</div>
          </div>
        </div>

        <table class="po-items">
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">#</th>
              <th>Item / Material Description</th>
              <th style="text-align: center; width: 70px;">Qty</th>
              <th style="text-align: right; width: 110px;">Unit Cost</th>
              <th style="text-align: right; width: 120px;">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div class="po-total-card">
          <span style="font-weight: 600; text-transform: uppercase; font-size: 12px;">Total Order Value:</span>
          <span style="font-weight: 700; font-size: 16px; color: #111;">${formatCurrency(po.total || 0)}</span>
        </div>

        ${poNotes ? `
          <div class="party-card" style="margin-bottom: 20px;">
            <h4>Terms &amp; Instructions</h4>
            <p style="font-size: 11px; color: #444;">${poNotes}</p>
          </div>
        ` : ''}

        <div class="po-signatures">
          <div class="sign-box">
            <h5>Authorized Procurement</h5>
            <div style="font-size: 10px; color: #666;">EM Modern Furniture and Interior Ltd</div>
            <div class="line"></div>
            <div>Authorized Signature: __________________</div>
            <div>Date: _________________________________</div>
          </div>
          <div class="sign-box">
            <h5>Supplier Acceptance</h5>
            <div style="font-size: 10px; color: #666;">Acknowledged &amp; Agreed</div>
            <div class="line"></div>
            <div>Supplier Signature: ____________________</div>
            <div>Date: _________________________________</div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #777;">
          Delivery Address: ${docConfig.companyAddress} &bull; Tel: ${docConfig.companyPhone} &bull; ${docConfig.companyWebsite}
        </div>
      </div>
    </td></tr></tbody>
    <tfoot><tr><td><div style="height: 30px;"></div></td></tr></tfoot>
  </table>
</body>
</html>`;
};

/* ── EMPLOYEE PAYSLIP TEMPLATE ───────────────────────── */

export const payslipHTML = (slip, run) => {
  const bgDiv = docConfig.bgImageUrl
    ? `<div class="receipt-bg" style="background-image: url('${docConfig.bgImageUrl}');"></div>`
    : `<div class="receipt-bg lines-pattern"></div>`;

  const logoImg = docConfig.logoUrl
    ? `<img src="${docConfig.logoUrl}" alt="EM Furniture">`
    : '';

  const periodDate = new Date(run.period);
  const periodStr = escapeHtml(periodDate.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }));
  const dateGenerated = escapeHtml(formatDate(new Date()));

  const employeeName = escapeHtml(slip.employee?.fullName || 'Staff Member');
  const jobTitle = escapeHtml(slip.employee?.jobTitle || 'Employee');
  const rawBankInfo = slip.employee?.bankAccount
    ? `${slip.employee.bankName ? slip.employee.bankName + ' · ' : ''}${slip.employee.bankAccount}`
    : 'Cash / Direct';
  const bankInfo = escapeHtml(rawBankInfo);

  const gross = Number(slip.gross) || 0;
  const paye = Number(slip.paye) || 0;
  const pension = Number(slip.pension) || 0;
  const otherDeductions = Number(slip.otherDeductions) || 0;
  const totalDeductions = paye + pension + otherDeductions;
  const net = Number(slip.net) || (gross - totalDeductions);
  const employerPension = Number(slip.employerPension) || 0;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    ${receiptStyles}
    .slip-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
      font-size: 12px;
      line-height: 1.6;
    }
    .slip-card {
      border: 1px solid #e5e5e5;
      background: rgba(255, 255, 255, 0.85);
      padding: 14px 16px;
      border-radius: 4px;
    }
    .slip-card h4 {
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 1px;
      color: #777;
      margin-bottom: 6px;
      border-bottom: 1px solid #eee;
      padding-bottom: 4px;
    }
    .breakdown-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .breakdown-table th {
      background: #1e293b;
      color: #fff;
      padding: 10px 14px;
      font-weight: 600;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .breakdown-table td {
      padding: 10px 14px;
      border-bottom: 1px solid #eee;
      background: rgba(255, 255, 255, 0.7);
    }
    .net-banner {
      background: #f8fafc;
      border: 2px solid #0f172a;
      border-radius: 6px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .net-label {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #0f172a;
    }
    .net-val {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      font-family: monospace;
    }
  </style>
</head>
<body>
  ${bgDiv}
  <table style="width: 100%; border-collapse: collapse;">
    <thead><tr><td><div style="height: 30px;"></div></td></tr></thead>
    <tbody><tr><td style="padding: 0 45px;">
      <div class="receipt-content">
        <div class="logo-section">${logoImg}</div>
        <div class="company-name">
          <span class="brand">EM</span> <span class="fancy">Furniture &amp; interior</span>&#169;
        </div>
        <h1 class="receipt-title" style="font-size: 24px; letter-spacing: 6px;">EMPLOYEE PAYSLIP</h1>

        <div class="slip-grid">
          <div class="slip-card">
            <h4>Employee Details</h4>
            <div style="font-weight: 600; font-size: 14px; color: #111;">${employeeName}</div>
            <div><strong>Designation:</strong> ${jobTitle}</div>
            <div><strong>Payment Account:</strong> ${bankInfo}</div>
          </div>
          <div class="slip-card">
            <h4>Payroll Summary</h4>
            <div><strong>Pay Period:</strong> ${periodStr}</div>
            <div><strong>Payslip Ref:</strong> PAY-${String(run.period).slice(0, 7).replace('-', '')}-${(slip._id || slip.id || '0000').slice(0, 8).toUpperCase()}</div>
            <div><strong>Issue Date:</strong> ${dateGenerated}</div>
            <div><strong>Company RC:</strong> ${docConfig.rcNumber}</div>
          </div>
        </div>

        <table class="breakdown-table">
          <thead>
            <tr>
              <th>Earnings (Gross)</th>
              <th style="text-align: right; width: 140px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Wages &amp; Allowances</td>
              <td style="text-align: right; font-family: monospace; font-weight: 600;">${formatCurrency(gross)}</td>
            </tr>
            <tr style="background: #f1f5f9; font-weight: 600;">
              <td>Total Gross Earnings</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(gross)}</td>
            </tr>
          </tbody>
        </table>

        <table class="breakdown-table">
          <thead>
            <tr>
              <th>Statutory &amp; Voluntary Deductions</th>
              <th style="text-align: right; width: 140px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PAYE Tax Withheld</td>
              <td style="text-align: right; font-family: monospace; color: #b91c1c;">${formatCurrency(paye)}</td>
            </tr>
            <tr>
              <td>Employee Pension (8%)</td>
              <td style="text-align: right; font-family: monospace; color: #b91c1c;">${formatCurrency(pension)}</td>
            </tr>
            ${otherDeductions > 0 ? `
              <tr>
                <td>Other Deductions / Advances</td>
                <td style="text-align: right; font-family: monospace; color: #b91c1c;">${formatCurrency(otherDeductions)}</td>
              </tr>
            ` : ''}
            <tr style="background: #f1f5f9; font-weight: 600;">
              <td>Total Deductions</td>
              <td style="text-align: right; font-family: monospace; color: #b91c1c;">${formatCurrency(totalDeductions)}</td>
            </tr>
          </tbody>
        </table>

        <div class="net-banner">
          <div>
            <div class="net-label">Net Take-Home Pay</div>
            <div style="font-size: 11px; color: #64748b;">Disbursed to employee bank account</div>
          </div>
          <div class="net-val">${formatCurrency(net)}</div>
        </div>

        <div class="slip-card" style="margin-bottom: 20px; font-size: 11px;">
          <h4>Employer Statutory Contribution (Informational)</h4>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span>Employer Pension Contribution (10%):</span>
            <strong style="font-family: monospace;">${formatCurrency(employerPension)}</strong>
          </div>
          <div style="font-size: 10px; color: #666; margin-top: 2px;">Contributed by the company directly to the employee pension fund administrator (PFA).</div>
        </div>

        <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #777;">
          Private &amp; Confidential &bull; Generated by ${docConfig.accountName} Payroll System &bull; ${docConfig.companyAddress}
        </div>
      </div>
    </td></tr></tbody>
    <tfoot><tr><td><div style="height: 30px;"></div></td></tr></tfoot>
  </table>
</body>
</html>`;
};

/* ── ORDER-BASED TEMPLATE ────────────────────────────── */

export const orderDocumentHTML = (order, documentType = 'invoice') => {
  const docType = (documentType || 'invoice').toLowerCase();

  if (docType === 'delivery_note' || docType === 'delivery-note' || docType === 'waybill') {
    return deliveryNoteHTML(order);
  }

  const titleMap = { invoice: 'Invoice', receipt: 'Receipt', quotation: 'Quotation' };
  const title = titleMap[docType] || 'Invoice';

  const brandedItems = order.items.map(item => ({
    description: item.name + (item.quantity > 1 ? ` (\u00d7${item.quantity})` : ''),
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.price) || ((Number(item.quantity) || 1) > 0
      ? Number(item.subtotal) / (Number(item.quantity) || 1)
      : Number(item.subtotal)),
    lineTotal: Number(item.subtotal) || 0,
    price: item.subtotal,
  }));

  if (docType === 'receipt') {
    return receiptHTML({
      clientName: order.shippingAddress?.fullName || '',
      invoiceNumber: order.orderNumber,
      date: formatDate(order.createdAt),
      items: brandedItems,
      total: order.totalAmount,
      amountPaid: order.amountPaid ?? (order.paymentStatus === 'paid' ? order.totalAmount : 0),
    });
  }

  if (docType === 'invoice') {
    return invoiceHTML({
      clientName: order.shippingAddress?.fullName || '',
      invoiceNumber: order.orderNumber,
      date: formatDate(order.createdAt),
      items: brandedItems,
      total: order.totalAmount,
    });
  }

  // Quotation: group order items into a single "Items" section for order-based quotations
  // For richer multi-section quotations, use the custom document endpoint with sections.
  return quotationHTML({
    clientName: order.shippingAddress?.fullName || '',
    clientPhone: order.shippingAddress?.phone || '',
    referenceNumber: order.orderNumber,
    date: formatDate(order.createdAt),
    sections: [{
      name: 'Items',
      items: order.items.map(item => ({
        description: item.name + (item.quantity > 1 ? ` (\u00d7${item.quantity})` : ''),
        price: item.subtotal,
      })),
    }],
  });
};

/* ── CUSTOM / MANUAL TEMPLATE ────────────────────────── */

export const customDocumentHTML = (data) => {
  const {
    documentType = 'invoice',
    documentNumber,
    clientName,
    clientEmail,
    clientPhone,
    clientAddress,
    items = [],
    notes,
    validityDays,
    discountType,
    discountValue,
    miscellaneousFee,
    projectFeeType,
    projectFeeValue,
    depositType,
    depositValue,
    relatedDocumentNumber,
    paymentMethod,
    paymentReference,
  } = data;

  const titleMap = { invoice: 'Invoice', receipt: 'Receipt', quotation: 'Quotation' };
  const title = titleMap[documentType.toLowerCase()] || 'Invoice';

  const brandedItems = items.map(item => ({
    description: item.description,
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.price) || 0,
    lineTotal: (Number(item.quantity) || 1) * (Number(item.price) || 0),
    price: (item.quantity || 1) * (item.price || 0),
  }));
  let calcTotal = 0;
  items.forEach(item => { calcTotal += (item.quantity || 1) * (item.price || 0); });

  if (documentType.toLowerCase() === 'receipt') {
    return receiptHTML({
      clientName: clientName || '',
      receiptNumber: documentNumber,
      forInvoiceNumber: relatedDocumentNumber || null,
      paymentMethod,
      paymentReference,
      date: formatDate(new Date()),
      items: brandedItems,
      total: data.totalAmount || calcTotal,
      amountPaid: data.amountPaid,
      notes,
      discountType,
      discountValue,
    });
  }

  if (documentType.toLowerCase() === 'invoice') {
    return invoiceHTML({
      clientName: clientName || '',
      invoiceNumber: documentNumber,
      date: formatDate(new Date()),
      items: brandedItems,
      total: data.totalAmount || calcTotal,
      amountPaid: data.amountPaid,
      depositPercent: data.depositPercent,
      notes,
      discountType,
      discountValue,
    });
  }

  // Quotation: supports sections (grouped items per room/area)
  // If data.sections is provided, use it directly; otherwise wrap flat items into one section.
  const sections = data.sections && Array.isArray(data.sections) && data.sections.length > 0
    ? data.sections.map(s => ({
        name: s.name,
        items: (s.items || []).map(it => ({
          description: it.description,
          price: (it.quantity || 1) * (it.price || 0),
        })),
      }))
    : [{
        name: 'Items',
        items: brandedItems,
      }];

  return quotationHTML({
    clientName: clientName || '',
    clientPhone: clientPhone || '',
    referenceNumber: documentNumber,
    date: formatDate(new Date()),
    sections,
    discountType,
    discountValue,
    miscellaneousFee,
    projectFeeType,
    projectFeeValue,
    depositType,
    depositValue,
    // (Ensure you pass them down if quotationHTML supports them, but for now just pass totalAmount or use sections)
    totalAmount: data.totalAmount,
    depositPercent: data.depositPercent,
    terms: data.terms,
  });
};
