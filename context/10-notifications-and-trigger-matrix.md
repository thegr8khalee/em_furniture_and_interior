# 10 — Notifications Model & Trigger Matrix

> Channels, the event → notification matrix, and delivery rules.

---

## 1. Current state `[NOW]`

- **In-app** — `notification.model.js` + `createNotification()`, surfaced at `/notifications`.
  Order-status driven.
- **Email** — three overlapping paths: `services/gmail.service.js` (Google OAuth2), the `resend`
  dependency, and `nodemailer`. `[GAP]` Consolidate to one provider with one templating layer.
- **WhatsApp** — deep links with a prefilled message from the storefront. Outbound only, no API
  integration, no delivery record.
- **SMS** — none.

No delivery status is recorded anywhere, no retry exists, and there is no per-customer preference or
unsubscribe. For transactional commerce this is thin; for an ERP where a missed payment reminder has a
cash consequence, it needs to be a tracked, retryable, auditable send.

---

## 2. Target channel model `[TARGET]`

| Channel | Use | Delivery record |
|---|---|---|
| In-app | Staff task queues, approvals awaiting action | Read receipt |
| Email | Customer transactional, statements, document delivery | Provider id, status, bounce |
| WhatsApp Cloud API | Customer order and project updates — the channel this market actually reads | Message id, delivery, read |
| SMS | Fallback for delivery-day and payment-reminder events only | Provider id, status |

**One outbox.** Every send is a row in `core_notifications` before it is dispatched: recipient, channel,
template, payload, status, attempts, provider reference. Dispatch is a worker reading the outbox, not an
inline call inside a request handler. That gives retries, an audit trail, and a request path that does not
fail because an email provider is slow — the current fire-and-forget pattern silently loses messages.

**Idempotency.** Every notification carries an event key (`order.confirmed:<order_id>`). The outbox has a
unique index on it, so a retried webhook or a double-clicked button cannot send the same message twice.

---

## 3. Trigger matrix `[TARGET]`

`C` customer · `S` assigned staff · `A` accountant · `M` manager. `—` not sent.

### Retail

| Event | In-app | Email | WhatsApp | SMS |
|---|---|---|---|---|
| Order placed (pending payment) | C | C | C | — |
| Payment confirmed (webhook) | C, S | C + invoice | C | — |
| Payment failed | C | C | — | — |
| Order confirmed | C | C | C | — |
| Dispatched, tracking added | C | C | C | — |
| Out for delivery | C | — | C | C |
| Delivered | C | C | — | — |
| Cancelled | C, S | C | C | — |
| Refund approved, credit note issued | C, A | C + credit note | — | — |
| Review request (post-delivery) | — | C | — | — |

### Interior projects

| Event | In-app | Email | WhatsApp | SMS |
|---|---|---|---|---|
| Consultation requested | S, M | C | C | — |
| Designer assigned | C, S | C | C | — |
| Consultation scheduled | C, S | C | C | C (24h before) |
| Quotation issued | C | C + PDF | C | — |
| Quotation expiring in 3 days | C, S | C | C | — |
| Quotation accepted | S, A, M | — | — | — |
| Deposit invoice issued | C | C + PDF | C | — |
| Project phase advanced | C | C | C | — |
| Installation scheduled | C, S | C | C | C (24h before) |
| Final invoice issued | C, A | C + PDF | — | — |

### Finance and operations

| Event | Recipient | Channel |
|---|---|---|
| Invoice overdue (7, 14, 30 days) | C, A | Email + WhatsApp |
| Payment received | A | In-app |
| Expense awaiting approval | A | In-app + email |
| Refund awaiting approval | A, M | In-app + email |
| Purchase order awaiting approval | A | In-app + email |
| Goods received against PO | Operations | In-app |
| Low stock below reorder point | Operations | In-app + daily email digest |
| Stock write-off awaiting approval | Operations manager | In-app + email |
| Period ready to close | A | In-app |
| Period close awaiting approval | M | In-app + email |
| **Trial balance does not net to zero** | A, M, on-call | Email + Sentry alert |
| Backup job failed | on-call | Email + Sentry alert |
| Webhook signature verification failed | on-call | Sentry alert |

---

## 4. Delivery rules

1. **Transactional only by default.** Marketing sends require explicit opt-in and honour unsubscribe;
   transactional sends do not, and the two must never share a template or a sender identity.
2. **Quiet hours 21:00–07:00 WAT** for SMS and WhatsApp, except delivery-day and on-call alerts.
3. **Never put money in a subject line** that a preview pane will expose on a lock screen.
4. **Documents go as links to signed URLs**, not as attachments — the attachment is a copy that escapes
   revocation, and `fin_documents` already holds the authoritative version.
5. **Staff approval notifications state the amount and the initiator**, because the approver's first
   question is always "who raised this and for how much?".
6. **Failures are visible.** A send that exhausts its retries raises an in-app notification to the
   accountant; silent failure on a payment reminder is a cash-flow problem, not a technical one.
