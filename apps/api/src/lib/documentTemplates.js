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

/* ── BRANDED DOCUMENT HTML GENERATOR ──────────────────── */

const brandedDocumentHTML = ({ title, clientName, invoiceNumber, date, items, summaryRows, notes }) => {
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
      <td>${item.description}</td>
      <td class="center">${quantity}</td>
      <td class="right">${formatReceiptAmount(unitPrice)}</td>
      <td class="right">${formatReceiptAmount(lineTotal)}</td>
    </tr>
  `;
  }).join('');

  const summaryHTML = summaryRows.map(row => `
    <tr>
      <td>${row.label}</td>
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

    <h1 class="receipt-title">${title}</h1>

    <div class="meta-section">
      <div class="issued-to">
        <div class="label">Issued To:</div>
        <div class="name">${clientName}</div>
      </div>
      <div class="invoice-meta">
        <p><span class="label">Invoice No:</span>&nbsp;&nbsp;&nbsp;${invoiceNumber}</p>
        <p><span class="label">Date:</span>&nbsp;&nbsp;&nbsp;${dateStr}</p>
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

    ${notes && String(notes).trim() ? `<div class="notes-block"><h4>Notes</h4><p>${String(notes).trim().replace(/</g, '&lt;')}</p></div>` : ''}

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

const receiptHTML = ({ clientName, invoiceNumber, date, items, total, amountPaid, notes, discountType, discountValue }) => {
  const totalAmount = Number(total) || 0;
  
  let discountAmount = 0;
  if (discountType === 'percentage' && discountValue) {
    discountAmount = Math.round(totalAmount * Number(discountValue) / 100);
  } else if (discountType === 'fixed' && discountValue) {
    discountAmount = Number(discountValue);
  }
  const grandTotal = Math.max(0, totalAmount - discountAmount);

  const paid = amountPaid != null ? Number(amountPaid) : grandTotal;
  const balance = grandTotal - paid;
  const balancePct = grandTotal > 0 ? Math.round((balance / grandTotal) * 100) : 0;
  
  const summaryRows = [{ label: discountAmount > 0 ? 'Subtotal' : 'Total', amount: totalAmount }];
  if (discountAmount > 0) {
    summaryRows.push({ label: 'Discount', amount: discountAmount });
    summaryRows.push({ label: 'Grand Total', amount: grandTotal });
  }
  summaryRows.push(
      { label: 'Paid', amount: paid },
      { label: `Balance (${balancePct}%)`, amount: balance }
  );

  return brandedDocumentHTML({
    title: 'Payment Receipt',
    clientName, invoiceNumber, date, items, notes,
    summaryRows,
  });
};

const invoiceHTML = ({ clientName, invoiceNumber, date, items, total, depositPercent, notes, discountType, discountValue }) => {
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

  if (pct > 0 && pct < 100) {
    const deposit = Math.round(grandTotal * pct / 100);
    const balance = grandTotal - deposit;
    summaryRows.push({ label: `Deposit (${pct}%)`, amount: deposit });
    summaryRows.push({ label: `Balance (${100 - pct}%)`, amount: balance });
  }
  return brandedDocumentHTML({
    title: 'Payment Invoice',
    clientName, invoiceNumber, date, items, notes,
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
      return `<tr><td>${item.description}</td><td class="right">${Number(amt).toLocaleString('en-NG')}</td></tr>`;
    }).join('');

    return `
      <h2 class="q-section-title">${section.name}</h2>
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
    return `<tr><td>${section.name}</td><td class="right">${Number(cost).toLocaleString('en-NG')}</td></tr>`;
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
            <span class="label">Reference Number:</span>&nbsp;&nbsp;${referenceNumber}<br>
            <span class="label">Date:</span>&nbsp;&nbsp;${dateStr}
          </div>
        </div>
      </div>

      <div class="q-client-box">
        <h4>Client Information:</h4>
        <p>
          <span class="lbl">Name:</span> ${clientName}
          ${clientPhone ? `<br><span class="lbl">Phone Number:</span> ${clientPhone}` : ''}
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

/* ── ORDER-BASED TEMPLATE ────────────────────────────── */

export const orderDocumentHTML = (order, documentType = 'invoice') => {
  const titleMap = { invoice: 'Invoice', receipt: 'Receipt', quotation: 'Quotation' };
  const title = titleMap[documentType.toLowerCase()] || 'Invoice';

  const brandedItems = order.items.map(item => ({
    description: item.name + (item.quantity > 1 ? ` (\u00d7${item.quantity})` : ''),
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.price) || ((Number(item.quantity) || 1) > 0
      ? Number(item.subtotal) / (Number(item.quantity) || 1)
      : Number(item.subtotal)),
    lineTotal: Number(item.subtotal) || 0,
    price: item.subtotal,
  }));

  if (documentType.toLowerCase() === 'receipt') {
    return receiptHTML({
      clientName: order.shippingAddress?.fullName || '',
      invoiceNumber: order.orderNumber,
      date: formatDate(order.createdAt),
      items: brandedItems,
      total: order.totalAmount,
      amountPaid: order.amountPaid ?? (order.paymentStatus === 'paid' ? order.totalAmount : 0),
    });
  }

  if (documentType.toLowerCase() === 'invoice') {
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
      invoiceNumber: documentNumber,
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
