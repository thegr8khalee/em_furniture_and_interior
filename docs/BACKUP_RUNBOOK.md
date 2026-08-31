# Backup & Disaster Recovery Runbook

> Encrypted off-provider backups, verification, and restore drills.

---

## 1. Why not just rely on Supabase PITR

Point-in-time recovery is excellent and should be enabled. It is not sufficient on its own:

- It is **the same provider**. Account suspension, billing failure, or provider-side loss takes the
  database and its recovery mechanism together.
- It does not protect against **authorised destructive action** propagated before anyone notices.
- It cannot be **verified independently** — you cannot practise restoring from it into a scratch database
  as a routine drill.

So: PITR **and** independent, encrypted, off-provider dumps. Two mechanisms with uncorrelated failure
modes.

---

## 2. Nightly job

Runs as a Render Cron job. Streams throughout — the dump is never written to disk in plaintext, and the
job's memory footprint stays flat regardless of database size.

```
pg_dump --format=custom $DIRECT_DATABASE_URL
  │
  ├─→ SHA-256 (plaintext checksum)
  ├─→ AES-256-GCM  (key: BACKUP_ENCRYPTION_KEY, random 96-bit IV per run)
  └─→ streamed upload → Backblaze B2
```

**Envelope header** — written ahead of the ciphertext so a restore needs nothing but the file and the key:

| Field | Bytes | Contents |
|---|---|---|
| Magic | 4 | format identifier |
| Version | 1 | envelope version |
| IV | 12 | random per run |
| Plaintext SHA-256 | 32 | integrity check after decryption |
| Metadata length | 4 | |
| Metadata | var | JSON: timestamp, pg version, database, row counts |
| Ciphertext | var | |
| GCM auth tag | 16 | tamper detection |

GCM gives authenticated encryption: a modified backup fails to decrypt rather than restoring corrupt
data silently. The SHA-256 is belt-and-braces against a correct decryption of the wrong content.

**Key custody.** `BACKUP_ENCRYPTION_KEY` is a 256-bit random value stored **outside both Supabase and
Render** — a password manager entry with at least two named holders. A key that lives only in the
environment of the service being backed up protects against nothing.

**Retention.** 30 daily, 12 weekly, 12 monthly, in a dedicated B2 bucket with an application key scoped to
that bucket alone and object lock enabled where possible.

---

## 3. Commands

| Purpose | Command |
|---|---|
| Create backup | `npm --prefix apps/api run db:backup` |
| List backups | `npm --prefix apps/api run backup:list` |
| Verify latest | `npm --prefix apps/api run backup:verify` |
| Restore to a target | `npm --prefix apps/api run db:restore -- --file <id> --target <url>` |

`db:restore` **refuses to target the production database URL.** Restores go to a scratch database; a
deliberate, manual step promotes one. Automated restore-to-production is a footgun with no upside.

---

## 4. Verification

**Automated, nightly, immediately after the backup.** A backup that has never been restored is a
hypothesis, not a backup.

`backup:verify` downloads the latest object, decrypts it, checks the GCM tag and the SHA-256, restores
into a scratch database, and asserts: schema version matches, core table row counts are within tolerance
of the source, and the **trial balance nets to zero**. That last assertion is the one that matters — it
proves the financial data survived intact, not merely that bytes moved.

Failure raises an on-call alert through Sentry and email (`context/10` §3).

**Quarterly manual drill.** A person, not a script, restores the previous night's backup into a scratch
environment, points a local API at it, and confirms login, an order list, and a document render. Record
the date, the operator, the elapsed time, and anything that surprised them. The elapsed time *is* the RTO
— an untimed drill does not tell you whether the objective is met.

---

## 5. Objectives

| Metric | Target | Mechanism |
|---|---|---|
| RPO — tolerable data loss | 5 minutes | Supabase PITR |
| RPO — provider-loss scenario | 24 hours | Nightly encrypted dump |
| RTO — corruption or bad deploy | 1 hour | PITR restore |
| RTO — full provider loss | 4 hours | B2 restore into a new project |

---

## 6. Scenarios

**Accidental destructive action, noticed quickly.** PITR to just before the statement. Fastest path;
prefer it whenever the provider is healthy.

**Corruption discovered days later.** Restore the relevant nightly backup into a scratch database,
extract the affected records, and reconcile forward. Do not roll production back days — that discards
every legitimate transaction since.

**Provider loss.** Create a new Supabase project, restore the latest verified B2 backup, repoint
`DATABASE_URL` and `DIRECT_DATABASE_URL` on Render, rotate keys. The rehearsal for this is the quarterly
drill.

**Compromised backup key.** Rotate `BACKUP_ENCRYPTION_KEY`, re-encrypt or re-take backups under the new
key, revoke the B2 application key. Old objects encrypted under a compromised key are treated as exposed
and deleted, since B2 access alone would then be sufficient to read them.

---

## 7. What is not covered

Cloudinary assets (product images, room photos, uploaded receipts) are **not** in the database dump. They
have their own durability but no independent copy under your control. Product images are replaceable;
customer-uploaded receipts and proof-of-payment documents are not, and may be needed as evidence in a
dispute. A periodic export of authenticated assets to B2 should be scoped before go-live.
