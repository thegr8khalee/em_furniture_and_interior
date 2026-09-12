import puppeteer from 'puppeteer';
import {
  orderDocumentHTML,
  customDocumentHTML,
  purchaseOrderHTML,
  payslipHTML,
} from './documentTemplates.js';

/* ── shared: HTML → PDF buffer via Puppeteer ─────────── */

let browserInstance = null;

const getBrowser = async () => {
  const isConnected = browserInstance
    ? (typeof browserInstance.connected === 'boolean' ? browserInstance.connected : (typeof browserInstance.isConnected === 'function' ? browserInstance.isConnected() : true))
    : false;

  if (!browserInstance || !isConnected) {
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browserInstance = await puppeteer.launch(launchOptions);
  }
  return browserInstance;
};

const htmlToPdfBuffer = async (html) => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '0px', right: '0px' },
  });
  await page.close();
  return pdfBuffer;
};

/* ── filename helper ─────────────────────────────────── */

const getFilename = (documentType, identifier) => {
  const type = documentType.toLowerCase().replace(/_/g, '-');
  return `${type}-${identifier}.pdf`;
};

/* ── order-based document ────────────────────────────── */

export const generateOrderDocumentPDF = async (order, res, documentType = 'invoice') => {
  const html = orderDocumentHTML(order, documentType);
  const pdfBuffer = await htmlToPdfBuffer(html);
  const filename = getFilename(documentType, order.orderNumber);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.end(pdfBuffer);
};

export const generateInvoicePDF = async (order, res) => {
  await generateOrderDocumentPDF(order, res, 'invoice');
};

export const generateDeliveryNotePDF = async (order, res) => {
  await generateOrderDocumentPDF(order, res, 'delivery_note');
};

/* ── purchase order document ─────────────────────────── */

export const generatePurchaseOrderPDF = async (po, res) => {
  const html = purchaseOrderHTML(po);
  const pdfBuffer = await htmlToPdfBuffer(html);
  const filename = `purchase-order-${po.poNumber}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.end(pdfBuffer);
};

/* ── employee payslip document ───────────────────────── */

export const generatePayslipPDF = async (slip, run, res) => {
  const html = payslipHTML(slip, run);
  const pdfBuffer = await htmlToPdfBuffer(html);
  const periodStr = String(run.period).slice(0, 7);
  const employeeName = (slip.employee?.fullName || 'employee')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const filename = `payslip-${periodStr}-${employeeName}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.end(pdfBuffer);
};

/* ── custom / manual document ────────────────────────── */

export const generateCustomDocumentPDF = async (data, res) => {
  const html = customDocumentHTML(data);
  const pdfBuffer = await htmlToPdfBuffer(html);
  const filename = getFilename(data.documentType, data.documentNumber);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.end(pdfBuffer);
};

