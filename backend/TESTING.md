# Backend Testing

## Current state

| Suite | Tests | What it covers |
|---|---|---|
| `__tests__/integration/webhooks.test.js` | 14 | Gateway webhooks end-to-end — real Express app, real MongoDB |
| `__tests__/unit/webhookSignatures.test.js` | 16 | Signature verification and minor-unit conversion |
| `__tests__/integration/payments.test.js` | 16 | Gateway request/response shapes and tax calculation |
| **Total** | **46** | |

Run with `npm test`.

## History — read this before trusting a coverage number

This file previously reported "73 tests, comprehensive coverage". That was wrong, and the way it was
wrong is worth recording.

`core.test.js` and `features.test.js` contained 56 tests between them that **imported no application
code**. They built a plain JavaScript object and asserted on that same object:

```js
// the entire substance of one such test
expect(mockUser.username).toBe('John Doe');
```

Those tests passed regardless of what the application did. Real backend coverage was approximately 2%.
Both files have been deleted rather than repaired — a suite that reports safety it does not provide is
worse than no suite, because it stops anyone from writing a real one. This was finding **F-04** in
`context/05-erp-readiness-assessment.md`.

The lesson, now a project rule: **a test that does not import the code under test is not a test.**

## Approach

Tests run against a real MongoDB (`mongodb-memory-server`) and a real Express app via `supertest`.
Models and the request pipeline are not mocked. Only outbound HTTP to payment gateways is stubbed.

`__tests__/helpers/testApp.js` mirrors the body-parser ordering in `src/index.js` deliberately: webhook
signature verification depends on `express.raw()` being mounted ahead of `express.json()`, so the tests
exercise that arrangement rather than a more convenient one.

## Writing new tests

- Import the real module. If that is hard, the module has a dependency problem — fix that instead.
- One behaviour per test; name it after the behaviour, not the function.
- A bug fix ships with the test that would have caught it.
- Do not mock the database or the ORM.

## Not yet covered

Order creation, auth, cart, coupons, admin routes, and the remaining ~130 routes. `supertest` and the
in-memory database are now wired up, so the pattern to follow exists — see
`docs/TESTING_STRATEGY.md` for the target pyramid and CI gates.
