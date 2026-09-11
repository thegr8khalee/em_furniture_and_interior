-- 0024_relate_invoice_receipt.sql
--
-- Relating invoices and receipts in custom documents.
-- Allows receipts to reference a parent invoice, tracks payment methods and references,
-- and supports 'partially_paid' status on documents.

ALTER TYPE custom_document_status ADD VALUE IF NOT EXISTS 'partially_paid' AFTER 'issued';

ALTER TABLE custom_documents
  ADD COLUMN IF NOT EXISTS related_document_id uuid REFERENCES custom_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_document_number text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

CREATE INDEX IF NOT EXISTS idx_custom_documents_related ON custom_documents (related_document_id);
CREATE INDEX IF NOT EXISTS idx_custom_documents_related_number ON custom_documents (related_document_number);
