# Goal: multi-tenant revamp (2026-09-29)

Previous rounds are preserved in git history at this same path.
Execution checklist: `steps.md`. Background reasoning: `architecture.md`.

## Why this round exists

Clients want Balce across many shops, reachable from anywhere, while rural
shops without internet keep the desktop app. Production has **no users
yet**, so the database, backend and frontend can be rebuilt cleanly instead
of patched. Accounting is paused until this round is done, so it lands on
the final foundation instead of being retrofitted.

## Target state ("done" looks like this)

### One codebase, three ways to run
1. **Cloud:** Go API on the VPS (`140.99.254.193`, Docker) with Postgres
   and Garage object storage; frontend on Vercel.
2. **Desktop:** Tauri + Go sidecar + SQLite, fully offline.
3. **Desktop + LAN:** one PC hosts the server; the other tills use a
   browser and **each till prints from its own browser**.
4. The same frontend build and the same backend binary serve all three.
   Postgres vs SQLite is chosen by config alone.

### Database
5. Every business table carries `company_id`; location-bound tables also
   carry `shop_id`. Uniqueness is per company (SKU, barcode, receipt
   number, role name).
6. Postgres enforces isolation with Row-Level Security (`FORCE`, non-owner
   app role). Every query *also* filters `company_id` explicitly, so SQLite
   and Postgres behave the same.
7. Money is `BIGINT` minor units. Percentages are basis points. Time is UTC.
   IDs are UUIDv7 generated in Go (SQLite can't generate UUIDs, and
   device-made IDs are what a future offline sync needs).
8. Schema lives in numbered `.up.sql`/`.down.sql` pairs, one directory per
   engine, applied by golang-migrate at startup. Desktop copies its SQLite
   file before migrating.
9. **No N+1.** A list endpoint runs at most three queries no matter how many
   rows it returns, and a query-count test proves it. Reports are SQL
   aggregates, never "load every sale into Go and loop".

### Backend (per the backend-go skill)
10. Raw SQL through `database/sql`, with pgx as the Postgres driver and
    modernc as the SQLite driver. No GORM.
11. Layout `cmd/server`, `config`, `migrations/{postgres,sqlite}`,
    `internal/<feature>/{domain,dto,repository,service,handler}.go`,
    `internal/common/…`.
12. One transaction per request: read requests get a reader transaction,
    writes get a writer transaction. It rolls back on error **or on any
    response ≥ 400**. On SQLite, writes go through a single-connection
    writer pool, so several LAN tills never hit "database is locked".
13. Auth is opaque server-side sessions (only a SHA-256 hash is stored).
    The browser gets an httpOnly cookie; Tauri sends a Bearer header. There
    are no signing secrets compiled into binaries, and revocation is
    instant on logout, disable, role change or password change.
14. Security middleware: Origin allowlist on writes, rate limit on login,
    helmet headers, request IDs in every error, slog text logs in dated
    files.
15. Idempotent sale creation (`client_ref`). The server recomputes every
    price, discount and tax, never trusting client numbers. Stock can't go
    negative under concurrent sales.
16. Existing route paths are kept wherever the feature survives, so the
    frontend changes stay small.

### Frontend
17. Clean shadcn UI with consistent lucide icons. **The brand colour comes
    from the database** (`companies.primary_color`), is applied at runtime
    to both light and dark themes with a readable foreground, and can be
    changed in Settings.
18. `formatMoney` is the only money formatter (the 25 hardcoded `TZS`
    formatters are gone). Currency code and decimals come from the company
    and lock after the first sale.
19. The API base is worked out at runtime (Tauri / Vercel / LAN). Features
    are hidden by platform, never compiled out.
20. English + Swahili through one small `t()` composable.

### Server (cloud VPS)
21. SSH by key only, root password login off, ufw (22 rate-limited, 80,
    443), unattended security updates, Docker with log rotation, and no
    database or storage port published to the internet.
22. Secrets live in `/opt/balce/.env.prod` (root, `0600`), generated on the
    server and never committed.
23. Nightly Postgres backup with retention and a restore-drill script, plus
    a pull script that copies backups **off the box** to the owner's
    machine.
24. Deploy script written and dry-run tested. Real application deploy and
    domain/TLS are the next round.

## Non-goals for this round
- Accounting (suppliers, purchases, ledger, P&L…): the next round.
- Live desktop ↔ cloud sync.
- Real production deploy, the domain, and Vercel project setup.
- OpenBao or any secrets server; `.env.prod` is enough on one VPS.
- MinIO (archived upstream; its Docker images are gone). Garage replaces it
  behind the same S3 API.

## Definition of done
- Every box in `steps.md` checked, each phase with its verification record.
- `go build ./... && go vet ./... && go test ./...` clean on **SQLite and
  Postgres** (`TEST_DATABASE_URL` set).
- `pnpm build && pnpm generate` clean; every page checked in the preview in
  light, dark and phone width with no console errors.
- The two-company leak test and the N+1 query-count tests pass on both
  engines.
- Server checks in `steps.md` Phase S pass from outside the box.
