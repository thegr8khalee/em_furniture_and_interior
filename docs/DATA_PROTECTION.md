# Data Protection

> Handling of customer personal data under Nigeria's NDPR and, where applicable, GDPR.
> This document describes engineering obligations. It is not legal advice.

---

## 1. What the system holds

| Category | Where | Sensitivity |
|---|---|---|
| Identity — name, email, phone | `auth.users`, `core_profiles` | Personal data |
| Addresses — shipping, billing | `core_addresses`, order snapshots | Personal data |
| Order and payment history | `sales_*`, `fin_*` | Personal + financial |
| Room photos, floor plans | Cloudinary | Personal — **images of a customer's home** |
| Proof-of-payment uploads | Cloudinary | Financial, often shows a bank account |
| Behavioural — views, searches, cart events | `core_activity_logs` | Personal, pseudonymous |
| Staff actions | `core_audit_logs` | Employment record |

The two categories that deserve more care than they currently get are **room photos and floor plans** —
which identify where someone lives and what is in their home — and **proof-of-payment images**, which
routinely expose bank details.

---

## 2. Current gaps `[GAP]`

- **Uploads pass through the API as base64** with a 50 MB body limit, and are stored as public Cloudinary
  assets. Anyone with the URL can retrieve a customer's floor plan. `[TARGET]` authenticated assets,
  signed delivery URLs, direct browser upload.
- **No PII scrubbing in error reporting**, because there is no error reporting — but adding Sentry without
  scrubbing would ship order payloads containing full addresses to a third party.
- **No retention policy** beyond the 90-day activity-log TTL.
- **No export or erasure mechanism.** Account deletion exists (`auth.controller.js`) but its scope has not
  been reconciled against the records that must be retained for tax purposes.
- **15-day sessions with no revocation** (F-10) — a lost device stays authenticated.

---

## 3. Principles

**Minimise.** Do not collect what is not needed. Room photos are needed for a design consultation; they
are not needed after the project closes.

**Retain deliberately.** Every category gets an explicit retention period, and something enforces it.

| Category | Retention | Enforcement |
|---|---|---|
| Financial records (orders, invoices, receipts, ledger) | 7 years — statutory | Never auto-deleted |
| Room photos, floor plans | 24 months after project close | Scheduled Cloudinary deletion |
| Proof-of-payment images | 7 years — part of the financial record | Authenticated assets only |
| Activity logs | 90 days | Monthly partition drop |
| Audit logs | 7 years | Never auto-deleted |
| Marketing consent records | Until withdrawn + 3 years | — |
| Guest sessions | 7 days | Supabase anonymous user expiry |

**Separate erasure from financial retention.** A customer exercising erasure has their identity fields
redacted and their account closed; the order, invoice and ledger records **remain**, keyed to a redacted
subject. Deleting financial history to satisfy a privacy request creates a tax problem and breaks the
ledger. Redaction, not deletion, is the correct mechanism — and it must be built, because "delete the
user row" would currently orphan or cascade through order history.

---

## 4. Engineering obligations

**Access.** Personal data is reachable only through permission-gated routes. `CUSTOMER_SERVICE` sees
contact details and order status; it does not see full payment instruments or ledger detail. Every read of
a customer record by staff is written to `core_audit_logs` — an auditable answer to "who looked at this
customer, and when".

**Transport and storage.** TLS everywhere. Confidential Cloudinary assets are `authenticated`, served by
time-limited signed URLs generated per request, never by a stable public URL.

**Error reporting.** `platform/logging` strips request bodies, auth headers, cookies and query parameters
before dispatch to Sentry. Verify this against a real order payload during setup, not by reading the
config — the failure mode is silent and the data leaves the building.

**Logs.** Never log a full address, phone number, payment reference or token. Log identifiers and let an
authorised operator resolve them.

**Third parties.** Cloudinary, Supabase, Sentry, the payment gateways and the messaging providers are all
processors handling personal data. Each needs a recorded basis and a named owner —
`docs/CREDENTIAL_HANDOVER.md` when written.

---

## 5. Subject rights

| Right | Mechanism | Status |
|---|---|---|
| Access | Export of profile, orders, documents, consultations as JSON + PDFs | `[TARGET]` |
| Rectification | Profile edit; addresses on **historical orders are immutable** (they record where a thing was actually sent) | Partial |
| Erasure | Identity redaction; financial records retained per §3 | `[TARGET]` |
| Portability | The same export as Access, machine-readable | `[TARGET]` |
| Objection to marketing | Per-channel opt-out honoured in the notification outbox | `[TARGET]` |

Target: fulfil a verified request within 30 days. That is achievable only if export and redaction are
built as functions; done by hand across seven schemas, it will not be met.

---

## 6. Breach response

1. Contain — revoke keys, disable affected accounts, rotate secrets.
2. Assess — which subjects, which categories, over what window. `core_audit_logs` is the primary evidence,
   which is a reason to keep it for seven years.
3. Notify — the regulator within statutory timelines, and affected individuals where the risk warrants it.
4. Record — cause, scope, remediation, and the change that prevents recurrence.

The audit and activity logs are what make step 2 answerable at all. Treat their integrity as a security
control, not a convenience.
