# 00 — Master Context

> Master index, sitemap, and core architectural rules for the EM Furniture & Interior platform.
> **Read this file first.** Every other document in this suite assumes the conventions below.

---

## 1. What this suite is

A structured knowledge base covering the platform as it **is today** and as it is **planned to become**: an
ERP for a furniture retail and interior-design business, split into a public storefront and an internal
operations console.

## 2. The one convention that matters

Every claim in this suite is tagged with its state. This is not decoration — the previous generation of
project docs (`FEATURES.md`, `backend/TESTING.md`) described intent as though it were fact, and that
directly caused wasted work. Do not repeat it.

| Tag | Meaning |
|-----|---------|
| `[NOW]` | Verified present in the codebase at the referenced commit. Checked, not assumed. |
| `[TARGET]` | Planned. Does not exist. Must never be described in the present tense. |
| `[GAP]` | A known defect or absence, tracked as a finding in `05-erp-readiness-assessment.md`. |

If you cannot tag a statement, you do not know it well enough to write it down.

## 3. Sitemap

### context/ — architecture and specification

| Document | Contents |
|---|---|
| `00-master-context.md` | This file. Index, rules, conventions. |
| `01-system-overview.md` | Business context, stakeholders, scope, system purpose. |
| `02-repo-structure-and-modules.md` | Codebase map, module catalog, RBAC matrix. |
| `03-backend-architecture.md` | Runtime, data layer, integrations — current and target. |
| `04-business-flow-and-processes.md` | End-to-end operational workflows. |
| `05-erp-readiness-assessment.md` | **The audit.** 13 findings, module gap matrix. |
| `06-replatform-plan.md` | **The migration.** Supabase, Postgres, split, tests, docs. |
| `07-implementation-roadmap.md` | Combined sequencing and effort for both of the above. |
| `08-admin-ui-guidelines.md` | Console design tokens, layout shells, component kit. |
| `09-operational-setup-checklist.md` | Vercel / Render / Supabase config, secrets, cron. |
| `10-notifications-and-trigger-matrix.md` | Channels and the event → notification matrix. |
| `lifecycles/order_lifecycle.md` | Order status machine and transition rules. |
| `lifecycles/document_lifecycle.md` | Quotation → invoice → receipt → credit note. |
| `lifecycles/project_lifecycle.md` | Consultation → design → installation → close. |
| `lifecycles/inventory_lifecycle.md` | Stock movement events and valuation. |

### docs/ — formal deliverables

| Document | Contents |
|---|---|
| `SOLUTION_ARCHITECTURE.md` | Target topology, deployment, trust boundaries. |
| `ERD_DATA_MODEL.md` | MongoDB → PostgreSQL mapping and target schema. |
| `TESTING_STRATEGY.md` | Test pyramid, tooling, CI gates. |
| `DEPLOYMENT.md` | Vercel + Render + Supabase deployment runbook. |
| `BACKUP_RUNBOOK.md` | Encrypted backup, verification, restore drill. |
| `DATA_PROTECTION.md` | NDPR / GDPR handling of customer data. |
| `COMMANDS.md` | Command reference for every workspace. |

### Legacy documents

`context/PROJECT_OVERVIEW.md`, `CONCEPT_NOTE.md`, `CONVENTIONS.md`, `IMPLEMENTATION_PLAN.md`,
`FRONTEND_IMPLEMENTATION_PLAN.md`, `API_INTEGRATIONS.md`, `USAGE_FLOW.md`, `GLOSSARY.md`,
`CHANGELOG.md`, `BROWSER_TESTING_GUIDE.md`, `blueprint.md`, and `context/ARCHITECTURE/*` predate this
suite. They remain accurate about the current MVP and are superseded for anything ERP or replatform
related. `GLOSSARY.md` and `CONVENTIONS.md` are still authoritative.

Root `FEATURES.md` and `FEATURES_PLAN.md` overstate delivered functionality and should be reconciled
against `05-erp-readiness-assessment.md` before being cited anywhere.

---

## 4. Core system principles `[TARGET]`

These are the architectural commitments the replatform is being made to satisfy.

**Unified monorepo, decoupled runtime.** Three application tiers — `apps/api`, `apps/erp`, `apps/storefront`
— sharing one business domain model through `packages/`. One API deployment serving two clients.

**Strict domain isolation.** Domain-prefixed PostgreSQL schemas (`catalog_`, `sales_`, `crm_`, `inv_`,
`fin_`, `cms_`, `core_`) so that finance cannot silently couple itself to catalog internals, and so a
permission boundary has something concrete to sit on.

**Governed lifecycles and state transitions.** State-machine driven lifecycles for orders (7 statuses),
documents (6 statuses), interior projects (8 phases), and stock movements (append-only). Transitions are
validated, audited, and never implicit.

**Two-phase commercial lifecycle.** A quotation is retained in Phase 1 (issued, non-binding: no stock
reserved, no ledger entry) and promoted on acceptance and deposit to Phase 2 (committed: stock reserved,
revenue recognised, ledger posted). The Phase 1 record is never deleted — it is the audit trail of what
the customer was actually offered.

**Immutable financial records.** Ledger entries, receipts, and credit notes are append-only. Corrections
are made by posting a reversing entry, never by mutating history.

**Segregation of duties.** Refunds, credit notes, expense approvals above threshold, stock write-offs, and
price overrides require a second authorising role. No self-approval — including for `SUPER_ADMIN`.

**Zero raw file payloads on the API.** Clients upload directly to Cloudinary using short-lived signed
signatures. The API never receives binary bodies. `[GAP]` — today the API accepts base64 image payloads
with a 50 MB body limit, which is the opposite of this rule.

**Cryptographic disaster recovery.** Nightly `pg_dump` streamed through AES-256-GCM with SHA-256 checksums
to an off-provider bucket, alongside Supabase point-in-time recovery. Keys held outside the cloud provider.

---

## 5. Non-negotiable engineering rules `[TARGET]`

1. **`sequelize.sync()` is prohibited.** Schema changes happen only through numbered, reviewed migration
   files. `sync({ alter: true })` must be programmatically blocked when `NODE_ENV === 'production'`.
2. **Migrations must be idempotent.** CI runs the full migration suite twice against a clean database.
3. **Money is stored as integer minor units.** Never a float. See finding F-11.
4. **Invoice numbering is gapless.** Counter rows with `SELECT … FOR UPDATE`, never a Postgres sequence.
5. **The OpenAPI spec is generated, never hand-edited.** CI fails if the committed spec differs from the
   generated one.
6. **No feature work during a migration phase.** See `06-replatform-plan.md` §4.
7. **The replatform is visually invisible.** No redesign, re-theming, or component rewrite during
   phases R1–R4. Visual changes ship separately, afterwards, and are reviewable on their own.
   See `08-admin-ui-guidelines.md` §0.
8. **Errors are masked at the boundary.** Clients receive typed `AppError` instances only; stack traces and
   driver messages never leave the server.

---

## 6. Reference commit

This suite was written against `8db2e2b` on branch `claude/admin-dashboard-erp-audit-ijkama`.
Findings and line references are valid as of that commit.
