# Auth Migration Runbook (R2)

Moving existing accounts into Supabase Auth. Run from a machine that can reach
both MongoDB Atlas and Supabase.

**This cannot be run from a Claude Code cloud session.** That environment's
proxy allows HTTPS only, so raw TCP to Atlas (27017) and Postgres (5432/6543)
is unreachable. Atlas reports this as an IP allowlist problem, which is
misleading — the socket never opens, so allowlisting does not help.

---

## Before you start

Nothing here is destructive: the script only adds `supabaseUserId` to existing
documents and creates Supabase users. It does not delete, and it does not touch
password hashes. Even so, take an Atlas snapshot first — it costs nothing and
the alternative is finding out you needed one.

### 1. Put the database name in the connection string

Atlas hands out URIs without one:

```
mongodb+srv://user:pass@website-db.bvrgoos.mongodb.net/?appName=website-db
                                                      ^ no database name
```

Connecting like that lands in the driver default (`test`), where these
collections do not exist — the import would find nothing and report success.
The script refuses to run rather than let that happen, but fix the URI anyway:

```
mongodb+srv://user:pass@website-db.bvrgoos.mongodb.net/em_furniture?appName=website-db
```

Use whichever database name actually holds your collections.

### 2. Configure the environment

`apps/api/.env` needs `MONGODB_URI`, `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The service-role key is required — the Auth Admin
API will not accept the anon key.

---

## Run it

```bash
npm run auth:import:dry -w apps/api    # reports, changes nothing
npm run auth:import -w apps/api        # the real thing
```

The dry run prints the account counts it found. **If those are zero, stop** —
the database name is wrong. Do not proceed on the assumption there is nothing
to import.

Expected output shape:

```
DRY RUN — database "em_furniture" -> https://<ref>.supabase.co

found  users: 128 (0 already linked)
found  admins: 3 (0 already linked)

users   { total: 128, created: 128, adopted: 0, skipped: 0, failed: 0 }
admins  { total: 3, created: 3, adopted: 0, skipped: 0, failed: 0 }
```

### If it fails partway

Re-run it. The script is idempotent by construction: linked accounts are
skipped, and an email already present in Supabase is adopted rather than
duplicated. A long import fails partway — that is the case it was built for.

`skipped` counts accounts with no email or no password hash. Those need looking
at individually; they cannot be imported as they stand.

---

## Verify

```bash
# Every account should be linked.
mongosh "$MONGODB_URI" --eval '
  print("users unlinked:",  db.users.countDocuments({supabaseUserId: {$in: [null, undefined]}}));
  print("admins unlinked:", db.admins.countDocuments({supabaseUserId: {$in: [null, undefined]}}));
'
```

Then sign in as a real user **with their existing password**. Nobody should
need a reset — bcrypt hashes transfer, which was verified end to end against
the live project rather than taken from documentation.

---

## Rollback

There is nothing to undo in Mongo; `supabaseUserId` is additive and the app
ignores it on the legacy path. If you need to start over:

```bash
mongosh "$MONGODB_URI" --eval '
  db.users.updateMany({}, {$unset: {supabaseUserId: ""}});
  db.admins.updateMany({}, {$unset: {supabaseUserId: ""}});
'
```

Then delete the users from Supabase (Dashboard → Authentication → Users) and
re-run. Sign-in keeps working throughout, because the legacy cookie path
remains active until it is deliberately removed.

---

## Afterwards

Only once every account is linked and Supabase sign-in is confirmed working:

1. Remove `protectRoute` and `protectAdminRoute`, replacing their remaining uses
   with `identify` + `requireUser` / `requireStaff`.
2. Drop `JWT_SECRET` and `lib/utils.js`'s `generateToken`.
3. Drop `passwordHash` from both models — Supabase owns credentials from then on.

Do these as separate commits, after the import has been stable in production for
a few days. There is no hurry, and the fallback path is what makes it safe to
wait.
