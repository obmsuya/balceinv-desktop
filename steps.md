# Steps: multi-tenant revamp (2026-09-29)

Goal: `goal.md`. Background: `architecture.md`. Previous rounds are in git
history at this path.

## Where to start

Two tracks run in parallel:
- **Track S (server)** starts once the owner has installed the SSH key
  (S1).
- **Track A (app)** starts with Phase 0 on a `revamp` branch in both the
  `backend/` and `frontend/` submodules. `main` keeps building the current
  desktop app until Phase 9 swaps the entry point.

## Rules for every phase

- **Vertical slices.** Each phase lands migration → domain → dto →
  repository → service → handler → routes → frontend composable/page,
  and the phase isn't done until its pages work end to end.
- **Pages not yet ported stay hidden** from navigation through one list in
  the frontend nav config. The list shrinks every phase and is deleted in
  Phase 9.
- **No inline code comments** (owner's standing rule). The reasoning lives
  in this file and in commit messages.
- **Backend tests run on both engines:** SQLite always, Postgres when
  `TEST_DATABASE_URL` is set (local `docker compose -f dev/compose.yml up
  -d`).
- **Tests every phase repeats for its own endpoints**, on top of the
  phase-specific edge cases:
  - unauthenticated → 401
  - missing permission → 403
  - other company's id in the URL → **404** (never reveal that it exists)
  - other company's id inside a body → 404/400, nothing written
  - invalid DTO → 400 with field errors
  - list endpoints: `limit` 0/−1/101/non-numeric clamp to the allowed
    range; `offset` beyond the end gives an empty page; query count ≤ 3
  - a write that fails halfway leaves nothing behind (request transaction
    rollback)
- **Frontend gate every phase:** `pnpm build`, `pnpm generate`, then the
  phase's pages checked in the preview browser in light, dark and 375 px
  width, with no console errors, before the box is checked.
- Record the commands actually run under each phase's **Verification
  performed**. Nothing is claimed without them.

---

## Track S: cloud server (`140.99.254.193`, host `faltasi`)

Files live in the backend repo under `deploy/` so the server is
reproducible: `server-setup.sh`, `docker-compose.prod.yml`, `Caddyfile`,
`garage.toml`, `postgres/init/`, `.env.prod.example`, `init-secrets.sh`,
`backup.sh`, `restore-drill.sh`, `pull-backups.sh`, `deploy.sh`.

### S1: key-only SSH access (owner action, then verified)
- [ ] Owner runs `ssh-copy-id -i ~/.ssh/id_ed25519.pub root@140.99.254.193`
      once and types the password in their own terminal.
- [ ] Verify with a key login: `ssh -o BatchMode=yes root@140.99.254.193 true`.
- [ ] Record the OS, CPU architecture, RAM and disk, and size everything
      below from those numbers.

### S2: OS hardening
- [ ] `apt update && apt full-upgrade`; `unattended-upgrades` for security
      updates only.
- [ ] Timezone UTC; a swap file if RAM ≤ 4 GB; journald capped at 200 MB.
- [ ] sshd: `PasswordAuthentication no`, `KbdInteractiveAuthentication
      no`, `PermitRootLogin prohibit-password`. Validate with `sshd -t`,
      reload, then **confirm a new key session works before closing the old
      one**.
- [ ] Owner changes the root password afterwards; it's in the chat
      transcript. With key-only SSH it only matters at the provider console.

### S3: firewall
- [ ] ufw: default deny incoming, allow outgoing, `limit 22/tcp`, allow
      80/tcp and 443/tcp; enable.
- [ ] Docker bypasses ufw for published ports, so **only Caddy publishes
      ports**. Postgres and Garage sit on an internal compose network with
      no `ports:`.
- [ ] Check from the Mac: 22/80/443 open; 5432, 3900, 3901 and 3903 closed.

### S4: Docker
- [ ] Docker Engine and the compose plugin from Docker's apt repo.
- [ ] `/etc/docker/daemon.json`: `json-file` log driver with max-size 10 MB
      and 3 files, and `live-restore`.

### S5: base stack in `/opt/balce`
- [ ] `postgres:17-alpine`: memory limit, tuned `shared_buffers` and
      `work_mem`, data volume, healthcheck.
- [ ] Postgres roles from `postgres/init/`: `balce_owner` (owns the schema,
      runs migrations) and `balce_app` (runtime; not an owner, no
      `BYPASSRLS`).
- [ ] Garage (S3-compatible, single node, replication 1): memory limit,
      buckets `balce-media` and `balce-backups`, an access key for the API.
- [ ] Caddy: answers on `:80` with a placeholder until the domain round.
- [ ] `docker compose ps` all healthy; `docker stats` recorded (the
      resource baseline).

### S6: secrets in `.env.prod`
- [ ] `.env.prod.example` in the repo lists every key with no values.
- [ ] `init-secrets.sh` on the server creates `/opt/balce/.env.prod`
      (`root:root`, `0600`), filling any empty key with `openssl rand -hex
      32` and **never printing values**.
- [ ] Owner instructions (below) for reading or rotating a value.

### S7: backups
- [ ] `backup.sh`: `pg_dump -Fc` through `docker exec` into
      `/opt/balce/backups/`, keeping 7 daily and 4 weekly, with a copy
      uploaded to the Garage `balce-backups` bucket. Run nightly by cron.
- [ ] `restore-drill.sh`: restores the newest dump into a scratch database
      and prints row counts per table next to the live database.
- [ ] `pull-backups.sh` (run on the owner's Mac): rsyncs `backups/` **off
      the box**. A backup kept only on the same VPS doesn't survive losing
      the VPS.

### S8: deploy script (written now, used in the next round)
- [ ] `deploy.sh`: cross-compile a static linux binary
      (`CGO_ENABLED=0`), copy it over, build a minimal image on the server,
      `docker compose up -d api`, wait for `/health`, and roll back to the
      previous image tag if it doesn't turn healthy.
- [ ] Dry-run mode prints every step without changing the server.

#### Owner instructions: secrets
- Read a value: `ssh root@140.99.254.193 "grep ^KEY= /opt/balce/.env.prod"`.
- Rotate a value: edit it with `nano /opt/balce/.env.prod`, then
  `docker compose --env-file .env.prod up -d` in `/opt/balce`.
- Never commit `.env.prod`, never paste it into chat, and keep a copy in a
  password manager.

**Verification performed (Track S):** _pending_

---

## Phase 0: backend foundation

Branch `revamp` in `backend/`. The old GORM code stays untouched and
building until Phase 9. The new config lives in `internal/config` because
the old `config/` package is still in use; it moves in Phase 9.

- [x] `dev/compose.yml`: local Postgres 17 on `127.0.0.1:55432`.
- [x] `internal/config`: godotenv; Postgres when `DATABASE_URL` is set,
      otherwise SQLite at `DB_PATH` or the app data folder; setting both is
      rejected; `ALLOWED_ORIGINS` required in cloud; `LISTEN_ADDR` default
      `127.0.0.1:8080`; every problem reported together.
      `.env.example` added.
- [x] `internal/common/database`: Postgres (pgx stdlib, max 10 conns) or
      SQLite (modernc; WAL, `foreign_keys`, `busy_timeout(5000)`,
      `synchronous(NORMAL)`; a one-connection writer with immediate
      transactions, plus a four-connection `query_only` reader); `Querier`
      interface; `CountingQuerier` for N+1 tests. The dialect helper is
      deferred until the first query that differs.
- [x] Migrations: golang-migrate with embedded `migrations/postgres` and
      `migrations/sqlite`, run on a short-lived connection before the pools
      open; a dirty version stops startup with instructions; SQLite is
      copied with `VACUUM INTO` before pending migrations run. First
      migration: `companies`.
- [x] `internal/common/logging`: slog text, dated file + stdout, time of
      day only, `WriteSeparator` after each request.
- [x] `internal/common/response`: `{success, message, data}`; errors add
      `code` and `requestId`; `ValidationError` with field list; `Page`.
- [x] `internal/common/httpx`: request ID + access log; request
      transaction (reader for GET/HEAD, read-only on Postgres; writer
      otherwise; rollback on error, panic, or status ≥ 400); error handler
      that logs 5xx once; pagination clamp.
- [x] `cmd/server/main.go` (under 100 lines) and `internal/server.New`:
      config → logging → migrate → open → Fiber (recover, helmet, CORS from
      config) → `/health` → graceful shutdown.
- [x] `internal/testkit`: every test runs on SQLite (inside a folder named
      `Application Support`, to cover paths with spaces) and on a fresh
      Postgres database per test when `TEST_DATABASE_URL` is set.

**Edge-case tests:**
- [x] Migrations up → repeat up (no-op, no copy) → down → up, both engines.
- [x] Time round-trip (UTC, microseconds) and UUIDv7 round-trip, both
      engines.
- [x] `SELECT $2, $1` binds by number on SQLite as on Postgres.
- [x] 50 concurrent read-then-write transactions on SQLite: zero lock
      errors, 50 rows.
- [x] Writes followed by 409, a returned error, or a panic leave no row; the
      next write still succeeds (no leaked writer connection); a write
      inside GET fails with 500 on both engines; every error body carries
      a `requestId`.
- [x] Pagination clamps `0`, `-1`, `abc`, `101` and a negative offset.
- [x] `/health` gives 200 live and 503 after the database closes;
      `X-Request-Id` on every response.
- [x] Config: both databases → error; cloud without origins → error; both
      problems reported in one error; desktop defaults; origin list
      trimming.
- [ ] Pre-migration copy is created when a migration is pending (moved to
      Phase 1; it needs a second migration to exist).

**Verification performed (2026-09-29):**
- `docker compose -f dev/compose.yml up -d --wait` → Postgres healthy.
- `go build ./...` → old and new code both compile.
- `go vet ./internal/... ./cmd/... ./migrations/...` → clean.
- `TEST_DATABASE_URL=postgres://balce:…@127.0.0.1:55432/balce go test
  -count=1 -v ./internal/...` → every subtest passes on **sqlite and
  postgres**. The first run caught a real bug: migrations ran before the
  SQLite folder existed, so a first desktop launch into a new app data
  folder would have failed. Fixed with `ensureSqliteDirectory` in both
  open paths.
- `go test ./backup/... ./license/... ./services/... ./repository/...
  ./middleware/...` → the old code's tests still pass after the dependency
  upgrade.
- Smoke run: `go build ./cmd/server`, started with `DB_PATH` inside a
  folder containing a space → `GET /health` 200
  `{"data":{"engine":"sqlite"}}`, `logs/2026-09-29.log` created, SIGTERM →
  "shutting down" and a clean exit.
- Toolchain note: modernc/sqlite 1.60 needs Go 1.26, so `go.mod` now says
  1.26. CI's `setup-go` resolves it automatically; CLAUDE.md is updated in
  Phase 9.

---

## Phase 1: tenancy core and auth (first usable slice: set up, log in, manage users)

**Tables:** `companies`, `shops`, `permissions` (global, seeded by
migration), `roles` (per company), `role_permissions`, `users`,
`user_permissions`, `user_shops`, `sessions`, `login_attempts`.

Postgres only: RLS policies with `FORCE` on every tenant table. The
request transaction sets `app.company_id`.

**Routes kept:** `/api/setup/status`, `/api/setup`, `/api/auth/login`,
`/api/auth/logout`, `/api/auth/me`, users, roles and permissions groups.
**Removed:** `/api/auth/refresh`. **New:** `/api/auth/switch-shop`,
`/api/platform`.

- [ ] Sessions: 32 random bytes; only the SHA-256 hash is stored; 12 h
      idle and 30 days absolute; `last_seen_at` bumped at most once a
      minute.
- [ ] Cookie `balce_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`,
      `Secure` over HTTPS); Bearer accepted for Tauri.
- [ ] All of a user's sessions revoked on password change, disable or role
      change.
- [ ] Origin allowlist on non-GET requests; Fiber `limiter` on login (IP +
      email); `helmet`.
- [ ] Setup is allowed only when no company exists (the desktop first run).
      Cloud companies are created with `cmd/admin create-company`; there's
      no public signup.
- [ ] Setup creates company + first shop + owner role + owner user +
      settings in one transaction.
- [ ] Login-by-email and session-by-token lookups run before the tenant is
      known. The RLS policy therefore reads `app.company_id` with
      `missing_ok` (an unset value matches no rows, so it still fails
      closed), and only the auth repository sets a narrow
      `app.auth_lookup` flag that the `users` and `sessions` policies
      accept.
- [ ] RLS tests connect as `balce_app`, because a superuser bypasses RLS
      even with `FORCE`.
- [ ] Carried over from Phase 0: a test that the pre-migration SQLite copy
      is created when migration 2 is pending.
- [ ] Frontend: delete the refresh logic, add `usePlatform` (with
      `isTauri()` moved in) and the runtime API base; the login, setup,
      users and roles pages work; UUID ids replace numeric ids in the
      types.

**Edge-case tests:**
- [ ] Setup a second time → 409.
- [ ] Wrong password and unknown email give the same message and similar
      timing (no user enumeration).
- [ ] The 6th failed login within a minute → 429.
- [ ] Disabling a user makes their live session 401 on the next request.
- [ ] An expired session (idle or absolute) → 401 and the row is removed.
- [ ] The raw token is never in the database.
- [ ] Cookie flags asserted; Bearer path works.
- [ ] POST with a foreign `Origin` → 403.
- [ ] Two companies can both have a role called "Manager"; the same company
      twice → 409.
- [ ] The last owner can't be deleted or demoted.
- [ ] A role from company B can't be assigned to a user in company A.
- [ ] A duplicate email anywhere in the platform → 409.
- [ ] A user without `users.edit` can't grant themselves permissions.
- [ ] Switching to a shop not in `user_shops` → 403.
- [ ] **Two-company leak test:** company A's token on every endpoint never
      returns company B data (both engines, and RLS alone on Postgres by
      calling a repository without the explicit filter).

**Verification performed:** _pending_

---

## Phase 2: company settings, branding, currency, storage

**Tables:** `settings` (company-level: tax rate in basis points,
receipt toggles, alert settings, EFD, desktop printer fields), plus
company branding and currency columns and per-shop receipt prefix and
counter.

- [ ] `internal/common/storage`: `Put`/`Get`/`Delete`, with a Garage (S3)
      implementation for cloud and a local-directory one for desktop.
- [ ] Logo upload: ≤ 1 MB, content type sniffed (png/jpeg/webp) rather
      than trusted from the extension; the object key is stored, never
      base64 in rows.
- [ ] `primary_color` validated as `#RRGGBB`.
- [ ] The EFD API key is write-only: responses carry `efd_api_key_set`
      only.
- [ ] Currency code and decimals chosen at setup (TZS default 0 decimals);
      changing them after the first sale → 409 (the check goes live in
      Phase 5).
- [ ] Frontend theme: load the brand colour into `--brand`; light
      `--primary` = the brand; dark `--primary` = the brand mixed lighter
      with `color-mix`; the foreground is black or white by luminance;
      ring, sidebar and chart-1 follow the brand. The last brand is cached
      locally so reloads don't flash the default green.
- [ ] Settings → Branding: colour picker with presets, a live preview of
      both themes, and a contrast warning below WCAG AA; logo upload.
- [ ] Icons: lucide only, one size scale (16 px inline, 20 px nav), the
      company logo in the sidebar header, the app logo and favicon from
      `public/logo`.
- [ ] `formatMoney` in `useSettings` replaces all 25 hardcoded `TZS`
      formatters. `grep -rn "TZS" app` returns nothing.

**Edge-case tests:**
- [ ] Bad hex, 3-digit hex or a missing `#` → 400.
- [ ] Company B can't read or change company A's settings or logo.
- [ ] The EFD key never appears in any response.
- [ ] An oversized logo or a fake `.png` → 400.
- [ ] Brand colour change → both themes update without reload (preview
      check, light + dark).

**Verification performed:** _pending_

---

## Phase 3: products and catalog

**Tables:** `products` (parent/variant, price/cost/wholesale in minor
units, `image_key`, `metadata`, `is_active`), `barcodes`, `price_history`,
`product_addons`, `catalog_products` (platform-wide).

**Routes kept:** all of `/api/products/*`, `/api/addons/*`,
`/api/catalog*`, the image-upload session routes.

- [ ] List: paginated; search by name, SKU or barcode; category filter.
      One page query + one barcode batch query + stock for the active shop
      joined in.
- [ ] Deleting a product that has ever sold archives it (`is_active =
      false`) instead of deleting it.
- [ ] Excel import: validate every row first; any error returns the row
      list and imports nothing; valid files import in one transaction.
- [ ] The Excel template actually downloads (the success toast fires only
      after the file is written).
- [ ] Price changes write `price_history` in the same transaction.

**Edge-case tests:**
- [ ] The same SKU or barcode in two companies is fine; within one company
      → 409.
- [ ] A variant whose parent belongs to another company → 404.
- [ ] Negative price or cost → 400; zero price is allowed.
- [ ] 1,000-row import completes in one transaction; one bad row → nothing
      imported and the row number reported.
- [ ] List of 200 products runs ≤ 3 queries.
- [ ] Deleting a sold product archives it.

**Verification performed:** _pending_

---

## Phase 4: shops, stock, transfers, notifications

**Tables:** `shop_stock` (key `shop_id, product_id`), `stock_movements`
(reason is one of `sale`, `purchase`, `adjustment`, `damage`,
`transfer_in`, `transfer_out`, `opening`), `stock_transfers` +
`stock_transfer_items`, `notifications`.

- [ ] Every stock change is one conditional update that refuses to go
      below zero, plus a movement row, in the same transaction.
- [ ] A low or out-of-stock notification fires once when a threshold is
      crossed, not on every sale.
- [ ] Shops CRUD (cloud); shop switcher in the header (cloud only).
- [ ] Stock and transfer pages.

**Edge-case tests:**
- [ ] An adjustment below zero → 409 and nothing written.
- [ ] Transfer to the same shop → 400; from a shop the user isn't assigned
      to → 403.
- [ ] 10 parallel sales of 1 unit against stock 5 → exactly 5 succeed, on
      both engines.
- [ ] Invariant: the sum of movements equals `shop_stock.quantity` for
      every product after a mixed scenario.
- [ ] Crossing `min_stock` twice in a row creates one notification.

**Verification performed:** _pending_

---

## Phase 5: discounts and sales (POS)

**Tables:** `discounts` (percent in basis points or a fixed amount),
`sales` (`client_ref` unique per company, subtotal, discount, tax, total,
paid, change), `sale_items` (product name, unit price and **unit cost**
snapshotted), `sale_item_addons`.

- [ ] `POST /api/sales`: the server recomputes every price, discount and
      tax from the database; ignores prices sent by the client; takes the
      receipt number from the shop counter; updates stock, inserts the
      sale, items and movements, and raises alerts, all in one
      transaction.
- [ ] Replaying the same `client_ref` returns the original sale with its
      original status.
- [ ] Tax-inclusive calculation in integers, with the rounding rule written
      down here once it's decided and tested.
- [ ] Browser receipt page (80 mm) for LAN tills and cloud; the desktop
      serial print path stays the same.
- [ ] POS generates `client_ref` per checkout with
      `crypto.randomUUID()`.

**Edge-case tests:**
- [ ] Replay the same body → same sale, stock decremented once; same
      `client_ref` with a different body → 409.
- [ ] Insufficient stock on any line → 409 and nothing written.
- [ ] A tampered client price is ignored.
- [ ] Expired or inactive discounts are not applied.
- [ ] Wholesale price applies at `wholesale_min` and not one below.
- [ ] Rounding: 1-unit items and 18% tax on awkward totals match the
      written rule.
- [ ] Cash paid below the total → 400.
- [ ] Receipt numbers stay unique and gap-free per shop under 20 concurrent
      sales.
- [ ] Another company's product in the cart → 404, nothing written.
- [ ] Changing the currency after this first sale → 409.

**Verification performed:** _pending_

---

## Phase 6: reports and dashboard

- [ ] All six report routes plus `/api/dashboard` rewritten as SQL
      aggregates (`SUM`/`COUNT`/`GROUP BY`), filtered by shop or all shops.
- [ ] Days are grouped in the company's timezone
      (`companies.timezone`, default `Africa/Dar_es_Salaam`) through the
      dialect helper.
- [ ] Profit uses the `unit_cost` snapshot, never the current product cost.
- [ ] Exports: Excel built client-side with `xlsx` and saved via
      Blob/Tauri; PDF through the print stylesheet. No backend export
      routes.

**Edge-case tests:**
- [ ] A seeded dataset gives exact expected totals.
- [ ] Changing a product's cost after a sale leaves past profit unchanged.
- [ ] An empty range returns zeros, never nulls.
- [ ] A sale at 23:30 UTC counts on the next local day in Dar es Salaam.
- [ ] The query count stays the same with 10 or 10,000 sales.
- [ ] Shop filter; cross-tenant isolation.

**Verification performed:** _pending_

---

## Phase 7: desktop specifics and LAN

- [ ] Backup/restore moves to `VACUUM INTO`, and the existing backup tests
      are ported.
- [ ] License (hardware ID) behaviour unchanged, desktop only.
- [ ] Serial printing unchanged, desktop only.
- [ ] LAN toggle: the sidecar restarts on `0.0.0.0:8080`; Go serves
      `BALCE_STATIC_DIR` with an `index.html` fallback; `/api/platform`
      reports `lan_urls`; Network screen with a QR code.
- [ ] The phone image-upload QR works on the LAN.

**Edge-case tests:**
- [ ] Backup → restore round-trip keeps every row.
- [ ] The static fallback serves `index.html` for deep links but never for
      `/api/*`.
- [ ] LAN off → the port isn't reachable from another machine.

**Manual follow-up:** two real machines on one Wi-Fi. Turn on LAN → allow
the Windows firewall prompt for **private networks** → open the shown URL
on the second machine → log in as a cashier → sell → print from that
browser to a thermal printer installed with its OS driver. Check that the
80 mm layout fits and that two tills selling at the same moment both
succeed.

**Verification performed:** _pending_

---

## Phase 8: languages (en, sw)

- [ ] `useI18n`: `t(key, params)`, JSON dictionaries, per-user locale with
      a company default, `Intl` for numbers and dates.
- [ ] API errors carry a stable `code`; the frontend translates by code.
- [ ] Every page moved to `t()`; browser receipts translated; desktop
      serial receipts use a label map chosen by `settings.receipt_language`.

**Edge-case tests:**
- [ ] A missing key falls back to English and is never shown blank.
- [ ] Switching language updates the page without reload.
- [ ] Swahili strings don't break the layout at 375 px.

**Verification performed:** _pending_

---

## Phase 9: switch-over and cleanup

- [ ] Tauri builds `cmd/server`; the old `main.go`, `handlers/`,
      `services/`, `repository/`, `models/`, `utils/jwt.go`, GORM and
      `golang-jwt` are deleted.
- [ ] Unused frontend dependencies removed after a grep proves them unused
      (`@libsql/client`, `drizzle-orm`, `drizzle.config.ts`, `pg`,
      `puppeteer-core`, `@sparticuz/chromium`, `jsonwebtoken`, `bcryptjs`).
- [ ] The "hidden until ported" nav list is deleted.
- [ ] `CLAUDE.md` stack section updated (database/sql + pgx/modernc, no
      GORM, the new layout).
- [ ] Full regression on both engines; `/security-review` on the branch; a
      macOS Tauri build; a Windows build checked manually.

**Verification performed:** _pending_

## Manual follow-up required
_Collected from the phases above as they complete._
