# EM Furniture and Interior — Context Hub

> Master index and navigation for the project knowledge base.

---

## Quick Links

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
