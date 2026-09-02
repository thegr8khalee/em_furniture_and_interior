# Backend Tests

```bash
npm test                  # all suites
npm test -- --coverage    # with coverage
npm test app              # one file
npm test -- --watch       # watch mode
```

Runs in CI on every push (`.github/workflows/ci.yml`).

## What is covered

Every test imports real application code. There are no assertions on literals
the test itself constructed — if a file has no `src/` import, it is not a test.

### `__tests__/integration/app.test.js`

Drives the real Express app through Supertest. `src/app.js` builds and exports
the app without listening, so the whole middleware stack is exercised in-process
with no server and no database.

- **Health probes.** `/healthz` answers without touching Mongo (liveness must
  not fail because the database blipped). `/readyz` answers 503 while the
  database is unreachable, so a load balancer drains the instance instead. Both
  sit outside `/api`, verified by firing 30 requests past the API rate limit.
- **Request correlation.** Every response carries `x-request-id`; a
  caller-supplied id is echoed so a trace can span frontend and API; an
  oversized or malformed one is replaced rather than trusted; ids differ per
  request.
- **Paystack webhook over HTTP.** Missing, forged, junk-length and
  post-signing-tampered signatures all get 401. The decisive case: a *valid*
  signature over non-JSON bytes reaches the parser and fails there — proof the
  raw body survived the middleware stack intact, which is the one thing that
  silently breaks HMAC verification.
- **Removed gateways.** The four Flutterwave and Stripe routes are 404; the
  Paystack verify route still answers 400, not 404.

### `__tests__/integration/payments.test.js`

Unit coverage of the money path.

- **Signature verification** — correct signature, tampered body, wrong secret,
  forged signature of the correct length, a short signature (which throws inside
  `crypto.timingSafeEqual` without the length guard), missing header, missing
  `PAYSTACK_SECRET_KEY`, and a re-serialised body, which must fail.
- **Amount verification** — a charge applies only when the gateway's amount
  equals the order total in kobo and the currency is NGN. Underpayment,
  overpayment, wrong currency, malformed payloads, kobo-level precision.
- **Tax calculation** — rate from `TAX_RATE_PERCENTAGE`, and the validation
  error when no items are supplied.

## What is not covered yet

Most of the API. The two suites that previously claimed to cover auth, cart,
wishlist, products, coupons, consultations, analytics and orders asserted on
objects they had just built themselves, so they passed regardless of what the
application did. They were deleted rather than left to give false confidence.

Real coverage of those areas needs a database, and the plan is to add it against
Postgres during the migration rather than build a Mongo harness that is thrown
away. `src/app.js` is already exported for exactly that purpose — a suite that
needs data can spin a database, import `app`, and drive it with Supertest the
same way `app.test.js` does.

## Conventions

1. Import the thing under test from `src/`.
2. Assert on a real return value or a real HTTP response, never on a literal the
   test just wrote.
3. Mock at the boundary — `fetch`, Cloudinary, the mailer — not the module under
   test.
4. Cover the failure path. For anything touching money or auth, cover the
   hostile path too.

## Manual webhook check

The Postman collection has a **Paystack Webhook (charge.success)** request whose
pre-request script signs the body with `paystackSecretKey`. Clear that variable
to confirm the endpoint answers 401; edit the body after signing to confirm it
rejects tampering.
