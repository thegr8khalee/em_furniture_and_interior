# Testing Strategy

> Test pyramid, tooling, and CI gates. Replaces the current suite entirely.

---

## 1. Where things stand `[NOW]`

`backend/TESTING.md` advertises 73 passing tests as "comprehensive". In reality:

- `__tests__/integration/core.test.js` and `features.test.js` **import no application code**. They
  construct a plain object and assert on that same object — `expect(mockUser.username).toBe('John Doe')`
  passes whatever the application does.
- Only `payments.test.js` imports a real module (`tax.controller.js`).
- `supertest` is a declared dependency, used **zero** times. Not one of the 140 routes is exercised.
- The frontend has one test file (`api.test.js`) for 26,378 lines.
- There is no `.github/` directory, so nothing runs on push regardless.

Effective backend coverage is roughly **2%**. This is finding F-04, and it is a critical one: the suite
does not merely fail to catch bugs, it actively signals safety that does not exist.

**First action: delete `core.test.js` and `features.test.js`, and correct `TESTING.md`.** A suite that
tests nothing is worse than no suite, because it stops people from writing a real one.

---

## 2. Why PostgreSQL makes this easier

The reason the current suite mocks everything is that testing Mongoose meaningfully requires either an
in-memory MongoDB or heavy mocking, and both are unpleasant. Postgres removes the dilemma:

**Run a real database, wrap every test in a transaction, roll it back at teardown.** No ORM mocking, no
fixture cleanup, no test pollution, and the code under test runs against the same engine as production —
including the constraints and triggers that enforce the ledger's correctness, which are the things most
worth testing.

Use PostgreSQL in Docker, not SQLite. `context/01-system-overview.md` §7 explains why at length: the
constraints this ERP depends on either do not exist or behave differently in SQLite, and a ledger that
balances under one engine and not the other is the worst available outcome.

---

## 3. The pyramid `[TARGET]`

### Unit — pure domain logic, no database

The tests that matter most for an ERP and the cheapest to write. Everything in `packages/domain` and
every `service.js` function that can be called with plain data:

- Money arithmetic and rounding in minor units
- Pricing: discounts, coupon validity, flash-sale precedence, loyalty accrual
- Tax computation (server-side, closing F-05)
- **Ledger posting rules** — given an event, the expected debit and credit lines
- State-machine transition legality for orders, documents, projects
- Segregation-of-duties predicates, including the no-self-approval rule

Target: fast enough that the whole tier runs in single-digit seconds.

### Integration — real app, real database

`supertest` against the real Express app, with a real Postgres. **Every one of the ~140 routes gets at
minimum an authorisation check and a happy path.** Beyond that, priority order:

1. Payment webhooks — signature verification, amount reconciliation, idempotent replay (F-01, F-09)
2. Order creation — server-side pricing, stock reservation, transaction rollback, idempotency (F-05, F-06)
3. Document issuance — gapless numbering under **concurrent** requests (this is the one that needs a
   deliberate concurrency test, because `SELECT … FOR UPDATE` is the whole mechanism)
4. Approval flows — an actor cannot approve their own request
5. Period close — postings dated inside a closed period are rejected
6. Permission matrix — each role against each protected route

### Contract — the spec cannot lie

Validate every integration-test response against the generated OpenAPI schema. This is what makes
"generated docs" trustworthy rather than merely automated: if a handler returns a shape the spec does not
describe, a test fails.

### End-to-end — Playwright, deliberately small

Two flows only:

1. Guest checkout through to a paid, confirmed order (with a stubbed gateway webhook)
2. Month-end close: record a payment, record an expense, review the trial balance, close the period

Plus **visual regression** on every storefront and console page, which is how the UI-parity constraint in
`context/08-admin-ui-guidelines.md` §0 is actually enforced during the split.

Keep this tier small. E2E is the tier that rots, and a slow, flaky E2E suite trains people to ignore red.

---

## 4. Frontend tests

Vitest + Testing Library, already configured. Focus on logic, not markup:

- Zustand store reducers and derived selectors
- Money and date formatting helpers
- Permission-gated rendering — a role without `finance.view` must not see finance navigation
- Form validation, especially anything accepting money
- `packages/api-client` request and response shapes

Do not test that a `<div>` has a class. That is what visual regression is for, and it is cheaper.

---

## 5. CI gates `[TARGET]`

GitHub Actions, on every push and pull request. There is no CI at all today.

**Live today** in `.github/workflows/ci.yml`: backend tests, the frontend lint ratchet, frontend tests,
frontend build, and API-document validation. The remaining gates below arrive with the phases they
depend on.

| Gate | Fails the build when |
|---|---|
| Lint | ESLint error count rises in any file — a ratchet, not a zero-error rule, because the frontend starts with 68 pre-existing errors (`.github/lint-baseline.json`) |
| Unit + integration | Any test fails |
| Coverage floor | Below threshold on changed packages — start at 60%, ratchet up; never ratchet down |
| **Migration idempotency** | The full migration suite run **twice** against a clean database does not produce an identical result |
| **OpenAPI drift** | The generated spec differs from the committed one |
| Visual regression | Screenshot diff exceeds threshold (during R1–R4 especially) |
| Build | Either app fails to build |

Migration idempotency deserves emphasis: it is cheap to check and catches the class of migration bug that
is otherwise discovered during a production cutover at 2 a.m.

---

## 6. Conventions

- Tests live beside the code (`modules/<domain>/*.test.js`), not in a parallel tree.
- One assertion subject per test; the name states the behaviour, not the function.
- No mocking of the database, the ORM, or time-of-day — use a real database and an injectable clock.
- External HTTP (gateways, TaxJar, Cloudinary) is stubbed at the boundary with recorded fixtures.
- A bug fix ships with the test that would have caught it. No exceptions — this is how the suite becomes
  worth having.
