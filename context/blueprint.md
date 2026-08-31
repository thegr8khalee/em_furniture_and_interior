# CONTEXT Folder Blueprint

> Navigation guide and structural overview of the EM Furniture & Interior knowledge base.

---

## Folder Structure

```
context/
├── README.md                        # Master index & navigation hub
├── PROJECT_OVERVIEW.md              # Executive summary
├── CONCEPT_NOTE.md                  # Business concept & market analysis
├── CONVENTIONS.md                   # Coding standards & CSM pattern
├── IMPLEMENTATION_PLAN.md           # Backend build phases (0–8)
├── FRONTEND_IMPLEMENTATION_PLAN.md  # Frontend build phases (F0–F7)
├── API_INTEGRATIONS.md              # External service catalog
├── ENVIRONMENT_AND_DEPLOYMENT.md    # Env vars, scripts, server bootstrap, deploy
├── SECURITY_AND_PERMISSIONS.md      # Roles, permission matrix, middleware, auditing
├── USAGE_FLOW.md                    # End-to-end user journeys
├── GLOSSARY.md                      # Domain terminology & acronyms
├── CHANGELOG.md                     # Decisions & milestones log
├── BROWSER_TESTING_GUIDE.md         # Manual QA walkthrough
├── blueprint.md                     # This file
│
├── ARCHITECTURE/
│   ├── SYSTEM_ARCHITECTURE.md       # High-level topology & integration map
│   ├── BACKEND_ARCHITECTURE.md      # Node.js/Express deep dive
│   ├── FRONTEND_ARCHITECTURE.md     # React SPA patterns & conventions
│   ├── DATA_MODELS.md               # 20 Mongoose models with field specs
│   └── API_REFERENCE.md             # Full REST API contract (~120 endpoints)
│
└── UI/
    ├── DESIGN_SYSTEM.md             # Brand tokens: colour, type, spacing, motion
    ├── COMPONENT_LIBRARY.md         # Every reusable component + props
    ├── LAYOUT_AND_NAVIGATION.md     # Shells, chrome, nav maps, route guards
    ├── PAGE_UI_CATALOG.md           # Screen-by-screen inventory
    └── UI_PATTERNS.md               # States, forms, tables, motion, a11y
```

---

## Root-Level Documents

| File | Purpose |
|------|---------|
| **README.md** | Entry point — maps a task or role to the right document |
| **PROJECT_OVERVIEW.md** | One-page executive summary: tech stack, problem, solution |
| **CONCEPT_NOTE.md** | Business concept, market analysis, technology pillars |
| **CONVENTIONS.md** | ES Modules, naming rules, Controller-Service-Model (CSM) architecture |
| **IMPLEMENTATION_PLAN.md** | Phased backend build plan with task status |
| **FRONTEND_IMPLEMENTATION_PLAN.md** | Phased frontend build plan mirroring backend milestones |
| **API_INTEGRATIONS.md** | External services — Paystack, Flutterwave, Stripe, Cloudinary, Gmail OAuth2, Google Maps |
| **ENVIRONMENT_AND_DEPLOYMENT.md** | Every env var, npm script, the Express bootstrap order, rate limits, single-service deploy |
| **SECURITY_AND_PERMISSIONS.md** | Guest/user/admin identities, 5 roles × 14 permissions, middleware chain, audit logging |
| **USAGE_FLOW.md** | End-to-end journeys: browse → cart → checkout → payment → fulfilment |
| **GLOSSARY.md** | Domain terms and acronyms |
| **CHANGELOG.md** | Chronological record of architectural decisions and milestones |
| **BROWSER_TESTING_GUIDE.md** | Manual QA walkthrough |

---

## ARCHITECTURE Subfolder

| File | Purpose |
|------|---------|
| **SYSTEM_ARCHITECTURE.md** | Topology — SPA + monolithic Express API + MongoDB, integration map |
| **BACKEND_ARCHITECTURE.md** | Controllers, routes, middleware, services, libs |
| **FRONTEND_ARCHITECTURE.md** | Stack, folder structure, routing, Zustand stores, persistence |
| **DATA_MODELS.md** | Mongoose schemas with field specs, indexes, relationships |
| **API_REFERENCE.md** | Every endpoint by domain: method, path, auth, permissions |

---

## UI Subfolder

| File | Purpose |
|------|---------|
| **DESIGN_SYSTEM.md** | The visual language — DaisyUI theme tokens, zero-radius rule, Playfair/Montserrat pairing, gold accent, shadow and spacing tokens, global utility classes, the full Framer Motion preset catalogue |
| **COMPONENT_LIBRARY.md** | `ui/` primitives (Button, Input, Select, Textarea, Card, Badge, Modal, Pagination, Skeleton, EmptyState, PageHeader), the 11 animation wrappers, shared site components, and admin components — each with props and usage |
| **LAYOUT_AND_NAVIGATION.md** | The two shells (public vs admin), Navbar/BottomNavbar/Footer, promo bar, admin sidebar permission map, the `?section=` dashboard pattern, route guards, code-splitting strategy |
| **PAGE_UI_CATALOG.md** | All 51 page components: route, file, size, section-by-section contents, and which primitives each composes |
| **UI_PATTERNS.md** | The four states (loading/empty/error/populated), toast-not-banner feedback, form rules, modal patterns, table conventions, motion discipline, responsive rules, accessibility status and known gaps |

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
       │           ├──► API_REFERENCE ◄──── API_INTEGRATIONS
       │           └──► SECURITY_AND_PERMISSIONS
       │
       └──► FRONTEND_ARCHITECTURE
                    │
                    ├──► UI/DESIGN_SYSTEM ──► UI/COMPONENT_LIBRARY
                    │                              │
                    │                              ▼
                    ├──► UI/LAYOUT_AND_NAVIGATION ──► UI/PAGE_UI_CATALOG
                    │                              │
                    │                              ▼
                    │                        UI/UI_PATTERNS
                    └──► FRONTEND_IMPLEMENTATION_PLAN

IMPLEMENTATION_PLAN ──────► CHANGELOG (tracks progress)
ENVIRONMENT_AND_DEPLOYMENT ──► applies to both runtimes
CONVENTIONS ──────────────► applies to all code
GLOSSARY ─────────────────► referenced by all docs
USAGE_FLOW ───────────────► validates against API_REFERENCE
BROWSER_TESTING_GUIDE ────► uses USAGE_FLOW as test scenarios
```

---

## Maintenance Rules

1. **Code is the source of truth.** When a doc and the code disagree, fix the doc and note the drift.
2. **UI changes touch UI docs.** A new primitive → `COMPONENT_LIBRARY.md`; a new token →
   `DESIGN_SYSTEM.md`; a new screen → `PAGE_UI_CATALOG.md`; a new route or nav entry →
   `LAYOUT_AND_NAVIGATION.md`.
3. **A new permission touches three files:** both `permissions.js` mirrors and
   `SECURITY_AND_PERMISSIONS.md` §4.
4. **A new env var** goes in `backend/.env.example` *and* `ENVIRONMENT_AND_DEPLOYMENT.md` §4/§5.
5. **Record decisions** in `CHANGELOG.md`, not in commit messages alone.
