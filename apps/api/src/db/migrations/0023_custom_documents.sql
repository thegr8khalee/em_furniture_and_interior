-- 0023_custom_documents.sql
--
-- Persisting custom documents built via Document Builder.
--
-- Custom quotations, manual invoices, and walk-in receipts previously existed
-- only in-memory and were streamed as ephemeral PDFs. This table gives them a
-- permanent audit trail, allows re-downloading at any time, and allows staff to
-- track statuses (draft, issued, paid, cancelled) and load past documents.

CREATE TYPE custom_document_type AS ENUM ('invoice', 'receipt', 'quotation');
CREATE TYPE custom_document_status AS ENUM ('draft', 'issued', 'paid', 'cancelled');

CREATE TABLE custom_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number   text NOT NULL UNIQUE,
  document_type     custom_document_type NOT NULL,
  client_name       text NOT NULL,
  client_email      citext,
  client_phone      text,
  client_address    text,
  customer_id       uuid REFERENCES customers(id) ON DELETE SET NULL,
  notes             text,
  validity_days     integer DEFAULT 14,
  deposit_percent   numeric(5, 2),
  deposit_type      text,
  deposit_value     numeric(12, 2),
  project_fee_type  text,
  project_fee_value numeric(12, 2),
  discount_type     text,
  discount_value    numeric(12, 2),
  subtotal_kobo     bigint NOT NULL DEFAULT 0,
  total_kobo        bigint NOT NULL DEFAULT 0,
  amount_paid_kobo  bigint NOT NULL DEFAULT 0,
  balance_kobo      bigint NOT NULL DEFAULT 0,
  status            custom_document_status NOT NULL DEFAULT 'issued',
  data              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by        uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER custom_documents_updated_at BEFORE UPDATE ON custom_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_custom_documents_type ON custom_documents (document_type);
CREATE INDEX idx_custom_documents_status ON custom_documents (status);
CREATE INDEX idx_custom_documents_customer ON custom_documents (customer_id);
CREATE INDEX idx_custom_documents_created_at ON custom_documents (created_at DESC);
