import puppeteer from 'puppeteer';
import { orderDocumentHTML, customDocumentHTML } from './documentTemplates.js';

/* ── shared: HTML → PDF buffer via Puppeteer ─────────── */

let browserInstance = null;

const getBrowser = async () => {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
};

const htmlToPdfBuffer = async (html) => {
  const browser = await getBrowser();
  const page = await browser.newPage();
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
  const type = documentType.toLowerCase();
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

/* ── custom / manual document ────────────────────────── */

export const generateCustomDocumentPDF = async (data, res) => {
  const html = customDocumentHTML(data);
  const pdfBuffer = await htmlToPdfBuffer(html);
  const filename = getFilename(data.documentType, data.documentNumber);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.end(pdfBuffer);
};
