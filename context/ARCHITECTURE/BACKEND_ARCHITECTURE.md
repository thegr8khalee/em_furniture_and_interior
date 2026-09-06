# Backend Architecture

> The API in `apps/api`: Node.js, Express, PostgreSQL. For the data model and the
> reasoning behind each table, see [`docs/SCHEMA.md`](../../docs/SCHEMA.md).

---

## 1. Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js (ESM throughout — `"type": "module"`) |
| Framework | Express |
| Database | PostgreSQL, hosted on Supabase |
| Access | Sequelize, used as a connection pool and query runner — hand-written SQL, no models |
| Auth | jsonwebtoken + bcryptjs, with Supabase Auth accepted alongside |
| Images | Cloudinary |
| Email | googleapis + Nodemailer |
| Rate limiting | express-rate-limit |
| Testing | Jest with `--experimental-vm-modules`, supertest, a real database per worker |

**There is no ORM layer.** Services write SQL and pass `replacements`. This is
deliberate: the interesting logic here is relational — a trial balance, a
payables ageing, stock derived from a movement log — and expressing it through a
model layer meant either raw queries anyway or several round trips where one
statement would do.

---

## 2. How a request is served

```
routes/*.routes.js      what the URL is, who may call it, what is audited
  └─ middleware          protectRoute · protectAdminRoute · requirePermissions
       └─ controllers/*  parse the request, translate the error, shape the reply
            └─ services/*  the rules, the SQL, and the transaction
                 └─ db/sequelize.js
```

The split is strict, and the reason is testability: every rule lives in a
service function that takes a database handle, so it can be exercised without an
HTTP layer, and a controller is small enough to read in one go.

Each service exports its own typed error — `IdentityError`, `OrderError`,
`BooksError`, `PurchasingError` — carrying a status. A controller's `fail`
helper turns a known error into its status and anything else into a 500 with a
log line. Nothing throws a bare string.

---

## 3. Entry point

`src/index.js` connects to PostgreSQL and refuses to bind the port without it —
a server that answers requests it cannot serve is worse than one that does not
start. `src/app.js` builds the app, so tests can import it without listening.

Order: cookie parser → CORS → body parsers → rate limiter → routes → sitemap and
health.

### Route groups

| Prefix | What it serves |
|--------|----------------|
| `/api/auth` | Shopper accounts, sign-in, password reset, `POST /supabase` |
| `/api/admin` | Operator accounts and sign-in, `POST /supabase`, catalog operations |
| `/api/products`, `/api/collections` | The public catalog |
| `/api/review` | Reviews and moderation |
| `/api/cart`, `/api/wishlist` | A shopper's or guest's basket |
| `/api/orders` | Placing an order, and the console's order management |
| `/api/payments` | Paystack and Flutterwave, redirect and webhook |
| `/api/coupons`, `/api/marketing` | Discounts, banners, flash sales |
| `/api/inventory` | Stock levels, adjustments, movement history, cost prices |
| `/api/purchasing` | Vendors, expenses, purchase orders, payables |
| `/api/books` | The ledger: trial balance, journal, reports, period close |
| `/api/finance` | The older revenue summary and its CSV export |
| `/api/analytics` | Dashboard figures and conversion reports |
| `/api/consultations`, `/api/designers` | Interiors |
| `/api/blog`, `/api/faqs`, `/api/projects` | Content, with `/api/admin/*` counterparts |
| `/api/notifications`, `/api/loyalty` | Engagement |
| `/api/logs` | Audit and activity trails |
| `/api/taxes`, `/api/contact` | Odds and ends |
| `/`, `/sitemap.xml`, `/readyz` | Health and SEO |

---

## 4. The parts worth understanding

### The ledger and the posting rules

`services/ledger.js` writes journal entries and refuses unbalanced ones.
`services/posting.js` holds the rules that turn a business event into an entry:
an order confirmed, a payment received, stock moving, an expense approved or
paid, a purchase order settled.

Every rule is idempotent — a unique index on `(source, source_id)` means a
retried webhook cannot post twice — and every one takes an optional transaction,
because a posting should commit with the thing it describes or not at all.

`services/books.js` is the read side. Nothing there recomputes a figure from
orders or payments, which is what makes the reports and the postings incapable
of disagreeing.

### Permissions

`packages/shared/src/permissions.js` is the single definition, imported by the
API and by the console's sidebar so the two cannot drift. A permission that
appears in no role list is held only by `super_admin` — that is how
`staff.manage` and `books.manage` are restricted.

### Money

Integer minor units in the database, naira on the wire. `lib/money.js` converts,
allocates a discount across lines without losing a kobo, and is the only place
that rounds.

---

## 5. Tests

`apps/api/__tests__` runs against a real PostgreSQL. Each Jest worker gets a
throwaway database copied from a migrated template, or migrates its own when the
server will not allow a template copy — which is what happens behind Supabase's
pooler.

Nothing is mocked except Cloudinary, the payment gateways and outbound email.
The database is real, so a constraint that would fire in production fires in the
suite.

Around 600 tests. `npm test --workspace @em/api`.
