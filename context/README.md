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
| [ENVIRONMENT_AND_DEPLOYMENT.md](ENVIRONMENT_AND_DEPLOYMENT.md) | Env vars, npm scripts, server bootstrap, rate limits, deployment |
| [SECURITY_AND_PERMISSIONS.md](SECURITY_AND_PERMISSIONS.md) | Identities, roles, permission matrix, middleware, auditing |
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

### UI & Design

| Document | What You'll Find |
|----------|-----------------|
| [UI/DESIGN_SYSTEM.md](UI/DESIGN_SYSTEM.md) | Colour, typography, spacing, elevation, motion tokens, global utilities |
| [UI/COMPONENT_LIBRARY.md](UI/COMPONENT_LIBRARY.md) | Every reusable component with props, variants, and usage |
| [UI/LAYOUT_AND_NAVIGATION.md](UI/LAYOUT_AND_NAVIGATION.md) | App shells, chrome, navigation maps, route guards, code splitting |
| [UI/PAGE_UI_CATALOG.md](UI/PAGE_UI_CATALOG.md) | All 51 screens: route, file, contents, primitives used |
| [UI/UI_PATTERNS.md](UI/UI_PATTERNS.md) | States, forms, tables, modals, motion discipline, accessibility |

---

## Reading Order by Role

### New Developer
1. `PROJECT_OVERVIEW.md` → understand the product
2. `CONVENTIONS.md` → learn the rules
3. `IMPLEMENTATION_PLAN.md` → see what's built and what's next

### Frontend Developer
1. `ARCHITECTURE/FRONTEND_ARCHITECTURE.md` → patterns and folder structure
2. `UI/DESIGN_SYSTEM.md` → the visual language and its tokens
3. `UI/COMPONENT_LIBRARY.md` → what already exists before you build anything
4. `UI/UI_PATTERNS.md` → how states, forms, and motion are handled
5. `ARCHITECTURE/API_REFERENCE.md` → endpoints to integrate
6. `CONVENTIONS.md` → naming and coding rules

### UI / Design
1. `UI/DESIGN_SYSTEM.md` → tokens, type scale, motion presets
2. `UI/COMPONENT_LIBRARY.md` → the component inventory
3. `UI/LAYOUT_AND_NAVIGATION.md` → shells and navigation structure
4. `UI/PAGE_UI_CATALOG.md` → every existing screen
5. `UI/UI_PATTERNS.md` → interaction rules and accessibility gaps

### Backend Developer
1. `ARCHITECTURE/BACKEND_ARCHITECTURE.md` → stack and project structure
2. `ARCHITECTURE/DATA_MODELS.md` → database schema
3. `ARCHITECTURE/API_REFERENCE.md` → endpoint contract
4. `SECURITY_AND_PERMISSIONS.md` → guards, roles, permission middleware
5. `CONVENTIONS.md` → CSM pattern and naming

### DevOps / Deploying
1. `ENVIRONMENT_AND_DEPLOYMENT.md` → env vars, scripts, bootstrap order, deploy checklist
2. `ARCHITECTURE/SYSTEM_ARCHITECTURE.md` → topology
3. `SECURITY_AND_PERMISSIONS.md` → hardening controls

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
       ├──► SECURITY_AND_PERMISSIONS
       │
       └──► FRONTEND_ARCHITECTURE
                    │
                    ├──► UI/DESIGN_SYSTEM ─► UI/COMPONENT_LIBRARY
                    ├──► UI/LAYOUT_AND_NAVIGATION ─► UI/PAGE_UI_CATALOG
                    ├──► UI/UI_PATTERNS
                    ▼
       FRONTEND_IMPLEMENTATION_PLAN
                    │
IMPLEMENTATION_PLAN─┘──► CHANGELOG (tracks progress)

ENVIRONMENT_AND_DEPLOYMENT ─► applies to both runtimes
CONVENTIONS ─────► applies to all code
GLOSSARY ────────► referenced by all docs
USAGE_FLOW ──────► validates against API_REFERENCE
BROWSER_TESTING_GUIDE ──► uses USAGE_FLOW as test scenarios
```
