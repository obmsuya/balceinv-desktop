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
- [x] Rebooted with the owner's go-ahead (2026-09-29 15:37 UTC, after 318
      days up): 6.14.0-27 → 6.14.0-37 with the new libc; the -27 kernel
      stays as a fallback. A fresh `backup.sh` dump was taken first.
      SSH came back in about 30 s, and every container restarted on its own.
      Checked after the reboot:
      - Postgres and Garage report healthy; faltasi answers 200 locally
        and through Cloudflare.
      - ufw rules, swap (1 GB, swappiness 10), fwupd off and the backup
        cron are unchanged.
      - Seen from the Mac, only 22, 80 and 443 are open; 5432, 6379,
        8000, 8001 and 3900 stay closed.
      - Nothing is left in `/var/run/reboot-required`.
- [x] Upgraded Ubuntu 25.04 → **26.04.1 LTS** (2026-09-29, 17:53–18:08
      UTC), without a provider snapshot by the owner's decision. Taken first,
      in `/root/pre-upgrade-20260929-1751/` (root only, `600`):
      - a `backup.sh` dump of Balce;
      - a `pg_dumpall` of faltasi;
      - a tarball of `/etc`;
      - the package list.
      `do-release-upgrade` ran non-interactively inside `tmux` and went
      straight from 25.04 to 26.04 (exit 0). Old config files were kept.
      - SSH refused connections for about 5 minutes while the upgrade
        moved it to socket activation (`ssh.socket`). faltasi stayed up
        the whole time.
      - The upgrader disabled the Docker repo. It is now
        `/etc/apt/sources.list.d/docker.sources` on `resolute`, and the
        old `docker.list` is saved in the pre-upgrade folder. Docker went
        29.2.1 → 29.8.1 and Compose → 5.5.1.
      - Rebooted onto kernel 7.0.0-34; 6.14.0-37 stays as a fallback.
        SSH came back in about 40 s, and every container restarted on
        its own.

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

**Verification performed (OS upgrade, 2026-09-29):**
- `lsb_release -ds` → Ubuntu 26.04.1 LTS; `uname -r` → 7.0.0-34-generic.
- `docker ps`: all 8 containers up; Postgres, Garage and both Woodpecker
  containers healthy. `systemctl --failed` is empty and nothing is left in
  `/var/run/reboot-required`.
- faltasi `/health` → 200, both locally and through Cloudflare.
- `backup.sh` → new dump; `restore-drill.sh` → "row counts match".
- `sshd -T`: password login is still on (the owner's decision) and so is
  root login; ufw is unchanged (`limit 22`, allow 80 and 443).
- Swap 1 GB with `vm.swappiness` 10, fwupd still masked, the backup cron
  in `/etc/cron.d/balce-backup` unchanged, and unattended upgrades still
  security-only with no automatic reboot.
- Port scan from the Mac: 22, 80 and 443 open; 1022 (the upgrader's
  spare SSH), 3900, 3901, 3903, 5432, 6379, 8000 and 8001 closed.
- The pre-upgrade folder can be deleted after a week of normal running.

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

- [x] Six report routes plus `/api/dashboard` as SQL aggregates
      (`internal/reports`): `summary`, `daily`, `products`
      (`sort=revenue|quantity|profit`), `cashiers`, `shops`, `inventory`.
      All need `reports:view`. `shop` is empty (active shop), `all`, or an
      id; non-owners only reach their assigned shops (`all` = theirs,
      another shop → 403).
- [x] Days are company-local (`companies.timezone`): Go cuts each local day
      into UTC bounds and the query joins them as a `VALUES` list. The
      dialect helper is a `CAST(... AS TIMESTAMPTZ)` for Postgres only, so
      one SQL text runs on both engines, DST included. Ranges default to the
      last 30 days, at most 366.
- [x] Profit = total − tax − Σ `unit_cost` × quantity from the snapshots;
      cash takings are net of change. Per-product profit removes tax line by
      line, so it can differ from the overview by a few units (said on the
      page).
- [x] Stock totals match the Stock page: every active product in each open
      shop in scope, a missing stock row counting as out. "Not selling" lists
      stock unsold for `dead_stock_days`, most money tied up first.
- [x] Exports: Excel built client-side with `xlsx` (Summary, Days,
      Products, Staff, Shops) and saved through `saveFile` (Tauri dialog on
      desktop); PDF through the print dialog, with the header, sidebar and
      footer hidden when printing. No backend export routes.
- [x] Dashboard page: today against yesterday, profit, month to date,
      stock alerts, 14-day chart, best sellers, latest sales, This shop / All
      shops, and a refresh every minute while the tab is visible.
- [x] Exchange rates (asked for with Phase 6): `GET /api/exchange-rates`
      (any signed-in user) returns the company currency against USD, EUR,
      GBP, KES, UGX, RWF, CNY, AED, INR and ZAR.
      - **Source:** ExchangeRate-API's free endpoint, no key, credited on
        the card. One USD-based fetch serves every company through cross
        rates.
      - **Storage:** kept in `exchange_rate_snapshots` (migration 000024)
        so an offline desktop keeps its last rates.
      - **Refresh:** after 6 hours, the old rates are served at once
        (`is_stale`) while one background refresh runs, with a 5 s timeout
        and a 5-minute pause after a failure.
      - **Failures** answer `available: false` with a readable reason and
        never error: no first fetch, a captive portal or garbage answer, a
        provider error, or a currency with no rates.

**Edge-case tests** (SQLite and Postgres as a non-superuser):
- [x] A seeded dataset gives exact totals, tax, cost, profit, margin,
      average and payments.
- [x] Changing a product's cost after a sale leaves past profit unchanged.
- [x] An empty range returns zeros and empty lists, never nulls, with one
      row per day.
- [x] A sale at 23:30 UTC and one at exactly 21:00 UTC count on the next
      local day in Dar es Salaam; bad and over-long ranges → 400.
- [x] The query count for all seven endpoints is the same with 10 and 150
      sales. 150 rather than 10,000, to keep the suite fast; the count does
      not depend on rows.
- [x] Shop filter, manager scope (403 for another shop, `all` = their
      shops), a cashier without `reports:view` → 403; another company's shop
      → 404 and their "all" totals 0; stock over all shops and one shop.
- [x] Exchange rates: provider down, garbage or error → unavailable; a fresh
      fetch is cached (one provider call for two reads); stale plus offline
      still serves the old rates; recovery once the provider is back; a KES
      company; an unlisted currency; sign-in required.

**Verification performed (2026-09-29):**
- `go vet ./...` clean; `TEST_DATABASE_URL=… go test -count=1 ./...` →
  every package passes; the rates test also passes under `-race`.
- `pnpm build` passes.
- The live provider was checked with `curl` (TZS and an unsupported code)
  before choosing it.
- Browser against the local backend (upgraded to v24 on start):
  - **Dashboard:** live rates (1 USD = 2,646.72 TZS, updated
    29 Sep 03:02). Today 12,720 in 2 sales, month to date, stock alerts,
    the 14-day chart, best sellers and latest sales matched the data.
  - **Reports:** Products ranked by sales, then by quantity. Per-product
    profit −764 + 442 against −320 overall, which is the rounding
    explained on the page. Staff 2 sales / 6,360 average. Stock showed
    3 out, counting products never stocked in this shop. All shops showed
    Kariakoo 12,720 and Main Shop 11,520.
  - **Excel:** saved a 22 KB workbook.
  - **Phone width (375 px):** no sideways scroll on the dashboard or
    reports.
- Found and fixed while verifying: stock totals ignored products with no
  stock row (now counted as out, like the Stock page); the test harness's
  `Items()` only reads paged lists, which made two assertions pass
  vacuously until the tests read the array directly.

**Known limits:** reports use the snapshots on each sale line, so returns and
refunds (not built yet) will need their own lines before profit accounts for
them. The rate list is fixed in code. Printing covers the tab being viewed,
not all tabs.

---

## Phase 7: desktop specifics and LAN

The new server now runs the desktop features. The release workflow still
builds the old `main.go` sidecar until the Phase 9 switch-over.

- [x] **Backups** (`internal/backup`):
  - `VACUUM INTO` → gzip, 7 dailies in `<data dir>/backups`, and an
    automatic run every 6 h. Cloud backups via the licensing server are
    unchanged.
  - Restores are staged to `<db>.restore` only after a check: SQLite
    header, `quick_check`, new format (`schema_migrations` + `companies`),
    not dirty, not newer than the app. They are applied at the next start
    before migrations.
  - The old database is kept as `.before-restore` and a `before-restore`
    backup is written first; a failed swap puts the files back.
  - These routes run outside the request transaction (the SQLite writer
    has one connection). Restore and file export/import are owner-only.
  - The existing backup panel is back under Settings → Backups.
- [x] **License**, unchanged, desktop only (`internal/licensing` over the
      root `license` package): the same routes and response shapes; a 402
      lock on `/api/*` except sign-in/out, setup, platform and license
      routes; the trial starts on first setup; the tamper-check timestamp
      and licensing sync timers run. `BALCE_LICENSE_CHECK=off` exists for
      developers only.
- [x] **Serial printing**, desktop only (`internal/printing`):
  - The ESC/POS receipt is built from the same receipt data as the browser
    receipt: en/sw labels, company timezone, currency decimals, the logo
    from storage, the EFD code, 32/48 columns.
  - Routes: `status`, `devices` (the port self-check), `test` (prints the
    width and column count), `receipt` (with drawer kick).
  - At the till, the desktop app prints to the receipt printer and falls
    back to the browser if the printer fails.
- [x] **LAN:**
  - Settings → Network switch, saved in `network.json`; the listener
    restarts in-process between `127.0.0.1:8080` and `0.0.0.0:8080`. If
    listening on the network fails, the switch turns itself off.
  - `/api/platform` reports `lan_available`, `lan_enabled`,
    `listen_address` and `lan_urls` (the routed address first; virtual and
    bridge adapters are left out). The screen shows QR codes and setup
    steps.
  - Go serves `BALCE_STATIC_DIR` with an `index.html` fallback, never for
    `/api/*`.
  - Tauri now bundles `frontend/.output/public` as a resource and passes
    its path to the sidecar as `BALCE_STATIC_DIR`.
- [x] **Phone photos:** `POST /api/phone-uploads` makes a 5-minute,
      single-use link; `/upload/:token` is a bilingual camera page; the
      photo must be a real JPEG, PNG or WebP of at most 2 MB. "Use phone" in
      the product form shows the QR code and uses the photo once it arrives.

**Edge-case tests** (SQLite; Postgres checks that the desktop routes are
absent in cloud):
- [x] Backup → second sale → staged restore → restart simulation: every
      table's row count matches the backup; the replaced database is kept;
      the restore isn't applied twice.
- [x] Refused restores: non-owner, bad names, not gzip, old-format
      database, newer version, relative/missing/`.txt` paths. Cloud listing
      without a paid license → 402.
- [x] The static fallback serves `index.html` for deep links, never for
      `/api/*`; missing assets get 404; `../` can't escape the folder.
- [x] LAN off → a listener answers on `127.0.0.1` but not on this machine's
      network address; LAN on → it answers there. An explicit `LISTEN_ADDR`
      wins.
- [x] License: missing → locked with 402 while status, hardware ID,
      platform and health stay open; setup starts a trial; expired → 402
      but sign-out works; the lock is on by default and off with the flag.
- [x] Printing to a file standing in for the port: off/no port → 409,
      unplugged → 502, the receipt bytes land, test slip 58 mm/32 columns,
      a cashier can't run a test print.
- [x] Phone photos: sign-in and permission to create links; unreachable
      when LAN is off; non-images, disguised files and 3 MB refused; a
      second photo refused; another company can't collect; collected once;
      expired after 5 minutes.

**Verification performed (2026-09-29):**
- **Automated:** `go vet` clean; `TEST_DATABASE_URL=… go test -count=1
  ./internal/...` → every package passes. `pnpm build` and `pnpm generate`
  pass. `cargo check` in `src-tauri` passes with the resource and env
  change.
- **Browser, against the new server serving the generated app:** the
  preview ran with an isolated `HOME`, so the real app data and license on
  this Mac were never touched.
  - Switching LAN on moved the listener to `0.0.0.0:8080` in about 0.4 s
    and listed `http://192.168.1.3:8080`. The OrbStack bridges were listed
    too, which led to the virtual-adapter filter.
  - Opened at `http://192.168.1.3:8080` as another device: sign-in and a
    sale worked (`KKO-20260929-0003`); the receipt opened in the browser;
    `/receipts/<id>` deep links loaded the app.
  - The phone page loaded at the LAN link; a photo posted to it became the
    new product's preview through "Use phone".
  - Switching LAN off: `curl` to `192.168.1.3:8080` failed, while
    `127.0.0.1` answered.

**Known limits:**
- Phone photo sessions live in memory and are lost if the network switch
  restarts the listener mid-upload.
- The Network and Backups tabs only show in the desktop app, so they were
  checked through the API here, not on screen.
- The release still ships the old sidecar until Phase 9.

---

## Phase 8: languages (en, sw)

- [x] `app/utils/translate.ts` (pure) and `app/utils/i18n.ts` provide:
      - `t(key, params)` over JSON dictionaries in `app/locales/<lang>/<area>.json`
        (22 areas, 1,459 keys in each language), with `{one, other}` plurals;
      - `translateIn(locale, key)` for receipts;
      - `Intl` formatting (`en-TZ` / `sw-TZ`) for money, dates, numbers and "5 min ago".
- [x] Language choice, in order: the person's own language
      (`PUT /api/auth/language`, `users.locale`), then the business language
      (`default_locale`), then English.
      - A choice made on the sign-in page is kept in `localStorage`.
      - Someone with no saved language keeps the pick they made before signing in,
        and it is saved to their account.
- [x] A language button in the header on tablets and computers. On phones it
      is in the account menu, together with the theme.
- [x] API errors are translated by their `code` (`errors.json`, 60 codes). In
      English the server's own message is shown; in Swahili the code's translation,
      or else the screen's own "Imeshindwa …" message, never English.
- [x] Every page and composable uses `t()`. Nothing translated is frozen at
      load time, so switching language updates the page (and charts) without a reload.
- [x] Receipts:
      - Browser receipts follow `settings.receipt_language` through
        `translateIn`.
      - Desktop serial receipts use the matching label map in
        `internal/printing/receipt.go`.
      - Both controls are new on Settings → Business → Language.
- [x] `app/locales/glossary.md` fixes the Swahili terms. Notification is
      **taarifa** (never "arifa"); also stoku, taslimu, chenji, keshia,
      msimbopau, changanua (scan), tendua (undo), lipia upya (renew) and
      makusanyo (takings). `scripts/locales.check.ts` refuses the banned words.

**Edge-case tests:**
- [x] A missing key falls back to English, and a key missing everywhere shows
      the key, never a blank: asserted in `scripts/locales.check.ts`.
- [x] Switching language updates the page without a reload (browser: the
      dashboard switched from Swahili to English in place, with one navigation entry).
- [x] Swahili strings don't break the layout at 375 px:
      - dashboard, POS, products, stock, sales, reports, settings, users,
        roles and notifications all have `scrollWidth` = viewport and no
        English text left;
      - the header was fixed on the way (the account button ran off the edge
        and the shop switcher overlapped the menu button).

**Verification performed (2026-09-29):**
- Backend: `go test ./...` (SQLite and Postgres) and `go vet ./...` pass;
  `TestEachUserChoosesTheirOwnLanguage` covers saving, isolation between
  users, refusing `fr`, and `null` for the company default.
- Frontend: `node scripts/locales.check.ts` passes, checking:
  - the same keys and placeholders in both languages, with no empty values;
  - no banned words;
  - every `t('…')` key and error fallback in the app exists.
  `node scripts/mobileMoney.check.ts`, `pnpm build` and `pnpm generate` pass.
- Every Swahili string was read through and corrected for consistency and
  noun-class agreement.
- Browser, against a local backend with an isolated data folder:
  - Kiswahili picked on the sign-in page; a wrong password showed
    "Barua pepe au nenosiri si sahihi"; the choice was kept after signing in
    and saved (`/api/auth/me` → `sw`).
  - A sale completed in Swahili (Pokea malipo → Chenji ya kurudisha TSh 4,000).
  - The receipt stayed English while the receipt language was English, then
    printed in Swahili after the switch in Settings ("Mipangilio imehifadhiwa").
  - The layout checks at 375 px listed above.
  - No console errors. A pre-existing one (the till posting to a closed
    customer-screen channel) was fixed.

**Known limits:**
- The server's English-only texts stay English in the Swahili app: the reasons
  in product-import problem tables, exchange-rate problems not in the known list,
  and plan names.
- Seeded role names ("Owner", "Cashier") are business data and are not
  translated.
- Date pickers use the browser's own format.

**Manual follow-up required:**
- In the desktop app, pick Kiswahili and print a receipt on the thermal
  printer with the receipt language set to Kiswahili. Check the wording matches
  the screen receipt.
- Ask a Swahili-speaking cashier to use the till for a day and note any word
  that reads oddly. Changes go in `app/locales/sw/*.json` and the glossary.

---

## Phase 9: switch-over and cleanup

Backend: balceinv-api PRs #35–#48. Frontend: balceinv PRs #18–#22.
Desktop: #19 (release and shell).

- [x] Tauri builds `cmd/server`. Deleted from the backend:
      - the root `main.go`, `backup/`, `config/`, `database/`, `handlers/`,
        `middleware/`, `models/`, `repository/`, `routes/`, `services/`,
        `utils/` and `cmd/seed`;
      - the GORM, glebarez/sqlite and golang-jwt dependencies;
      - the old `.env.template`.
- [x] `release.yml` builds `./cmd/server`, and its ldflags point at
      `license.LicenseSecret` and `internal/config.CompiledSupportPasscodeHash`.
      A marker build proved both values land in the binary; the old
      `config.` path sets nothing, silently. Also in `release.yml`:
      - Go comes from `backend/go.mod`.
      - The Intel Mac sidecar is really built for Intel. `macos-latest` is
        Apple Silicon, so the old "x86_64" file was an ARM binary.
- [x] Unused frontend packages removed after an import count:
      `@libsql/client`, `drizzle-orm`, `drizzle-kit`, `pg`,
      `puppeteer-core`, `@sparticuz/chromium`, `jsonwebtoken`, `bcryptjs`,
      `dotenv`, `yup`, `@tanstack/vue-form`, `tsx`, `@iconify/vue`,
      `@iconify-json/radix-icons`, three `@types`. Also deleted
      `drizzle.config.ts` and a committed `frontend/balce.db`.
- [x] Dead code deleted:
      - `AppSidebar.vue` and `SidebarSection.vue` (Phase 8);
      - `ModeToggle.vue`;
      - `admin-page.vue`, the old "Super User" page behind Ctrl+Shift+D. It
        could only fail against the new `/api/setup`.
- [x] The "hidden until ported" route list is deleted. Unknown addresses go
      to the person's home page.
- [x] `CLAUDE.md` describes the new stack (database/sql with modernc and
      pgx, migrations, the `internal/<feature>` layout, i18n) and the
      owner's no-inline-comments rule.
- [x] Full regression on both engines, a security review, and a macOS
      desktop build (`cargo build --release`, launched and driven, below).
      A Windows build is still for a person to check.

**Found and fixed during the switch-over:**
- **The backend outlived the app.** Killing the app (a crash, or
  force-quit from Task Manager) left the backend holding port 8080, so the
  next launch broke. The app now starts it with `BALCE_EXIT_WITH_PARENT=1`;
  the backend watches its stdin and shuts down cleanly when the pipe
  closes (#37, #38).
- **Old data after an update:** the new app keeps its data in
  `balce.sqlite`; the old app used `balce.db`. Setup now warns when the old
  file is on the computer, in English and Kiswahili (#36, balceinv #19).
- **The pay button was hidden from owners.** It checked the old role name
  `Admin` (balceinv #20).

**Security review (fixed):**

| Severity | Finding | Fix |
|---|---|---|
| High | Windows path traversal in the static app server (`/..\..\…\balce.sqlite`) with LAN on | #39 |
| High | License routes (hardware ID, pay) open without sign-in | #40 (+ balceinv #20) |
| Medium | DNS rebinding: any `Host` accepted, `X-Forwarded-*` trusted | #41 |
| Medium | Printer "port" could be any file or UNC path | #42 (+ balceinv #21) |
| Medium | `users:edit` could give roles or reset passwords above their own permissions | #43 |
| Medium | Cloud backup list leaked download links to `settings:view` | #44 (+ balceinv #22) |
| Medium | Sign-in held the only SQLite writer during bcrypt; no per-address limit | #45 |
| Medium (cloud) | EFD endpoint allowed SSRF to internal addresses and followed redirects | #47 |
| Medium (cloud) | Team catalog tools could wipe the shared list for every tenant | #48 |
| Low | Removed from a shop but kept working in it until the session ended | #46 |
| Low | `sales:view` could open the cash drawer | #44 |

**Security review (still open, needs a decision or other work):**
- **Licensing server (Django):** it hands out the license key and lists
  cloud backups from the hardware ID alone. Balce now keeps the ID behind
  sign-in, but the server side needs a per-install secret, and backups
  should be encrypted on the client.
- **Passwords:**
  - Changing your own password doesn't ask for the current one.
  - An admin reset doesn't force a new password at next sign-in, and
    nothing enforces `must_change_password`.
  - All three need a small screen in the app.
- **LAN mode is plain HTTP,** so cookies and sign-ins can be sniffed on
  shared shop Wi-Fi. Keep the shop Wi-Fi private, or add TLS later.
- **Cloud deploy round:** trusted proxies and `ProxyHeader` behind Caddy,
  so rate limits see the real client address.
- **The backend repo still has a stale `.github/workflows/release.yml`**
  (it builds `./balceinv-api`, which doesn't exist). Deleting it was
  refused by the permission check on CI files, so it's left for the owner.

**Before tagging a release for existing customers:** the importer from the
old `balce.db` is not built yet (it's planned after accounting). Until it
is, customers who update will see the setup warning and must not set up a
new business. **Don't tag a release for live shops before the importer
exists.**

**Verification performed (2026-09-29):**
- **Backend:** `go build ./...`, `go vet ./...`, and `go test ./...` with
  `TEST_DATABASE_URL` set: all 25 packages pass on SQLite and Postgres.
  Every fix above has a test that fails without it or pins the rule. Also
  checked:
  - a parent process that dies abruptly makes the server exit, with
    `shutting down reason="the desktop app closed"` in its log file;
  - without the flag, the server keeps running;
  - the sidecar cross-builds for macOS arm64 and x86_64 (`file` shows each
    architecture), Windows (PE32+ GUI) and Linux.
- **Frontend:** `pnpm build`, `pnpm generate`,
  `node scripts/locales.check.ts` and `node scripts/mobileMoney.check.ts`
  pass. In the browser against a local backend:
  - the setup warning appears with an old `balce.db` and disappears
    without it;
  - an unknown address signed out lands on sign-in.
- **Desktop:** `cargo build --release --features tauri/custom-protocol`
  with the new sidecar, launched with an isolated HOME:
  - `/health` answered on 127.0.0.1:8080, listening locally only;
  - `old_data_found: true` with an old file present;
  - setup started a 14-day trial;
  - sign-in and a sale worked (receipt SALE-20260929-0001);
  - a request with `Host: evil.example.com` got 403;
  - the hardware ID without sign-in got 401;
  - `kill -9` of the app stopped the backend within 1 s, and a normal
    quit stopped both.

**Manual follow-up required:**
- **Windows:**
  - Build the installer through the release workflow (a pre-release tag
    on a test repo or `workflow_dispatch`).
  - Install it, run first setup, sell, and print.
  - End the app from Task Manager and check that "backend" disappears
    from the process list and the app starts again cleanly.
  - With Settings → Network on, try `curl --path-as-is
    "http://<pc-ip>:8080/..\..\..\Roaming\com.balceinv.app\balce.sqlite"`
    from another machine. It must answer 404.
- **Intel Mac:** check that the x86_64 build starts its backend (the
  previous releases shipped an ARM backend there).
- **Printer ports on Windows:** a USB thermal printer shared as
  `\\localhost\POS58`, and a COM-port printer, both print from Settings →
  Hardware → Test print.
- **Delete the stale workflow:** delete `backend/.github/workflows/release.yml`
  in balceinv-api if you agree.

## Manual follow-up required
_Collected from the phases above as they complete._

- **Phase 7, desktop app and LAN (needs a build of the new sidecar,
  Phase 9, or `tauri dev` with `cmd/server` as the sidecar):**
  - **Network screen:** Settings → Network shows the switch, the
    addresses and QR codes. Switching it on triggers the Windows firewall
    prompt: allow **private networks** only.
  - **Second machine on the same Wi-Fi:** scan the QR code or type the
    address, sign in as a cashier, sell, and print from that browser on
    an 80 mm printer installed with its OS driver (check the layout fits).
    Two tills selling at the same moment must both succeed.
  - **Receipt printer on the server PC:** Settings → Hardware → Refresh
    lists the printer port; Test print shows the paper width; a real sale
    prints through it and the drawer opens on cash sales.
  - **Backups:** Settings → Backups → Back up now, then restore that
    backup. The app restarts with the data from that moment, and
    "before-restore" undoes it.
  - **Phone photo:** a real phone on the Wi-Fi scans the product form's
    code, takes a photo, and it appears on the computer.

- **Phase 6, reports on real devices:**
  - **Printing:** print a report to PDF from Chrome and from the desktop
    app. Check that only the report prints (no menu) and the tables fit
    the page width.
  - **Excel:** open the exported workbook in Excel and LibreOffice.
    Amounts must be plain numbers in major units.
  - **Offline rates:** on the desktop app, open the dashboard once
    online, then unplug the network and restart. The rates card must show
    the saved rates with the offline notice rather than an empty card.

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
