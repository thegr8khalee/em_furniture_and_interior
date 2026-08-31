# EM Furniture and Interior — Context Hub

> **Start at [`00-master-context.md`](00-master-context.md).** It is the index, and it defines the
> `[NOW]` / `[TARGET]` / `[GAP]` convention every document in the numbered suite uses.

## ERP & Replatform suite

| Document | What You'll Find |
|----------|-----------------|
| [00-master-context.md](00-master-context.md) | Master index, core principles, engineering rules |
| [01-system-overview.md](01-system-overview.md) | Business context, stakeholders, scope, technology matrix |
| [02-repo-structure-and-modules.md](02-repo-structure-and-modules.md) | Codebase map, module catalog, RBAC matrix |
| [03-backend-architecture.md](03-backend-architecture.md) | Runtime, request pipeline, data layer, integrations |
| [04-business-flow-and-processes.md](04-business-flow-and-processes.md) | End-to-end operational workflows |
| [05-erp-readiness-assessment.md](05-erp-readiness-assessment.md) | **The audit** — findings F-01…F-13, gap matrix |
| [06-replatform-plan.md](06-replatform-plan.md) | **The migration** — Supabase, Postgres, split, tests, docs |
| [07-implementation-roadmap.md](07-implementation-roadmap.md) | Combined sequencing, effort, exit criteria |
| [08-admin-ui-guidelines.md](08-admin-ui-guidelines.md) | UI parity constraint, tokens, component kit |
| [09-operational-setup-checklist.md](09-operational-setup-checklist.md) | Vercel / Render / Supabase config and secrets |
| [10-notifications-and-trigger-matrix.md](10-notifications-and-trigger-matrix.md) | Channels and the event → notification matrix |
| [lifecycles/](lifecycles/) | Order, document, project and inventory state machines |

Formal deliverables — architecture, data model, testing, deployment, backup, data protection, commands —
are in [`../docs/`](../docs/README.md).

---

## Legacy documents

The documents below predate the suite above. They remain accurate about the current MVP and are
superseded for anything ERP or replatform related. `GLOSSARY.md` and `CONVENTIONS.md` are still
authoritative.

### Core

| Document | What You'll Find |
|----------|-----------------|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | One-page executive summary — tech stack, problem, solution |
| [CONCEPT_NOTE.md](CONCEPT_NOTE.md) | Business concept, market analysis, tech pillars |
| [CONVENTIONS.md](CONVENTIONS.md) | Coding standards, naming rules, CSM architecture |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Backend build phases (0–8) with task status |
| [FRONTEND_IMPLEMENTATION_PLAN.md](FRONTEND_IMPLEMENTATION_PLAN.md) | Frontend build phases (F0–F7) |
| [API_INTEGRATIONS.md](API_INTEGRATIONS.md) | External service catalog (Paystack, Cloudinary, etc.) |
| [USAGE_FLOW.md](USAGE_FLOW.md) | End-to-end user journeys |
| [GLOSSARY.md](GLOSSARY.md) | Domain terms and acronyms |
| [CHANGELOG.md](CHANGELOG.md) | Decisions and milestones log |
| [BROWSER_TESTING_GUIDE.md](BROWSER_TESTING_GUIDE.md) | Manual QA walkthrough |
| [blueprint.md](blueprint.md) | This folder's structural blueprint |

### Architecture Deep Dives

| Document | What You'll Find |
|----------|-----------------|
| [ARCHITECTURE/SYSTEM_ARCHITECTURE.md](ARCHITECTURE/SYSTEM_ARCHITECTURE.md) | High-level topology and integration map |
| [ARCHITECTURE/BACKEND_ARCHITECTURE.md](ARCHITECTURE/BACKEND_ARCHITECTURE.md) | Node.js / Express deep dive |
| [ARCHITECTURE/FRONTEND_ARCHITECTURE.md](ARCHITECTURE/FRONTEND_ARCHITECTURE.md) | React SPA patterns and conventions |
| [ARCHITECTURE/DATA_MODELS.md](ARCHITECTURE/DATA_MODELS.md) | 20 Mongoose models with field specs |
| [ARCHITECTURE/API_REFERENCE.md](ARCHITECTURE/API_REFERENCE.md) | Full REST API contract (~120 endpoints) |

---

## Reading Order by Role

### New Developer
1. `PROJECT_OVERVIEW.md` → understand the product
2. `CONVENTIONS.md` → learn the rules
3. `IMPLEMENTATION_PLAN.md` → see what's built and what's next

### Frontend Developer
1. `ARCHITECTURE/FRONTEND_ARCHITECTURE.md` → patterns and folder structure
2. `FRONTEND_IMPLEMENTATION_PLAN.md` → phases and tasks
3. `ARCHITECTURE/API_REFERENCE.md` → endpoints to integrate
4. `CONVENTIONS.md` → naming and coding rules

### Backend Developer
1. `ARCHITECTURE/BACKEND_ARCHITECTURE.md` → stack and project structure
2. `ARCHITECTURE/DATA_MODELS.md` → database schema
3. `ARCHITECTURE/API_REFERENCE.md` → endpoint contract
4. `CONVENTIONS.md` → CSM pattern and naming

### Architect / Project Manager
1. `CONCEPT_NOTE.md` → business context
2. `ARCHITECTURE/SYSTEM_ARCHITECTURE.md` → topology and integrations
3. `USAGE_FLOW.md` → user journeys
4. `CHANGELOG.md` → decision history

### QA / Tester
1. `BROWSER_TESTING_GUIDE.md` → setup and manual testing
2. `USAGE_FLOW.md` → expected user flows
3. `ARCHITECTURE/API_REFERENCE.md` → endpoint verification

### Domain Newcomer
1. `GLOSSARY.md` → learn the terminology
2. `CONCEPT_NOTE.md` → understand the market
3. `USAGE_FLOW.md` → see how it all connects

---

## Document Relationships

```
CONCEPT_NOTE ──────► PROJECT_OVERVIEW (condensed version)
       │
       ▼
SYSTEM_ARCHITECTURE
       │
       ├──► BACKEND_ARCHITECTURE ──► DATA_MODELS
       │           │
       │           ▼
       │    API_REFERENCE ◄──── API_INTEGRATIONS
       │
       └──► FRONTEND_ARCHITECTURE
                    │
                    ▼
       FRONTEND_IMPLEMENTATION_PLAN
                    │
IMPLEMENTATION_PLAN─┘──► CHANGELOG (tracks progress)

CONVENTIONS ─────► applies to all code
GLOSSARY ────────► referenced by all docs
USAGE_FLOW ──────► validates against API_REFERENCE
BROWSER_TESTING_GUIDE ──► uses USAGE_FLOW as test scenarios
```
