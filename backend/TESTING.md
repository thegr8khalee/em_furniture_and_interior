# Backend Tests

## Running

```bash
npm test                  # all suites
npm test -- --coverage    # with coverage
npm test payments         # one file
npm test -- --watch       # watch mode
```

## Honest state of the suite

Read this before trusting a green run.

| Suite | Tests real code? | Notes |
| --- | --- | --- |
| `__tests__/integration/payments.test.js` | **Yes** | Imports `verifyPaystackSignature`, `chargeMatchesOrder`, `toMinorUnit` and `calculateTax` and asserts against them. |
| `__tests__/integration/core.test.js` | **No** | Placebo. Builds literal objects and asserts on them — tests nothing in `src/`. |
| `__tests__/integration/features.test.js` | **No** | Placebo, same pattern. |

`core.test.js` and `features.test.js` contain assertions like
`expect(mockUser.username).toBe('John Doe')` against an object the test itself
just wrote. They pass whatever the application does, so they will stay green
through a refactor that breaks production. They are scheduled for deletion and
replacement with Supertest integration tests against a real Postgres instance
as part of the database migration — until then, treat their result as
meaningless rather than reassuring.

Do not add new tests in that style.

## What is genuinely covered

**Paystack webhook signature verification** — the security boundary for payment
confirmation. Covers a correctly signed body, a body tampered with after
signing, a signature from the wrong secret, a forged signature of the correct
length, a short signature (which would throw inside `crypto.timingSafeEqual`
without the length guard), a missing header, a missing `PAYSTACK_SECRET_KEY`,
and a re-serialised body (which must fail — proof that the raw bytes matter).

**Charge amount verification** — a charge is only applied when the gateway's
reported amount equals the order total in kobo and the currency is NGN. Covers
underpayment, overpayment, wrong currency, malformed payloads, and kobo-level
precision on fractional totals.

**Tax calculation** — rate applied from `TAX_RATE_PERCENTAGE`, and the
validation error when no items are supplied.

## Conventions for new tests

1. Import the thing under test from `src/`. If a test file has no `src/` import,
   it is not testing the application.
2. Assert on the return value or the mocked `res` of a real call, never on a
   literal the test just constructed.
3. Mock at the boundary — `fetch`, Cloudinary, the mailer — not the module under
   test.
4. Cover the failure path. For anything touching money or auth, cover the
   hostile path too.

## Manual webhook check

The Postman collection (`docs/EM_Furniture_API.postman_collection.json`) has a
**Paystack Webhook (charge.success)** request whose pre-request script signs the
body with `paystackSecretKey`. Clear that variable to confirm the endpoint
answers 401; edit the body after signing to confirm it rejects tampering.
