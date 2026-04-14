# CONTEXT Folder Blueprint

> Navigation guide and structural overview of the ROClearance project knowledge base.

---

## Folder Structure

```
CONTEXT/
├── README.md                        # Master index & navigation hub
├── PROJECT_OVERVIEW.md              # Executive summary
├── CONCEPT_NOTE.md                  # Business concept & market analysis
├── CONVENTIONS.md                   # Coding standards & patterns
├── IMPLEMENTATION_PLAN.md           # Backend build phases (0–5)
├── FRONTEND_IMPLEMENTATION_PLAN.md  # Frontend build phases (F0–F7)
├── API_INTEGRATIONS.md              # External service catalog
├── USAGE_FLOW.md                    # End-to-end user journey
├── GLOSSARY.md                      # Domain terminology & acronyms
├── CHANGELOG.md                     # Decisions & milestones log
├── BROWSER_TESTING_GUIDE.md         # Manual QA walkthrough
│
└── ARCHITECTURE/
    ├── SYSTEM_ARCHITECTURE.md       # High-level topology & integration map
    ├── BACKEND_ARCHITECTURE.md      # Node.js/Express deep dive
    ├── FRONTEND_ARCHITECTURE.md     # React SPA patterns & conventions
    ├── DATA_MODELS.md               # 41 Sequelize models, field specs
    └── API_REFERENCE.md             # Full REST API contract
```

---

## Root-Level Documents

| File | Purpose |
|------|---------|
| **README.md** | Entry point — master index mapping tasks to the right document |
| **PROJECT_OVERVIEW.md** | One-page executive summary: tech stack, problem statement, solution (18 modules, 150+ features) |
| **CONCEPT_NOTE.md** | Full business concept, market analysis, tech pillars (AI/ML, Blockchain, OCR, IoT), regulatory context |
| **CONVENTIONS.md** | Coding standards — ES Modules, naming rules, Controller-Service-Model (CSM) architecture |
| **IMPLEMENTATION_PLAN.md** | Phased backend build plan (Phase 0–5) with task status tracking |
| **FRONTEND_IMPLEMENTATION_PLAN.md** | Phased frontend build plan (Phase F0–F7) mirroring backend milestones |
| **API_INTEGRATIONS.md** | External service catalog — Supabase, Paystack, Flutterwave, OpenAI, Sentry, OFAC, Termii, etc. |
| **USAGE_FLOW.md** | End-to-end user journey: onboarding → shipment → documents → clearance → tracking → analytics |
| **GLOSSARY.md** | Domain terms — trade/customs jargon, Nigerian regulatory bodies (CBN, NAFDAC, NCS, SON), acronyms |
| **CHANGELOG.md** | Chronological record of architectural decisions and milestones (2025–2026) |
| **BROWSER_TESTING_GUIDE.md** | Manual QA walkthrough — Docker setup, .env config, cold-start testing workflow |

---

## Architecture Subfolder

| File | Purpose |
|------|---------|
| **SYSTEM_ARCHITECTURE.md** | High-level topology — monolithic modular backend (future microservices), API gateway layers, integration map |
| **BACKEND_ARCHITECTURE.md** | Backend deep dive — Node.js/Express, 26 controllers, 18 services, security (JWT, 2FA, encryption, rate limiting) |
| **FRONTEND_ARCHITECTURE.md** | React SPA patterns — Vite, TailwindCSS/DaisyUI, Zustand stores, folder structure, component conventions |
| **DATA_MODELS.md** | Complete database schema — 41 Sequelize models across 13 categories with types, constraints, descriptions |
| **API_REFERENCE.md** | Full REST API contract — every endpoint grouped by domain with method, path, auth, and allowed roles |

---

## Reading Order by Audience

### New Developer
1. `README.md` → orient yourself
2. `PROJECT_OVERVIEW.md` → understand the product
3. `CONVENTIONS.md` → learn the rules
4. `IMPLEMENTATION_PLAN.md` → see what's built and what's next

### Frontend Developer
1. `FRONTEND_ARCHITECTURE.md` → patterns and folder structure
2. `FRONTEND_IMPLEMENTATION_PLAN.md` → phases and tasks
3. `API_REFERENCE.md` → endpoints to integrate
4. `CONVENTIONS.md` → naming and coding rules

### Backend Developer
1. `BACKEND_ARCHITECTURE.md` → stack and project structure
2. `DATA_MODELS.md` → database schema
3. `API_REFERENCE.md` → endpoint contract
4. `CONVENTIONS.md` → CSM pattern and naming

### Architect / Project Manager
1. `CONCEPT_NOTE.md` → business context
2. `SYSTEM_ARCHITECTURE.md` → topology and integrations
3. `USAGE_FLOW.md` → user journeys
4. `CHANGELOG.md` → decision history

### QA / Tester
1. `BROWSER_TESTING_GUIDE.md` → setup and manual testing
2. `USAGE_FLOW.md` → expected user flows
3. `API_REFERENCE.md` → endpoint verification

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
