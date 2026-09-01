# Commands Reference

> `[NOW]` commands work at commit `8db2e2b`. `[TARGET]` commands describe the post-replatform monorepo
> and do not exist yet — they are specified here so the scripts are built to a known contract.

---

## 1. Current `[NOW]`

Post-R1 the repository is an npm workspace: `apps/{api,storefront,erp}` and
`packages/{ui,domain,api-client,config}`. `npm ci` at the root installs everything;
there is one lockfile.

| Purpose | Command |
|---|---|
| Install everything | `npm ci` |
| Run all three tiers | `npm run dev` |
| Build both clients | `npm run build` |
| API tests | `npm test -w apps/api` |
| Storefront tests | `npm test -w apps/storefront` |
| Lint (ratchet, all workspaces) | `npm run lint` |
| Visual baselines | `npm run test:visual` |
| Everything Playwright runs | `npm run test:e2e` |

### Legacy two-directory layout

| Purpose | Command | Notes |
|---|---|---|
| Install everything | `npm run build` (root) | Installs backend + frontend, builds frontend |
| Run both tiers | `npm run dev` (root) | Backend and frontend concurrently |
| Backend dev | `npm --prefix backend run dev` | nodemon; needs `MONGODB_URI` |
| Backend start | `npm --prefix backend start` | |
| Backend tests | `npm --prefix backend test` | 73 tests; **~2% real coverage** — see F-04 |
| Seed database | `npm --prefix backend run seed` | Uses `SEED_ADMIN_PASSWORD` |
| Frontend dev | `npm --prefix frontend run dev` | Vite on `:5173` |
| Frontend build | `npm --prefix frontend run build` | |
| Frontend lint | `npm --prefix frontend run lint` | ESLint 9 |
| Frontend tests | `npm --prefix frontend test` | Vitest; one test file |
| Coverage | `npm --prefix frontend run test:coverage` | |
| API docs | `GET /api-docs` | Swagger UI from the hand-written `backend/docs/swagger.json` |

There is no lint script for the backend, no migration command, no CI, and no backup command.

---

## 2. Target `[TARGET]`

### Setup

| Purpose | Command |
|---|---|
| Install all workspaces | `npm ci` |
| Start local Postgres | `docker compose up -d db` |
| Apply migrations | `npm run db:migrate -w apps/api` |
| Seed development data | `npm run db:seed -w apps/api` |
| Reset local database | `npm run db:reset -w apps/api` |

Node 22 LTS, pinned via `engines`. Lockfiles generated with npm 11 to avoid cross-platform native-binary
resolution differences between a developer's machine and the CI runner — a real and time-consuming class
of CI failure.

### Development

| Purpose | Command | Port |
|---|---|---|
| API | `npm run dev -w apps/api` | `:5000` |
| Storefront | `npm run dev -w apps/storefront` | `:5173` |
| ERP console | `npm run dev -w apps/erp` | `:5174` |
| Everything | `npm run dev` (root) | |

### Database

| Purpose | Command | Notes |
|---|---|---|
| Apply migrations | `npm run db:migrate -w apps/api` | Uses `DIRECT_DATABASE_URL`, never the pooler |
| New migration | `npm run db:migrate:new -w apps/api -- <name>` | Numbered SQL file |
| Verify idempotency | `npm run db:migrate:verify -w apps/api` | Runs the suite twice against a clean database; CI gate |
| Migration status | `npm run db:status -w apps/api` | |

`sequelize.sync()` is prohibited and programmatically blocked when `NODE_ENV === 'production'`.

### Testing

| Purpose | Command |
|---|---|
| Everything | `npm test` (root) |
| Unit only | `npm run test:unit -w apps/api` |
| Integration (needs Postgres) | `npm run test:integration -w apps/api` |
| Contract vs OpenAPI | `npm run test:contract -w apps/api` |
| Frontend | `npm test -w apps/storefront` · `-w apps/erp` |
| End-to-end | `npm run test:e2e` |
| Visual regression | `npm run test:visual` |
| Update visual baselines | `npm run test:visual -- --update-snapshots` |
| Coverage | `npm run test:coverage` |

Update visual baselines only for an **intended** change, in its own commit. During R1–R4 the baselines
must not move at all — that is the UI-parity constraint in `context/08-admin-ui-guidelines.md` §0.

### API documentation

| Purpose | Command |
|---|---|
| Generate OpenAPI | `npm run openapi:generate -w apps/api` |
| Check for drift | `npm run openapi:check -w apps/api` |
| Generate Postman collection | `npm run postman:generate -w apps/api` |
| Generate typed client | `npm run client:generate -w packages/api-client` |

`openapi:check` is a CI gate. Never hand-edit `openapi.json` or the Postman collection — both are build
outputs.

### Backup and recovery

| Purpose | Command |
|---|---|
| Create encrypted backup | `npm run db:backup -w apps/api` |
| List backups | `npm run backup:list -w apps/api` |
| Verify latest | `npm run backup:verify -w apps/api` |
| Restore to a scratch database | `npm run db:restore -w apps/api -- --file <id> --target <url>` |

`db:restore` refuses a production target. See `BACKUP_RUNBOOK.md`.

### Quality

| Purpose | Command |
|---|---|
| Lint all | `npm run lint` |
| Fix | `npm run lint:fix` |
| Format | `npm run format` |
| Typecheck | `npm run typecheck` |

---

## 3. CI

GitHub Actions on Ubuntu with Node 22 and a Postgres service container, running on every push and pull
request:

```
npm ci
npm run lint
npm run db:migrate:verify -w apps/api     # twice, clean database
npm run test:unit
npm run test:integration
npm run test:contract
npm run openapi:check
npm run test:visual
npm run build
```

Full gate definitions in `docs/TESTING_STRATEGY.md` §5.
