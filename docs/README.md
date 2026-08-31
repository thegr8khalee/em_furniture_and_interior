# Formal Deliverables

Architecture and operations documents for the EM Furniture & Interior platform.
Specification and design context lives in [`../context/`](../context/00-master-context.md).

| Document | Contents |
|---|---|
| [SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md) | Target topology, structural decisions, trust boundaries, failure modes |
| [ERD_DATA_MODEL.md](ERD_DATA_MODEL.md) | MongoDB → PostgreSQL mapping, target schema, ledger constraints |
| [TESTING_STRATEGY.md](TESTING_STRATEGY.md) | Test pyramid, tooling, CI gates |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel + Render + Supabase, release procedure, R3 cutover |
| [BACKUP_RUNBOOK.md](BACKUP_RUNBOOK.md) | Encrypted off-provider backups, verification, restore drills |
| [DATA_PROTECTION.md](DATA_PROTECTION.md) | NDPR / GDPR obligations, retention, subject rights |
| [COMMANDS.md](COMMANDS.md) | Command reference, current and target |

## Reading order

**New to the project** → `../context/01-system-overview.md`, then `SOLUTION_ARCHITECTURE.md`.

**Picking up the ERP work** → `../context/05-erp-readiness-assessment.md`, then
`../context/07-implementation-roadmap.md`.

**Picking up the replatform** → `../context/06-replatform-plan.md`, then `ERD_DATA_MODEL.md`, then
`DEPLOYMENT.md`.

**Operating the system** → `../context/09-operational-setup-checklist.md`, `DEPLOYMENT.md`,
`BACKUP_RUNBOOK.md`.

## Convention

Every claim is tagged `[NOW]` (verified in the codebase), `[TARGET]` (planned, does not exist), or
`[GAP]` (a tracked defect). Untagged prose is explanation. See
[`../context/00-master-context.md`](../context/00-master-context.md) §2 — this convention exists because
the previous generation of project documentation described intent as fact, and it cost real work.
