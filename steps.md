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

Files live in the backend repo under `deploy/` (balceinv-api PR #6), so
the server can be rebuilt from the repo.

**The server is shared.** It also runs **faltasi-wealth** (FastAPI +
Postgres 15 + Redis, served at `faltasi.wapangaji.com` through nginx with a
Cloudflare Origin Certificate) and **Woodpecker CI**. Hardware: Ubuntu
25.04, 1 vCPU, 2 GB RAM, 28 GB disk.

### S1: key-only SSH access
- [x] Owner ran `ssh-copy-id`; key login verified with `BatchMode=yes`.
- [x] Inventory recorded (above). Everything below is sized for 2 GB RAM.

### S2: OS hardening
- [x] fwupd stopped and masked (it held about 600 MB of RAM).
- [x] 1 GB swap file, `vm.swappiness=10`. Timezone was already UTC.
- [x] **Password SSH stays enabled, by the owner's decision** (a
      non-technical client needs it). ufw rate-limits port 22 instead.
- [x] Package updates: 35 upgraded (including Docker 29.2.1); every
      container came back and faltasi answered 200 locally and through
      Cloudflare. Unattended upgrades on, security channel only, no
      automatic reboot.
- [ ] Reboot pending for kernels 6.14.0-35 to -37 and libc (they were
      installed before this round). Ask the owner before rebooting.
- [ ] Ubuntu 25.04 has had no security updates since January 2026.
      Upgrade to 26.04 LTS later, **after a provider snapshot**, in a
      maintenance window (runbook to be written).

### S3: firewall
- [x] ufw: default deny incoming, `limit 22/tcp`, allow 80/tcp and 443/tcp.
- [x] Docker bypasses ufw, so the other apps' published ports were
      rebound to `127.0.0.1`: faltasi Postgres 5432, Redis 6379 and API
      8000, and Woodpecker 8001. The original compose files are saved in
      `/root/balce-preflight-20260929/`. Woodpecker's UI is now reached
      with `ssh -L 8001:127.0.0.1:8001 root@140.99.254.193`.
- [x] External scan from the Mac: 22/80/443 open; 5432, 6379, 8000, 8001,
      3900, 3901 and 3903 closed.

### S4: Docker
- [x] Docker was already installed. Unused images and build cache pruned:
      disk went from 8.3 GB to 18 GB free.
- [x] Log rotation is set per service in the compose files (10 MB × 3).
      `daemon.json` is left alone, because changing it means restarting
      every container on the box.

### S5: base stack
- [x] `/opt/balce`: `postgres:17.11-alpine` (256 MB limit, tuned for small
      RAM) and `dxflrs/garage:v2.4.1` (128 MB limit) on an `internal: true`
      network; both healthy. Measured: Postgres 36 MiB, Garage 5 MiB.
- [x] Roles checked: `balce_owner` owns database and schema; `balce_app`
      can connect, isn't superuser, can't bypass RLS and can't create
      tables; PUBLIC can't connect.
- [x] Garage: single-node layout applied, bucket `balce-media`, key
      `balce-api` stored in `.env.prod`.
- [x] Proxy: nginx replaced by Caddy (`/opt/proxy`, host network, one site
      file per app in `/opt/proxy/sites/`). faltasi is kept, and its site
      file `faltasi.caddy` lives only on the server, serving the same
      Cloudflare Origin Certificate from `/etc/ssl`, the same two security
      headers, and proxying to `127.0.0.1:8000`. Switch-over took 2 s,
      with a script that would have restarted nginx if faltasi hadn't
      answered 200 within 30 s. nginx packages removed (not purged; config
      still in `/etc/nginx` and in the preflight copy). Caddy uses 10 MiB.
      The Balce site file is added in the deploy round, once the domain
      exists.

### S6: secrets in `.env.prod`
- [x] `init-secrets.sh` created `/opt/balce/.env.prod` (`600`, root) with
      five generated values; the Garage key was added by
      `garage-setup.sh`. No value was ever printed.

### S7: backups
- [x] `backup.sh` (7 daily, 4 weekly), with cron at 02:30 UTC.
- [x] `restore-drill.sh` restores into `balce_restore_check`, compares row
      counts, then drops it.
- [x] `pull-backups.sh` tested from the Mac.
- Dropped from the plan: a copy of the backups into Garage. It sits on the
  same disk, so it adds nothing; the off-box pull is the real protection.

### S8: deploy script
- [x] `deploy.sh --dry-run` prints every step; the linux/amd64 static build
      compiles. The first real deploy happens once Phase 1 adds the `api`
      service.

#### Incident during S3 (2026-09-29)
Rebinding faltasi's ports recreated its containers. The backend refuses to
start without Redis, and Redis had been crash-looping since July 20 on a
6-byte corrupt `dump.rdb` (an internet-exposed Redis without a password; a
truncated dump is a common sign of tampering). faltasi returned 502 for a
few minutes. With the owner's approval the corrupt file was deleted and
Redis restarted empty; `/`, `/docs` and `/health` returned 200 again, also
through Cloudflare.

#### Owner instructions: secrets
- Read a value: `ssh root@140.99.254.193 "grep ^KEY= /opt/balce/.env.prod"`.
- Rotate a value: edit it with `nano /opt/balce/.env.prod`, then run
  `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d`
  in `/opt/balce`. Database passwords must also be changed inside
  Postgres with `ALTER ROLE … PASSWORD`.
- Never commit `.env.prod`, never paste it into chat, and keep a copy in a
  password manager.

**Verification performed (Track S, 2026-09-29):**
- `free -m`: available 447 MB → 974 MB after fwupd and swap (1,072 MB after
  the Balce stack started).
- `df -h /`: 8.3 GB → 18 GB free after the prune.
- `ufw status`, `ss -tlnp`, and `nc -z` from the Mac on 10 ports (results
  above).
- `curl` through Cloudflare: `https://faltasi.wapangaji.com/health` → 200.
- Caddy switch-over: `/`, `/docs`, `/health` and `/openapi.json` return the
  same status and byte size as under nginx; `X-Frame-Options` and
  `X-Content-Type-Options` still present; `http://` → 308 to `https://`;
  only Caddy listens on 80/443; `caddy validate` passed before the switch.
- Reboot readiness: `docker` and `containerd` enabled; every container has
  an `always` or `unless-stopped` restart policy.
- `docker inspect` health: `balce-postgres` and `balce-garage` healthy.
- `pg_roles` and `has_*_privilege` queries (results above).
- `backup.sh` → 2 KB dump; `restore-drill.sh` → "row counts match (0
  tables)"; `pull-backups.sh` → the dump landed on the Mac.

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

Backend: balceinv-api PRs #7 (schema), #8 (auth, users, roles), #9 (admin
command and legacy-database guard). Frontend: balceinv PR #1.

**Schema** (both engines, one pair of files per table):
- [x] `shops`, `permissions` (40 seeded `resource:action` rows),
      `roles` (one owner role per company), `role_permissions`, `users`,
      `user_permissions`, `user_shops`, `sessions` (hash only),
      `login_attempts`.
- [x] Child rows use composite keys `(company_id, id)`, so the database
      rejects cross-company references. Uniqueness is per company for
      role and shop names; emails are global and stored lower case.
- [x] Postgres: forced RLS on every tenant table. `users` and `sessions`
      also accept a transaction-local `app.auth_lookup` flag, set only
      around the login and session lookups.

**Auth:**
- [x] Opaque sessions: 32 random bytes, SHA-256 hash stored, 12 h idle /
      30 days absolute, activity refreshed at most once a minute.
- [x] `balce_session` cookie (HttpOnly, SameSite=Lax, Path=/, Secure in
      cloud or over HTTPS). Desktop sends a Bearer token, which the login
      body returns only when `X-Balce-Client: desktop` is sent.
- [x] Unknown emails spend the same bcrypt time as wrong passwords and get
      the same message; 5 failures per IP+email per minute, then 429.
      Failed attempts are recorded even though the response is a 401.
- [x] Sessions end on logout, expiry, deactivation, role change and
      password change. The session that changed its own password stays.
- [x] Origin allowlist on non-GET requests (same-origin allowed); helmet.
- [x] Setup only when no company exists, and desktop only (cloud returns
      404). `cmd/admin create-company` creates cloud companies with a
      one-time owner password that must be changed at first sign-in.

**Users and roles:**
- [x] Only owners manage owners; the last active owner can't be demoted
      or deactivated; nobody can deactivate themselves; a non-owner can't
      grant permissions they don't hold; the owner role can't be edited
      or deleted; roles in use can't be deleted; delete deactivates.
- [x] Lists are paginated and run at most 3 queries.

**Frontend:**
- [x] API address resolved at runtime (Tauri / Vercel / LAN origin).
- [x] Refresh flow removed; a 401 clears the session.
- [x] **Route guards now actually run.** They were in `frontend/middleware/`,
      which Nuxt 4 never loads, so neither guard had ever been active.
- [x] Permissions come with the session; the eleven per-page refetches
      are gone.
- [x] Users and roles pages on the new API; deactivate wording; owner
      badges; the header uses the shared user and `logout()`.
- [x] Phone layout: sidebar hidden below 768 px, tables scroll in their
      card.
- [x] `app/utils/portedRoutes.ts` hides pages that aren't rebuilt yet.

**Edge-case tests** (SQLite, and Postgres as a non-superuser so RLS applies):
- [x] Setup twice → 409; cloud setup → 404; setup owner gets all 40
      permissions and the Main Shop.
- [x] Wrong password and unknown email: same message, and similar timing.
- [x] 6th failed login in a minute → 429; failures survive the rollback.
- [x] Cookie flags; the cookie works for `/me`; only the hash is stored.
- [x] No token or a forged token → 401; logout, idle and absolute expiry
      → 401 and the row is removed; a deactivated user's session → 401
      and they can't sign in.
- [x] A foreign `Origin` → 403; the allowed origin works.
- [x] Switching into another company's shop or an unassigned shop → 403.
- [x] Invalid body → 400 with field errors; an email used by another
      company → 409; another company's role or shop → 404 with nothing
      written.
- [x] A manager can't create an owner, demote the owner, grant themselves
      `settings:edit` or widen their own role; the last owner can't be
      demoted; the owner can't deactivate themselves.
- [x] A role change ends the user's sessions.
- [x] A password change keeps its own session, ends the others, and the
      old password stops working.
- [x] 30 users: page of 25 in ≤ 3 queries, shop ids attached, offset past
      the end is empty, search is case-insensitive.
- [x] Two-company isolation: every list is free of the other company's
      data; 12 cross-tenant reads and writes return 404 and change
      nothing; with RLS, unfiltered queries see nothing without a tenant
      and one company's rows with it, and a cross-company insert is
      rejected.
- [x] A foreign SQLite file (tables but no migration history) is refused
      and left untouched.
- [x] The pre-migration copy is made when migrations are pending.

**Verification performed (2026-09-29):**
- `go build ./... && go vet ./...` clean; `TEST_DATABASE_URL=… go test
  -count=1 ./...` → every package passes, every subtest on both engines
  (confirmed with `-v`).
- Mutation check: removing the company filter from the user lookup made
  the isolation test fail on SQLite (200 instead of 404). File restored.
- `cmd/admin create-company` smoke-tested: creates the company and
  one-time password; rejects empty or invalid input with field messages.
- `pnpm build` and `pnpm generate` pass.
- Browser pane against the new backend on a scratch SQLite file:
  first-run setup → sign-in lands on Users → create role → assign a
  permission (200) → create cashier → full reload keeps the session →
  `/pos` redirects to `/users` → sign-out → `/users` redirects to sign-in.
  Checked light, dark and 375 px.
- Bugs found and fixed while checking: route guards never loaded; header
  logout posted to the frontend's own origin; stale role counts after
  saving; the layout overflowed on phones; the badge text wrapped.

**Known gaps (expected until later phases):**
- `/api/license/status`, `/api/license/hardware-id` (Phase 7) and
  `/api/notifications/count` (Phase 4) return 404. The UI handles them
  quietly.
- There's no shop picker in the user form yet; new users get the
  creator's current shop. Shops UI is Phase 4.
- `app/components/AppSidebar.vue` is unused; it gets deleted in Phase 9.

**Manual follow-up:**
- On the owner's Mac, `~/Library/Application Support/com.balceinv.app/balce.db`
  (the old desktop app's database) has an extra empty-looking
  `schema_migrations` table, left by an early smoke run before the
  legacy-database guard existed. The old app ignores it. If you want it
  gone, back up that file and run `DROP TABLE schema_migrations;` on it.
  The revamped app now uses `balce.sqlite`, so it never touches that file.

---

## Phase 2: company settings, branding, currency, storage

Backend: balceinv-api PR #10. Frontend: balceinv PR #2.

- [x] `settings` table per company (tax in basis points, receipt, alert,
      EFD and desktop printer fields), created with every company; RLS on
      Postgres.
- [x] `internal/common/storage`: one `Store` interface; a local-folder
      store for desktop (media beside the database) and an S3 store for
      Garage, signed with SigV4 using only the standard library. Keys must
      match `^[a-z0-9][a-z0-9/_.-]*$` with no `..` or empty segments.
      Cloud config requires every `S3_*` value.
- [x] `GET/PUT /api/settings` with partial updates; `#RRGGBB` colours,
      tax 0–100, upper-case currency, 0 or 2 decimals, IANA timezone,
      `https://` EFD endpoint, valid notification email, 58/80 mm paper.
- [x] EFD API key is write-only (`efd_api_key_set`); an empty value
      clears it.
- [x] Logo: ≤ 1 MB, type detected from the bytes (PNG/JPEG/WebP), stored
      under `logos/<company>/<random>.<ext>`, served publicly and immutably
      at `/api/branding/logo/<company>/<file>`.
- [x] `/me` and login return `branding` (logo, colour, currency, decimals,
      timezone, locale), so cashiers without `settings:view` still get
      the brand and currency.
- [x] Frontend theme: `--brand` drives primary, ring, chart and sidebar
      accents; dark mode lightens it until it reaches 3:1 on the dark
      page; text on the brand is black or white by contrast; the last
      brand is cached and applied before the first render.
- [x] Branding tab: picker, hex field, 13 presets, live light and dark
      previews, a warning below 3:1 against the page, logo upload.
- [x] Header shows the company logo and name; lucide icons for the theme
      toggle.
- [x] `formatMoney` replaces nine local formatters (eight TZS, one USD on
      the dashboard) and the "(TZS)" labels.
- [x] Settings page on the new API. Removed because they saved or did
      nothing: the fake "Test EFD connection" (it always said unreachable)
      and the "Change Counter" switch. The serial printer card and Updates
      tab show only in the desktop app. Backup tab returns in Phase 7.
- [ ] Currency locked after the first sale: the check lands with sales in
      Phase 5.

**Edge-case tests** (SQLite and Postgres as a non-superuser):
- [x] Defaults; a settings read runs at most 2 queries.
- [x] A partial update changes only the fields sent.
- [x] 12 rejected inputs: `#fff`, `1d4ed8`, `#12345G`, tax 101 and −1,
      `kes`, 3 decimals, an unknown timezone, an `http://` EFD endpoint,
      a bad email, 70 mm paper, an empty business name.
- [x] `/me` branding follows the settings; another company's settings are
      unchanged; `settings` is included in the RLS check.
- [x] A cashier gets 403 on settings but still receives the brand in
      `/me`.
- [x] The EFD key never appears in any response; another update keeps it;
      an empty value clears it.
- [x] Logo: missing file 400; text named `.png` 400; 1 MB + 1 → 413;
      cashier 403; a valid PNG is stored and served byte-for-byte with
      `image/png` and an immutable cache header; traversal, a bad company
      id, an unknown file and `.svg` → 404.
- [x] Both stores round-trip on a real folder and a real Garage; unsafe
      keys are rejected; a wrong S3 secret is refused.
- [x] Config: cloud without `S3_ENDPOINT` fails; a partial S3 config lists
      every missing value; desktop media defaults beside the database.

**Verification performed (2026-09-29):**
- `go build ./... && go vet ./...` clean; `TEST_DATABASE_URL=…
  TEST_S3_ENDPOINT=… go test -count=1 ./...` → every package passes;
  settings subtests confirmed on both engines.
- `pnpm build` and `pnpm generate` pass.
- Browser pane against the new backend (desktop mode, local media): the
  blue preset applies live (`--primary #2563eb`, white text, dark
  `#5182ef`) and survives a reload; the slate preset gets a visible dark
  variant; pale yellow shows the 1.2:1 warning; an invalid hex disables
  saving; a PNG logo uploads and loads in the header cross-origin; KES
  with 2 decimals saves and `/me` follows; the EFD key shows as saved and
  is absent from the response; the Hardware tab shows only receipt
  options in a browser; light, dark and 375 px (the tab row now scrolls).
- Found and fixed while checking: the first contrast warning could never
  fire (auto-picked text is always ≥ 4.58:1), so it now compares the brand
  against the page background; near-black brands were invisible in dark
  mode; the settings tab row was clipped on phones; the slate swatch
  vanished on the dark background.

**For the deploy round:** `/opt/balce/.env.prod` needs `S3_ENDPOINT=http://garage:3900`
and `S3_BUCKET=balce-media`; the access key and secret are already there.

---

## Phase 3: products and catalog

**Tables:** `products` (parent/variant, price/cost/wholesale in minor
units, `image_key`, `metadata`, `is_active`), `barcodes`, `price_history`,
`product_addons`, `catalog_products` (platform-wide), `shop_stock` and
`stock_movements` (the stock core Phase 4 builds on).

**Merged:** balceinv-api #11 (schema), #12 (media + stock core), #13
(products API), #14 (catalog + team tools), #15 (restore), #16 (error
message case); balceinv #3 (products page).

- [x] List: paginated (`limit`/`offset`, total); search by name, SKU or
      exact barcode; category filter; `include_archived`. One count, one
      page query with the active shop's stock joined in, one barcode
      batch query.
- [x] Delete archives the product and its variants (`is_active = false`);
      `POST /api/products/:id/restore` brings both back. Nothing is ever
      hard-deleted, so a product that has sold keeps its history.
- [x] Excel/CSV import: every row checked first (header aliases, messy
      money like `TSh 1,500` or `3000/=`, the company's currency
      decimals); any problem → 422 `import_rejected` with
      `{row, column, problem}` and nothing saved; a clean file imports in
      the request transaction with opening stock movements.
- [x] Template downloads in the browser and in Tauri; the success toast
      fires only after the file is saved (`utils/download.ts`, shared
      with the catalog template and JSON export).
- [x] Price changes write `price_history` in the same transaction.
- [x] Images: ≤ 2 MB, type sniffed from the bytes, stored under
      `products/<company>/…`, served from `/api/media/products/…`.
- [x] Add-ons per product (unique name per product, on/off, delete).
- [x] Common products (`internal/catalog`): `GET /api/catalog` returns the
      list for the company's business type; prices are whole currency
      units. Team tools (`/api/catalog/team/{summary,items,template,
      import}`, `DELETE /api/catalog/team`) need sign-in plus
      `X-Support-Passcode` (SHA-256 in `BALCE_SUPPORT_PASSCODE_HASH` or
      compiled in; 5 wrong tries lock for a minute; 503 when unset).
      Merge or replace; bad rows are skipped and listed; 422 when no row
      is usable. Saved in batched upserts of 500.
- [x] Seed lists moved to `internal/catalog/seeds`; empty lists are
      filled from them at startup (the shipped files are still empty).
- [x] One spreadsheet reader (`internal/common/spreadsheet`) for both
      imports: .xlsx, CSV with BOM, semicolon CSV.
- [x] Error messages are capitalised once in `response.Error`, so every
      toast reads as a sentence.
- [x] Frontend: products page rebuilt (server paging and search, category
      filter, show archived, create / edit / add variant / archive /
      restore, photo upload, barcodes with pack size, extra details,
      add-ons tab, details dialog showing every field, import dialog with
      the problem table). Catalog picker and team tools on the new API;
      `formatShillings` gone from them. `/products` is ported and is the
      home page for anyone who can view products.
- [ ] Phone photo upload by QR: the session routes were not carried over;
      they return with LAN mode in Phase 7.
- [ ] Stock value and low-stock cards: dropped from the products page
      until Phase 4 adds server-side totals (a page-only sum would lie).

**Edge-case tests** (SQLite and Postgres as a non-superuser):
- [x] The same SKU in two companies is fine; within one company (any
      case) → 409; a barcode taken in the company → 409 and no product is
      left behind.
- [x] A variant whose parent belongs to another company → 404; a variant
      of a variant or without a label → 400.
- [x] Negative price → 400; zero price is allowed; nested metadata and a
      repeated barcode → 400.
- [x] 1,000-row import completes with 3,000 units of opening stock; one
      bad row → nothing imported and rows 3–7 reported by column; wrong
      type, no price column, header only → 400.
- [x] Listing 25 of 200 products runs ≤ 3 queries.
- [x] Archive hides the product and its variants; restore brings both
      back; every product route answers 404 to another company.
- [x] Oversell: parallel sales of 1 unit against stock 5 → exactly 5
      succeed on both engines.
- [x] Catalog: messy sheet parsing (6 rows read, 2 kept, problems on rows
      5, 6, 7, 9), price parsing (`99.5` → 100, `free`/`NaN`/`1e20`/`-5`
      rejected), seeding only fills empty valid lists, merge vs replace
      counts, template round trip, another business type never leaks into
      a company's list, a rejected replace leaves the list untouched,
      1,200 rows across batches, company list ≤ 6 queries, wrong passcode
      403, signed out 401, sixth guess locked out even with the right
      passcode.
- [ ] Archiving a product that has sold: re-checked in Phase 5 once sales
      exist (delete already never removes rows).

**Verification performed (2026-09-29):**
- `go build ./... && go vet ./internal/... ./cmd/...` clean;
  `TEST_DATABASE_URL=… go test -count=1 ./internal/... ./cmd/...` → every
  package passes, catalog subtests confirmed on sqlite and postgres.
- `pnpm build` passes.
- Browser pane against the new backend (desktop mode, fresh database,
  catalog imported through the team API with a test passcode): picking
  "Sugar 1kg" fills name, `GEN-` SKU, category, unit, price and the Brand
  detail; the product saves with 20 kg opening stock; edit changes the
  price and adds a barcode while metadata and stock stay; an add-on is
  added and switched off (saved `is_active: false`); a 1-litre variant is
  created and the parent shows the variant badge; archive hides it,
  "Show archived" shows it dimmed, restore brings it and its variant
  back; a broken CSV shows three problems by row and column and saves
  nothing; the web template download saves a 6.3 KB xlsx; exact barcode
  search finds one product; a photo uploaded through the form and one
  through the API both load as thumbnails from `/api/media`; light,
  dark and 375 px with no horizontal scroll (image and category columns
  hide on phones). No console warnings from the new components.
- Found and fixed while checking: restore through a full `PUT` would have
  left variants archived, so restore became its own endpoint; lowercase
  API messages in toasts; double page padding and wrapped stock badges
  on phones.

**Known limits:** `GET /api/catalog` returns the whole list for the
business type (at most 20,000 rows per import) and the picker searches it
in the browser; switch to server search if a list grows past that. Team
tools are opened from the desktop-only Updates tab, so the cloud catalog
has no web entry point yet; add one when the team first needs to manage
cloud lists.

---

## Phase 4: shops, stock, transfers, notifications

**Tables:** `shop_stock` (key `shop_id, product_id`), `stock_movements`
(reason is one of `opening`, `sale`, `return`, `purchase`, `adjustment`,
`damage`, `transfer_in`, `transfer_out`), `stock_transfers` +
`stock_transfer_items`, `notifications` (`low_stock` / `out_of_stock` per
shop and product). Forced RLS on all of them in Postgres.

**Merged:** balceinv-api #17 (schema), #18 (shops), #19 (stock levels,
adjustments, notifications), #20 (transfers); balceinv #4 (shops page,
switcher, shop assignment), #5 (stock page), #6 (notifications).

- [x] Every stock change is one conditional update that refuses to go
      below zero (`quantity + change >= 0 … RETURNING quantity, min_stock`)
      plus a movement row, in the request transaction.
- [x] A notification fires once when the quantity crosses its minimum or
      reaches zero on the way down; sitting below the line or going back
      up never repeats it.
- [x] Shops CRUD (`/api/shops`): unique names per company, upper-cased
      alphanumeric receipt prefix (default SALE), soft close, the last
      open shop can't be closed. Nav entry in cloud mode only.
- [x] Header shop switcher when a user works in more than one shop; it
      reloads so every page shows the new shop. User forms get a Works in
      checklist once there are two shops.
- [x] `GET /api/stock` (levels, search, `status=low|out`),
      `GET /api/stock/summary` (value at cost and at selling price, low
      and out counts), `GET /api/stock-movements` (product, reason, date
      filters), `POST /api/stock-movements` (received/returned must go up,
      damaged must go down, correction either way).
- [x] `POST /api/stock-transfers`: all items leave one shop and arrive in
      the other in one transaction (a `transfer_out`/`transfer_in` pair per
      item, reference = transfer id); list and detail endpoints.
- [x] `/api/notifications`: list (unread or all), unread count, mark one
      or all read, clear read; scoped to the active shop.
- [x] Stock page replaces the old Stock Movements page: value cards,
      levels, history, Change stock (received / returned / damaged /
      counted with a stock-after preview), Send stock, transfer list and
      details. The products page's stock value and low-stock cards from
      Phase 3 live here now.
- [x] Header bell polls only for users with `notifications:view` and
      chimes only when the count grows after the first load; the
      notifications page has Unread / All, mark read, mark all read and
      clear read.

**Edge-case tests** (SQLite and Postgres as a non-superuser):
- [x] An adjustment below zero → 409 and nothing written (no movement, no
      notification); wrong direction, zero, over a million, the `sale`
      reason, unknown and foreign products are refused.
- [x] Transfer to the same shop → 400; from a shop the user isn't
      assigned to → 403 `shop_not_assigned`; closed, foreign or unknown
      shops and products → 404; duplicates, empty lists and zero
      quantities → 400; one short item refuses the whole transfer and
      writes nothing.
- [x] 10 parallel sales of 1 unit against stock 5 → exactly 5 succeed, on
      both engines (from Phase 3's stock core).
- [x] Invariant: the sum of movements equals `shop_stock.quantity` for
      every product after a mixed run of openings, purchases, damage and
      transfers across two shops.
- [x] A 10→7→5→4→14→0 run creates exactly one low and one out
      notification; the unit test covers every crossing case.
- [x] Levels and history pages run ≤ 2 queries; the summary agrees with
      the filters; a new branch starts empty; cashiers get 403 on every
      stock and notification route; another company gets 404.
- [x] Shops: validation, rename, close/reopen, last open shop → 409,
      cross-company 404, cashier 403, the owner sees every open shop.
- [x] Schema: same-shop and cross-company transfers, cross-company items
      and unknown notification kinds are refused by the database; the
      three new tables join the no-tenant RLS check.

**Verification performed (2026-09-29):**
- `go vet ./internal/... ./cmd/...` clean; `TEST_DATABASE_URL=… go test
  -count=1 ./internal/... ./cmd/...` → every package passes, the new
  shops, stock and transfer subtests confirmed on sqlite and postgres.
- `pnpm build` passes on each frontend branch.
- The Phase 3 preview database upgraded from v13 to v16 on start, with its
  pre-migration copy written beside it.
- Browser against the new backend (desktop mode): the value cards match
  the data (112,500 at cost, 166,200 at selling price); damaging the last
  3 Fanta wrote the movement with its note and one out-of-stock notice; a
  branch was added through the Shops page (prefix `kko` saved as `KKO`);
  the switcher appeared; sending 10 Coca Cola and 5 Sugar worked while 25
  Sugar was caught before sending; the transfer list and details were
  right; after switching, the branch showed 10 + 5 units (22,000 at
  cost) and an empty notification list; Main showed the Fanta notice
  with a badge of 1, mark read cleared it and clear read emptied the
  list; the user form's Works in checklist toggles. No console errors;
  no horizontal scroll at 375 px on /stock, /shops and /notifications.
- The browser pane was hidden during this run, so it was driven through
  the DOM and no screenshots were taken; dialogs stayed in the DOM as
  `data-state=closed` because exit animations don't run without frames.
- Found and fixed while building: Postgres can't infer the type of an
  unused `$n IS NULL` parameter, so optional movement filters are added
  to the SQL only when set, and mark-read is two plain queries.

**Known limits:** the Send stock destinations come from the user's own
shops (an owner sees every open shop; a keeper only the shops they work
in). Closing a shop checks the open count without a lock, so two owners
closing the last two shops at the same moment could leave none open;
reopening either fixes it. Revisit if that ever happens.

---

## Phase 5: discounts and sales (POS)

**Tables:** `discounts` (percent in basis points 1–10000 or a fixed amount
off each unit, one product or every product, `starts_at`–`ends_at`),
`sales` (`client_ref` unique per company, receipt number unique per shop,
subtotal, discount, total, tax, paid, change, currency and tax rate
snapshotted; the database checks `total = subtotal − discount` and
`paid = total + change`), `sale_items` (name, SKU, unit price and **unit
cost** snapshotted; line total checked), `sale_item_addons`,
`sale_payments` (cash / card / mobile). Forced RLS on all five.

**Merged:** balceinv-api #21 (schema), #22 (discounts), #23 (sales),
#24 (currency lock), #25 (product lookup); balceinv #7 (discounts page),
#8 (till, sales history, receipts).

**The rounding rule:** prices include tax. Tax on a sale is
`round_half_up(total × r ÷ (10000 + r))` with `r` in basis points,
computed once on the sale total in minor units (big integers, so large
amounts can't overflow). Percent discounts are
`round_half_up(unit_price × quantity × bps ÷ 10000)` per line; fixed
discounts take `min(amount, unit_price)` off each unit. Only the single
best running discount applies to a line (a product-specific one wins a
tie), never on a wholesale-priced line and never on add-ons.

- [x] `POST /api/sales` recomputes every price, discount and tax from the
      database and ignores anything price-like the client sends; takes the
      receipt number from the shop counter (`{SHOP}-{DATE}-{COUNTER}`, date
      in the company's timezone); inserts the sale, items, add-ons and
      payments, moves stock and raises alerts, all in one transaction.
- [x] Replaying the same `client_ref` and body returns the original sale
      (201, same receipt); the same reference with a different body → 409
      `client_ref_reused`; a racing duplicate → 409 `client_ref_in_flight`.
- [x] `POST /api/sales/quote` gives the till the server's own totals, so
      pricing lives in one place.
- [x] Split payments; change only from cash; card and mobile money can't
      exceed what is owed.
- [x] Browser receipt page (`/receipts/:id`, 58 or 80 mm, English or
      Swahili labels, `?print=1` prints on open) for LAN tills and cloud.
      The desktop serial print path moves to Phase 7 with the rest of the
      desktop work.
- [x] The till generates the checkout reference with
      `crypto.randomUUID()`, falling back to `crypto.getRandomValues`
      because plain-HTTP LAN tills have no `randomUUID`. The reference is
      kept until the sale lands and reset whenever the cart changes.
- [x] Currency locked after the first sale (409 `currency_locked`); the
      receipt format must contain `{COUNTER}`.
- [x] `GET /api/products/lookup?code=` finds any product or variant by
      barcode or SKU with the barcode's pack size (the list only returns
      parents, so variants couldn't be scanned before).
- [x] Discounts page, new till (grid, scan box, variant and add-on
      pickers, three held carts per shop, payment dialog), sales history
      with totals and reprint. Sellers land on the till after sign-in.
- [ ] Left out on purpose, add when asked: a cashier's manual discount on a
      line (needs its own permission and audit) and forcing retail on a
      wholesale-sized line. The numpad, customer display and EFD
      submission landed in Phase 5b.

**Edge-case tests** (SQLite and Postgres as a non-superuser):
- [x] Replay the same body → same sale, stock decremented once; same
      `client_ref` with a different body → 409.
- [x] Insufficient stock on the second line → 409 and nothing written (no
      sale, no movement, the receipt counter not used: the next sale is
      0002).
- [x] A tampered client price, line total or sale total is ignored.
- [x] Expired and stopped discounts are not applied; a running product
      discount is.
- [x] Wholesale applies at `wholesale_min` and not one below (unit and
      HTTP).
- [x] Rounding: 1-unit items, 12.5% off and 18% tax on awkward totals
      match the rule; a fixed discount larger than the price stops at zero;
      amounts up to 10^17 don't overflow.
- [x] Cash below the total, no payment, card above the total and the same
      method twice → 400.
- [x] 20 concurrent sales get receipt counters 0001–0020 with no gaps and
      leave the right stock, on both engines.
- [x] Another company's product, or another product's add-on, in the cart
      → 404 and nothing written.
- [x] Changing the currency (code or decimals) after the first sale → 409;
      other settings still save.
- [x] A cashier with only `sales:create` can sell and print the receipt
      but not list sales; another company gets 404 on every sale route.
- [x] The sum of movements still equals `shop_stock` after sales.

**Verification performed (2026-09-29):**
- `go vet` clean; `TEST_DATABASE_URL=… go test -count=1 ./internal/...`
  → every package passes, sales, discounts and lookup subtests confirmed
  on sqlite and postgres.
- `pnpm build` passes.
- The Phase 4 preview database upgraded to v20 on start; its receipt
  format moved to `{SHOP}-{DATE}-{COUNTER}`.
- Browser against the new backend (pane hidden, driven through the DOM):
  a 10% Sugar discount created through the form showed as Running;
  at the till, Sugar's barcode was scanned and the 1-litre Coca Cola
  picked from the variant dialog; the server quote showed the discount;
  the payment dialog offered Exact / 12,000 / 15,000 / 20,000; 20,000 cash
  on 11,520 gave 8,480 change and receipt `SALE-20260929-0001`; the
  receipt page rendered at 80 mm with the discount, 1,757 VAT included,
  payment and change; stock dropped by 3 and the cart emptied; sales
  history showed the same totals and details. At 375 px the till uses a
  bottom bar and a cart sheet with no sideways scroll. No console errors.
- Found and fixed while building: the till couldn't scan variants (added
  the lookup endpoint); `randomUUID` is missing on plain-HTTP LAN tills
  (added the fallback); sign-in sent sellers to Products (now the till,
  based on `sales:create`).

**Known limits:** the checkout reference lives in the browser's storage,
so a till that loses its storage mid-retry could record a second sale;
the receipt page relies on the browser's print dialog until Phase 7 wires
the serial printer.

---

## Phase 5b: till redesign and till extras

Feedback on Phase 5: the cart felt slow, cramped and not thought
through. Asked for: a redesign, plus the on-screen number pad, the customer
display and EFD submission, each switched on only where needed.

- [x] Till redesign (`pages/pos/index.vue`, `components/pos/CartPanel.vue`,
      `ProductGrid.vue`, `composables/useTillQuote.ts`): totals show at
      once from the last quote (dimmed until confirmed); out-of-order quote
      answers are ignored; Pay waits for the confirmed total; compact tiles
      with stock and tap feedback; "Show more" past 50 products; cart beside
      the products from 768 px; F2 / F9 / Esc; the scan box gets focus back
      after each add on mouse and keyboard tills; notes; clearing a cart has
      Undo.
- [x] Switches `till_numpad_enabled` and `customer_display_enabled`
      (migration 000021, off by default) in Settings → Hardware → Till
      extras; `GET /api/sales/till` gives sellers the switches plus
      `efd_enabled` and `print_receipt_automatically`.
- [x] Number pad (`components/pos/NumberPad.vue`): set a selected line's
      quantity, or type a number and tap or scan a product to add that
      many; the payment screen's keypad types into the chosen method.
- [x] Customer display (`pages/display/index.vue`,
      `composables/useCustomerDisplay.ts`): a second window (a Tauri
      window on desktop; `core:webview:allow-create-webview-window` added
      to `src-tauri/capabilities/default.json`) showing the lines, savings
      and total, then paid and change, then a welcome screen. It follows
      the till through BroadcastChannel, the `storage` event and a 1 s poll.
      No sign-in; it only shows what this browser's till published.
- [x] EFD (backend `internal/sales/fiscal*.go`, migrations 000022–000023):
      while EFD is on, each sale is queued in `fiscal_receipts` in the sale's
      transaction; `POST /api/sales/:id/fiscal` and
      `POST /api/sales/fiscal/send-waiting` post it as JSON with
      `Authorization: Bearer <key>` and `Idempotency-Key: <sale id>` outside
      the request transaction (short claim → HTTP → short record), so a slow
      EFD never holds the SQLite writer. A claim makes delivery happen once;
      a `sending` row is reclaimable after 2 minutes. A 2xx answer may return
      `verification_code` and an https `verification_url`. The till sends
      after each sale, on opening and every 5 minutes; Sales History filters,
      shows and resends; receipts print the code and a QR code. Turning EFD
      on without an address and key is refused.
- [x] "Print automatically after sale" now works at the till; receipts
      print the note; EFD can be switched off (its Save button used to
      disappear with the form); the logo no longer covers the shop switcher
      on phones.

**Edge-case tests** (SQLite and Postgres as a non-superuser):
- [x] Till switches default off, a cashier sees the owner's change, 403
      without `sales:create`, switching one off leaves the other.
- [x] A sale made while EFD was off is never sent (409).
- [x] EFD refusing (503) or unreachable leaves the sale saved and the
      receipt `failed` with a readable error, listed by `?fiscal=waiting`;
      send-waiting then clears the list.
- [x] A sent receipt is not sent again; five tills sending the same sale
      at once reach the EFD once.
- [x] The EFD key never appears in any response; another company can't
      send the receipt; `fiscal_receipts` is in the tenant isolation test.
- [x] Turning EFD on without a key → 400.

**Verification performed (2026-09-29):**
- `go vet` clean; `TEST_DATABASE_URL=… go test -count=1 ./...` → every
  package passes; the EFD test also passes under `-race` on both engines.
- `pnpm build` passes.
- Browser at 1366, 820 and 375 px against the local backend (upgraded to
  v23 on start):
  - **Cart:** adding Sugar showed the discounted total at once. Pushing
    it past stock showed "Only 5 kg left" and blocked Pay and F9. Changing
    a quantity and pressing F9 in the same moment opened payment with the
    right total in 24 ms. Clear then Undo restored the cart.
  - **Till extras switched on in Settings:** "tap a line, 2, Set" made
    the quantity 2. "3, then Coca Cola, Standard" added 3. The payment
    keypad typed 20000; change 10,520, receipt `KKO-20260929-0001`.
  - **Customer display** in a second tab showed the two lines, "You save
    TZS 720" and TZS 9,480, then Paid 20,000 / Change 10,520, then idle
    after Next sale.
  - **EFD pointed at an unreachable https address:** the sale completed
    and showed "EFD failed / Try again". Sales History showed the badge,
    the "Waiting for EFD" filter, and the error with 1 attempt. The
    receipt said "EFD receipt to follow". EFD was switched off again from
    Settings.
- Found and fixed while verifying: Pay pressed during a reprice did
  nothing (it now settles the quote first); the EFD card couldn't save
  "off".

**Known limits:** the EFD payload is Balce's own JSON contract. A direct
TRA VFD connection (signed XML, registration and token) or a specific EFD
box needs that provider's spec or a small adapter that accepts this JSON.
The customer display follows a till in the same browser or desktop app,
not a separate tablet.

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
- [ ] `release.yml` ldflags point at
      `internal/config.CompiledSupportPasscodeHash` (the old
      `config.CompiledSupportPasscodeHash` goes with the old code).
- [ ] Unused frontend dependencies removed after a grep proves them unused
      (`@libsql/client`, `drizzle-orm`, `drizzle.config.ts`, `pg`,
      `puppeteer-core`, `@sparticuz/chromium`, `jsonwebtoken`, `bcryptjs`,
      `@iconify/vue` once `ModeToggle.vue` is gone).
- [ ] Dead components deleted: `AppSidebar.vue` and `ModeToggle.vue`
      (neither is used).
- [ ] The "hidden until ported" nav list is deleted.
- [ ] `CLAUDE.md` stack section updated (database/sql + pgx/modernc, no
      GORM, the new layout).
- [ ] Full regression on both engines; `/security-review` on the branch; a
      macOS Tauri build; a Windows build checked manually.

**Verification performed:** _pending_

## Manual follow-up required
_Collected from the phases above as they complete._

- **Phase 5b, till extras on real hardware:**
  - **Touch till:** use the number pad with fingers and check the keys
    are big enough and nothing covers the cart.
  - **Customer screen, web:** plug in a second monitor, press "Customer
    screen", drag the window to it and press F11. It must follow the till
    within a second and show Paid/Change after the sale.
  - **Customer screen, desktop app:** in a Tauri build, the same button
    must open a separate window, and a second press must focus it instead
    of opening another.
  - **EFD:** once the client has their EFD provider's address and key,
    make one sale and confirm the provider received it. The receipt must
    print the verification code and a QR code that opens the verification
    page on a phone.

- **Phase 5, a real printer and till:** print a receipt from a LAN till
  (a second computer or phone on the same network) and from the cloud on
  an 80 mm thermal printer through the browser dialog; check the width,
  the logo and that nothing is cut off. Scan a real barcode with a USB
  scanner at the till and confirm one scan adds one item.

- **Phase 4, look and feel:** the pane was hidden during verification, so
  open /stock, /shops and /notifications in light and dark at phone and
  desktop width and check spacing, badges and the Change stock / Send
  stock dialogs by eye.

- **Phase 3, desktop app (needs a Tauri build of `cmd/server` with
  `BALCE_SUPPORT_PASSCODE_HASH` or the compiled hash set):** in Settings →
  Updates, tap the version seven times, enter the team passcode, import a
  common-products sheet, then open Products → Add product and check the
  picker lists it. Also click Template on the products page and in team
  tools: a native save dialog must open and the saved `.xlsx` must open
  in Excel. The browser path is verified; the Tauri save dialog is not.
