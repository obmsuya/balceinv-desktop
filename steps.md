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

## Phases 10–15: the overnight build (2026-09-30)

The owner approved the plan and asked for everything to be built overnight:
- optional suppliers, customers with credit (madeni), and orders;
- simple-first accounting that can be audited;
- branded Excel and PDF;
- a support email from the footer;
- the importer for the old app's data.

**Everything new is off by default** and turned on per business in
Settings → Features.

Backend: balceinv-api #49–#58. Frontend: balceinv #23–#30.
Desktop: #21 (build check), #22 (support mail secret).

### Foundation: feature switches (#49, balceinv #23)
- [x] `company_features` has these switches, all off by default:
      - `suppliers_enabled`, `purchase_orders_enabled`;
      - `customers_enabled`, `credit_sales_enabled`, `customer_orders_enabled`;
      - `accounting_mode` (`off|simple|full`);
      - `vat_registered` with the VRN.
      They obey these rules: credit and orders need customers, purchase
      orders need suppliers, and VAT needs a VRN.
- [x] `/api/features`; `/me` carries the switches. New permissions:
      suppliers, purchases, customers, orders and accounting (60 in total).
- [x] Settings → Features / Vipengele tab. Menu items and routes
      appear only when switched on.

### Phase 10: branded documents (#52, #55, #56, balceinv #26)
- [x] `internal/documents` has two builders:
      - Excel with excelize: brand-colour header row, real `SUM` totals,
        frozen panes, A4 print setup and a filters sheet;
      - PDF with maroto v2 and the Go fonts: header and footer on every
        page, repeated table headers, "Page x of y".
- [x] Every report downloads as Excel or PDF from the server, in English
      or Kiswahili.
- [x] An A4 invoice or receipt for any sale, showing the customer, the
      order number and the amount on credit.

### Phase 11: suppliers and purchasing (#54, balceinv #28)
- [x] Suppliers are optional, and so is the supplier on "Stock arrived":
      stock with no supplier must be paid in full.
- [x] Cost updates by moving weighted average across open shops.
- [x] Supplier payments, returns to a supplier, balances, a statement
      with running balance, and aging.
- [x] Optional purchase orders, which can be received in parts.
- [x] "Stock arrived" is also on the Stock page; products can have a
      usual supplier.

### Phase 12: customers, credit and orders (#53, balceinv #27)
- [x] Customers are optional at the till (search or quick add).
- [x] "Lipa baadaye" (pay later) is checked against the customer's credit
      limit.
- [x] Debt payments with voids, a "who owes" list with aging, and a
      statement.
- [x] A WhatsApp reminder from the customer's page.
- [x] Customer orders:
      - an order and its deposit set the stock aside;
      - marking it ready, then collecting it, makes exactly one sale
        without taking the stock twice;
      - cancelling refunds the deposit.

### Phase 13–14: accounting and its reports (#57, #58, balceinv #30)
- [x] **Books:**
      - double-entry journal with gapless numbers;
      - database triggers refuse UPDATE and DELETE;
      - corrections only by reversal;
      - months can be closed.
- [x] **Automatic postings,** in the same transaction as the event:
      - sales, including credit, and the cost of goods sold;
      - stock adjustments and transfers;
      - purchases, supplier payments and returns;
      - debt payments;
      - order deposits and collections;
      - opening balances.
- [x] **Money page (Fedha) in plain words.** Buttons for money out,
      owner put in or took out, move money and other money in. It shows
      where the money is, what customers owe, and what is owed to
      suppliers.
- [x] **Start wizard.** "Start from my existing records" rebuilds the
      books from existing data. "Start from today" starts from the
      stock on hand now.
- [x] **Full mode** adds a chart of accounts, entries, manual entries,
      month closing, trial balance, balance sheet, account statement or
      cash book, VAT by month with the due date, and a books check.
      Reports export to Excel and PDF.

### Phase 15a: support email (#50, balceinv #24)
- [x] Footer "Msaada" link and the account menu open a form: topic,
      message, email **or** phone (at least one), a screenshot, and
      optional technical details.
- [x] **Sending:**
      - messages queue and are sent from `obmsuya@yahoo.com` to
        `obmsuya@gmail.com` as a formatted HTML email, with Reply-To set
        to the customer, and tap-to-call and WhatsApp links;
      - retries with backoff; limited to 5 an hour per business;
      - the destination address is never shown in the app.

### Phase 15b: bringing over the old app's data (#51, balceinv #25)
- [x] Setup offers "Hamisha data zangu za zamani" when the old `balce.db`
      exists. It shows a preview first, then imports everything in one
      transaction:
      - business, users (old passwords keep working), roles;
      - products and stock;
      - suppliers and discounts;
      - sales history (receipts prefixed `OLD-`).
- [x] The self-check compares counts, sales value and stock value on both
      sides; any difference rolls everything back. The old file is opened
      read-only.

**Verification performed (2026-09-30):**
- **Tests:**
  - Each track: `gofmt`, `go vet` and `go test ./...` on SQLite and
    Postgres; locales check and `pnpm build`.
  - After every merge, the lead reran the full suite.
  - Final state: 34 packages pass on both engines, and the frontend
    builds with 2,381 keys in each language.
- **Build check on GitHub:** the Windows, Intel Mac, Apple Silicon Mac
  and Linux installers all built.
- **Browser, in Kiswahili, against a fresh local install:**
  - **Old-data import:** tried on a *copy* of the owner's real old
    `balce.db`. The preview was right, the self-check matched, and the
    original file's SHA-256 was unchanged.
  - **Features tab:** saved, and the menu followed.
  - **Suppliers:** a supplier added. A purchase on credit updated the
    weighted cost to (12 × 6,200 + 10 × 4,000) / 22 = 5,200.
  - **Credit sale at the till:** TSh 6,500 cash + TSh 10,000 pay later.
    The debt showed and dropped by a TSh 4,000 payment. Over the limit,
    over-payment and credit without a customer were all refused with
    clear messages.
  - **Order:** reserve (stock 25 → 20), mark ready, collect as one sale
    with no second stock deduction.
  - **Support form:** said "not set up yet" locally, because no SMTP
    password is set here.
  - **Documents:** report Excel and PDF (3 pages) and the A4 invoice
    rendered and looked right.
  - **Books from existing records**, all checked by hand:
    - money in 28,500, cash 39,500, mobile money 9,000, customers owe
      6,000, owed to suppliers 40,000;
    - profit 6,700 (sales 34,500 − cost of goods 27,800);
    - an expense and its reversal moved profit and cash and back exactly;
    - a second reversal was refused;
    - the trial balance balanced;
    - ledger sales equal the sales report;
    - the profit & loss PDF is correct.
  - **Layout at 375 px:** no sideways scroll on the new pages; the tab
    rows scroll.
- **Fixed during the pass:**
  - the invoice lacked the customer and the credit line (#55, #56);
  - the English "Opening balances" note (#58);
  - the hidden English "Close" label on dialogs (balceinv #29).

**Known limits:**
- "Start from my existing records" values the rebuilt opening stock and
  stock adjustments at **today's** cost. If costs changed, the books
  check shows the gap: TSh 12,000 in the test, after a purchase moved the
  oil's cost. "Start from today" has no such gap.
- The balance sheet and trial balance are company-wide only.
- Not yet possible:
  - cancelling a return to a supplier, or editing a purchase order;
  - add-ons on customer orders, or partial deposit refunds;
  - a customer wallet or credit balance.
- The app version shows only in the desktop app (the support details are
  empty in a browser).

**Before tagging `v2.0.0`** (the version is bumped in this change):
- Add the GitHub secret **`SUPPORT_SMTP_PASSWORD`** (a Yahoo *app
  password* for obmsuya@yahoo.com). Without it, support messages wait in
  the app.
- Download the Windows installer from the latest "Build check" run, and
  on a Windows PC:
  - set up a business, sell, and print;
  - turn on credit and sell on credit;
  - send a support message;
  - end the app in Task Manager and restart it.
- On a PC with the old app installed, update and use "Hamisha data zangu
  za zamani". Sign in with the old password and check the products and
  stock.
- Then push the tag. The release workflow builds, signs and publishes
  `latest.json`, and installed apps update themselves.

## Phase 16: cloud deploy behind Cloudflare Tunnel (2026-09-30)

The cloud app and its API run at **https://api-pos.faltasi.com** (one
origin: the Go server serves the web app and `/api`). The server has no
public web port of its own; visitors reach it only through Cloudflare.

### Findings fixed
- Behind the tunnel every request reached the server from the tunnel, so
  `c.IP()` was the same for everyone and one person's wrong passwords
  locked all visitors out of signing in
  (`backend/internal/server/server.go`, `backend/internal/config/config.go`).
- The app connected to Postgres as the table owner. Migrations now run as
  `balce_owner` through `MIGRATION_DATABASE_URL`; the app serves as
  `balce_app` (no BYPASSRLS) (`backend/cmd/server/main.go`).
- The cloud login page offered "Set up your business", which the cloud
  refuses; it now shows only on the desktop (`frontend/app/pages/login.vue`).

### Implementation status
- [x] Owner: domain in Cloudflare, tunnel `balce-server` created, route
      `api-pos.faltasi.com` → `http://localhost:8080`.
- [x] `cloudflared` 2026.9.3 from Cloudflare's apt repository, installed as
      a systemd service with the dashboard token; 4 connections registered.
- [x] `PROXY_HEADER=CF-Connecting-IP`, `TRUSTED_PROXIES` = the gateway of the
      `balce_edge` network (the only address the tunnel reaches the API from).
- [x] `api` service in `deploy/docker-compose.prod.yml`: published on
      `127.0.0.1:8080` only, image carries `balce-api`, `balce-admin` and the
      built web app, `balce_edge` gives it outbound access (support email,
      EFD), logs in the `api_logs` volume, 192 MiB limit.
- [x] `deploy/deploy.sh`: checks `ALLOWED_ORIGINS`, builds the web app and
      both binaries, uploads the compose file and image context, backs up,
      starts the new tag, rolls back if `/health` fails, checks the public
      URL, keeps the last two images.
- [x] `deploy/firewall-cloudflare.sh`: ports 80/443 accept only Cloudflare's
      published ranges (22 ranges); drops ranges Cloudflare no longer lists;
      monthly cron `/etc/cron.d/balce-cloudflare-firewall`.
- [x] PRs: balceinv-api #59, balceinv #32.

### Verification performed
- `go test ./...` with `TEST_DATABASE_URL`: 34 packages pass on SQLite and
  Postgres. The new visitor-address test fails with the server change
  removed; a forged header from an untrusted address stays limited.
- `deploy.sh --dry-run`, then two real deploys: migrations 0 → 52, API uses
  7.6 MiB; the second deploy recreated only `balce-api`.
- Through Cloudflare: `/health` 200, `/` and `/login` 200 (web app),
  `/api/platform` 200, `server: cloudflare`; `/api/setup/status` reports
  `configured: true` and `POST /api/setup` is refused in the cloud.
- On the server, `ss` shows tunnel traffic reaching the container from
  172.31.250.1, the trusted address.
- Firewall: `https://140.99.254.193`, `http://140.99.254.193` and
  `:8080` time out from outside; `faltasi.wapangaji.com` still 200 through
  Cloudflare; a second run of the firewall script changes nothing.
- Browser: the login page loads at https://api-pos.faltasi.com with no
  console errors and no setup link.

### Phase 17: cloud sign-up and pos.faltasi.com (2026-09-30)

### Findings fixed
- The cloud refused `POST /api/setup`, so a new business could only be
  created by the administrator (`backend/internal/tenancy/handler.go`).
- First-time visitors had no way to find sign-up; the splash always sent the
  cloud to sign in (`frontend/app/pages/index.vue`).

### Implementation status
- [x] Cloud `POST /api/setup` creates a new company for each new owner,
      ten attempts an hour per network (`newSignupLimiter` in
      `backend/internal/server/routes.go`); `GET /api/setup/status` reports
      `signup_open: true` in the cloud.
- [x] Splash: with sign-up open, a browser that never signed in goes to
      `/setup`, a returning one to `/login` (`hasSignedInBefore` in
      `frontend/app/composables/useAuth.ts`). The login page links to setup
      again, and a new owner is signed straight in after creating the business.
- [x] `ALLOWED_ORIGINS=https://pos.faltasi.com,https://api-pos.faltasi.com`.
- [x] PRs: balceinv-api #60, balceinv #33.

### Verification performed
- `go test ./...`: 34 packages pass on SQLite and Postgres. The cloud case
  signs up two businesses, refuses a repeated email with `email_taken`, keeps
  each owner's products apart, and limits the eleventh attempt with 429.
- `pnpm generate` and the locales check pass.
- Local cloud preview (Postgres scratch database, since dropped): first visit
  went to `/setup`, creating a business opened the till signed in as its
  owner, a later visit went to `/login` with the setup link shown.
- Production after deploy: `/api/setup/status` returns `signup_open: true`;
  a fresh browser on the live site lands on `/setup`.

### Phase 18: menu scroll, cloud account menu, first-time tour, auto-deploy (2026-09-30)

### Findings fixed
- The side menu could not scroll, so with every feature on, Settings and Roles
  were out of reach (`frontend/app/components/CustomSidebar.vue`).
- The cloud account menu showed a hardware ID stuck on "Loading…": only a
  desktop server has one, and the cloud has no hardware-ID or license route.
  License and hardware-ID calls now run only against a desktop server, and
  "Check for updates" shows only in the desktop app
  (`frontend/app/composables/useLicense.ts`, `frontend/app/components/AppHeader.vue`).
- New users had no guidance.

### Tour plan (one step at a time)
- [x] **Step 1:** tour engine (driver.js, MIT, no dependencies) with Balce
      styling in light and dark, English and Kiswahili, skip on every step,
      "Show the tour" in the account menu. Tours: Welcome (menu, header, the
      three first setup steps), Settings, Products, Point of Sale.
- [x] **Step 2:** Users and Roles (add a cashier, what roles allow), Shops
      (add a branch, receipt prefix), Stock (change stock, send stock).
- [x] **Step 3:** the optional features, each shown the first time its page
      opens after it is switched on: Customers and credit (madeni), Orders,
      Suppliers and purchases, Money (simple and full books).
- [x] **Step 4:** Reports and Dashboard, Discounts, Sales history and
      refunds; a "Getting started" checklist on the dashboard (business
      details, logo, first product, first cashier, first sale).
- [x] **Step 5:** remember seen tours on the server so a new device does not
      repeat them (today: per user on this device).

### Auto-deploy to the cloud
- [x] `.github/workflows/deploy-cloud.yml`: on every push to `main` (or by
      hand), tests the backend on SQLite and Postgres, checks translations,
      then runs `backend/deploy/deploy.sh` against the server, checking
      https://pos.faltasi.com at the end. One deploy at a time.
- [x] Deploy key `balce-github-deploy` (ed25519) in the server's
      `authorized_keys` with forwarding off; private key and pinned host keys
      stored as the GitHub secrets `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS`;
      the local copy of the private key was deleted.

### Verification performed
- Local cloud preview (Postgres scratch database, since dropped):
  - The welcome tour ran all 10 steps at 1366 px.
  - The Products tour ran in Kiswahili, with no Back button on its first step.
  - The Settings tour ran at 375 px, with page width equal to the screen (375/375).
  - The Point of Sale tour ran in Kiswahili.
  - On a 480 px tall screen the menu scrolls: 618 px of menu in a 327 px area, and Settings is reachable.
  - After sign-in, no license or hardware-ID requests were made.
- `pnpm generate`; locales check: 2433 keys in each language.
- The deploy key signed in to the server with `IdentitiesOnly`.
- PR: balceinv #34.

### Phase 19: accounting reports, step 1 — profit and loss (2026-09-30)

Decision: every report moves to Reports; Money keeps recording and its
transactions table (step 4). Step 1 is the reference document, reviewed
before the pattern is copied.

### Findings fixed
- Accounting exports reused the generic table template: no statement
  structure, no comparison, no notes or sign-off
  (`backend/internal/accounting/export.go`).
- Exports downloaded blind; nothing could be previewed.
- Month to date was compared with the same number of days before it
  (15–31 Aug for 1–17 Sep) instead of the same days last month.
- A one-shop statement for a one-shop business left out costs recorded for
  the whole business (rent, salaries), turning a loss into a profit.

### Implementation status
- [x] `documents.Statement` with PDF and Excel renderers
      (`backend/internal/documents/statement*.go`):
  - letterhead, period and comparison;
  - sections with indented accounts and codes;
  - ruled subtotals, a shaded gross profit and a shaded, double-ruled net
    profit or loss;
  - margins, the previous period and the change, bracketed negatives;
  - numbered notes, and prepared by and approved by lines;
  - "(continued)" headings on new pages;
  - in Excel, a formula for every total, the header frozen and repeated on
    A4, and recalculation when the file opens;
  - statements that don't add up are refused.
- [x] Profit and loss statement
      (`backend/internal/accounting/profit_and_loss_statement.go`) against
      the previous month, quarter, year, same days last month or same
      length, all shops or one, English and Kiswahili.
- [x] Preview dialog (`frontend/app/components/reports/DocumentPreviewDialog.vue`)
      drawn with pdf.js (legacy build) at the screen's pixel density, with
      Excel, PDF and Print (page images, same on every platform).
- [x] Reports → Books tab: a table of statements with Preview, Excel, PDF.
- [x] PRs: balceinv-api #62, balceinv #35.

### Verification performed
- `go test ./...`: 34 packages pass on SQLite and Postgres.
  - Excel totals recalculated with excelize match the ledger; breaking the
    subtraction formula fails the test.
  - The PDF has 1 page for a short statement and 3+ for 120 accounts.
  - Previous-period rules, including leap February.
  - An empty period says so; a one-shop statement names the shop and what
    it leaves out.
  - Bad dates, shops and formats are refused.
- Sample statements read page by page, English, Kiswahili and 3 pages long.
- Local cloud preview with real books (6 sales, 4 expenses):
  - The preview showed net loss TSh 126,650, equal to the ledger.
  - Kiswahili account names and codes were right.
  - The Excel download saved.
  - At 375 px the page redrew at 341 px (682 px canvas) with no sideways
    scroll.
- `pnpm generate`; locales check: 2448 keys in each language.

### Found, not fixed in this step
- The till treats every price as including the settings tax rate (18% by
  default) even when the business is not VAT registered, so the sales
  overview's gross profit (TSh 66,015 in the preview) disagrees with the
  books (TSh 104,150, which is right for a business that collects no VAT).
  Fix proposal: the till applies tax only when VAT registration is on.

### Next steps
- Step 2: balance sheet, trial balance, cash book / account statement, VAT
  return, simple-books summary, customer and supplier statements.
- Step 3: Reports as one list for every report, all with the same design.
- Step 4: Money as a recording page with one transactions table.

## Phase 20: VAT only for VAT-registered businesses (2026-09-30)

### Finding fixed
- The till took the settings tax rate (18% by default) out of every price even
  when the business was not VAT registered, so the sales report's gross profit
  (TSh 66,015 in the preview) disagreed with the books (TSh 104,150)
  (`backend/internal/sales/service.go`).

### Implementation status
- [x] Quotes, sales and customer orders use the tax rate only when VAT
      registration is on (`saleTaxRate`), the rule purchases already followed.
- [x] Settings → System explains under the tax rate whether the till charges it.
- [x] PRs: balceinv-api #63, balceinv #36.

### Verification performed
- The three tests that check VAT maths now register their business for VAT; a
  new check confirms an unregistered business is quoted 0% and TSh 0 VAT.
- `go test ./...`: 34 packages pass on SQLite and Postgres.

### Manual follow-up required
- Sales already made by an unregistered business keep the VAT they were
  recorded with, so older sales reports still show it; new sales are correct.

## Phase 21: accounting reports, step 2 — every statement (2026-09-30)

### Implementation status
- [x] Shared sheet helper for the Excel letterhead, notes, sign-off and print
      setup (`backend/internal/documents/excel_sheet.go`); single-column
      statements; notes kept with the sign-off.
- [x] Register layout (`backend/internal/documents/register*.go`): opening
      balance, running balance, totals, double-ruled closing balance, summary
      strip, wrapped headings, header on every page; in Excel every running
      balance and total is a formula, with header filters. Wrong balances are
      refused.
- [x] Balance sheet compared with the start of the period; money summary;
      trial balance; account statement / cash book with the other side of each
      entry; VAT return (`backend/internal/accounting/books_documents.go`).
- [x] Customer and supplier statements as PDF and Excel
      (`backend/internal/customers/statement_document.go`,
      `backend/internal/suppliers/statement_document.go`).
- [x] Reports → Books lists every statement (`frontend/app/components/reports/BooksPanel.vue`);
      customer and supplier pages preview and download their statements.
- [x] The preview frees the pdf.js worker (loading task destroyed).
- [x] PRs: balceinv-api #64, balceinv #37.

### Verification performed
- `go test ./...`: 34 packages pass on SQLite and Postgres. Excel totals
  recalculated against the ledger and the API for:
  - the balance sheet (both sides equal the total assets);
  - the trial balance (debits equal credits);
  - the cash book (the running balance reaches the closing balance);
  - the VAT return, the money summary (net worth), and the customer
    (TSh 10,000) and supplier (TSh 17,000) statements.
- Sample documents read page by page in English and Kiswahili. Figures checked
  by hand:
  - trial balance 9,755,300 on both sides; balance sheet 7,793,840;
  - money in 1,377,600 = 115,640 + 139,240 + 122,720 + 1,000,000;
  - customer 21,240 − 5,000 = 16,240; supplier 360,000 − 150,000 = 210,000.
- Found and fixed while reading the samples:
  - a cut-off totals label;
  - the "Amount" heading repeated on the money summary;
  - the sign-off stranded on a page of its own;
  - cut-off column headings;
  - payment references shown as raw codes;
  - "Profit to date" out of line with the account names;
  - cash book lines that only said "Money out".
- Local cloud preview (full books, VAT, supplier, credit customer):
  - Books lists all six statements.
  - The Bank statement, customer (TSh 12,700) and supplier (TSh 80,000)
    previews rendered.
  - Opening and closing the preview raised no errors.
  - At 375 px there is no sideways scroll.

### Next steps
- Step 3: Reports as one list for every report (sales and stock too), all in
  the same document design.
- Step 4: Money as a recording page with one transactions table.

## Phase 22: accounting reports, step 3 — every report in Reports (2026-09-30)

### Findings being fixed
- Sales and stock exports did not match the document design of the book
  statements (`backend/internal/reports/export.go`).
- There was no document for customers who owe or for what we owe suppliers
  (`backend/internal/customers/statement_document.go`,
  `backend/internal/suppliers/statement_document.go`).
- The Reports page was built from pills, stat cards and tabs, and books sat in
  a separate tab (`frontend/app/pages/reports/index.vue`,
  `frontend/app/components/reports/BooksPanel.vue`).

### Implementation status
- [x] Shared previous-period rule and headings
      (`backend/internal/documents/period.go`); profit and loss uses it.
- [x] Sales report as a statement compared with the previous period, covering:
  - takings, VAT, net sales, cost, gross profit and margin;
  - how customers paid;
  - discounts and average sale.
- [x] Registers with a summary strip and totals for:
  - sales per day, products sold (with ranking), sales per staff member and
    sales per shop;
  - stock on hand, with an out-of-stock / running-low status;
  - stock not selling (`backend/internal/reports/documents.go`).
- [x] Customers who owe and what we owe suppliers, each with ageing columns.
      They come through `?format=` on `/api/customers/debtors` and
      `/api/suppliers/aging`.
- [x] Count totals in Excel registers use whole-number formatting.
- [x] Reports page as one table grouped into Sales, Stock, Customers and
      suppliers, and Financial statements:
  - every row has Preview, Excel and PDF;
  - filters are a Period select, dates and a shop;
  - products have a "Rank by" picker; account statements keep the account
    picker.
- [x] PRs: balceinv-api #65, balceinv #38.

### Verification performed
- `go vet ./...` and `go test ./...` pass on SQLite and Postgres. Excel values
  are checked against the API:
  - gross profit formula;
  - daily takings 4,720 over 2 sales;
  - stock at cost 98×600 + 99×900 + 7×200;
  - customers who owe 10,000;
  - suppliers we owe 17,000;
  - no data leaks between companies.
- Sample PDFs were read in English and Kiswahili. Products sold totals
  127,440 / 108,000 / 70,200 / 37,800. Stock value at cost 1,225,900.
- A column fix came out of that review: "Last sold" on stock not selling was
  squeezed against the money column. It now comes before the quantities.
- `pnpm generate` and `node scripts/locales.check.ts` pass.
- Local cloud preview (full books, VAT, supplier, credit customer):
  - all 14 reports previewed without errors;
  - customers who owe showed 17,700 − 5,000 = 12,700;
  - "Rank by: Profit" sent `sort=profit`;
  - a start date after the end date disables the period reports while the
    stock reports stay available.

### Next steps
- Step 4: Money as a recording page with one transactions table.

## Phase 23: accounting reports, step 4 — Money as a recording page (2026-09-30)

### Findings being fixed
- Money repeated what Reports now does. It had profit, own/owe and books
  report tabs, plus stat cards, a VAT card and balance tiles
  (`frontend/app/pages/money/index.vue`, `frontend/app/components/money/*Panel.vue`).
- Records were a card list, not a data table
  (`frontend/app/components/money/EntryList.vue`).

### Implementation status
- [x] One transactions table: Date, No., Details, Recorded by, Money in, Money
      out (`frontend/app/components/money/EntriesTable.vue`). Money in and out
      come from the money-account lines of each entry. Entries that move no
      money say so.
- [x] The same filters as Reports: Period select, dates and shop. Full
      accounting adds "Show: Money records / Every entry".
- [x] Header actions:
  - "Money out";
  - "Record other" (other money in, move money, owner in or out, manual
    entry);
  - "More" (Reports, Books check, Chart of accounts, Close month).
- [x] Balances shown as one line for the end date.
- [x] The books check is a dialog, with a warning banner only when debits and
      credits differ or the books disagree with the sales report
      (`frontend/app/components/money/BooksCheckDialog.vue`).
- [x] Removed the profit, own/owe and books-reports panels and the export
      buttons. Removed the report fetchers and exports from `useMoney`, which
      Reports now covers.
- [x] PR: balceinv #39.

### Verification performed
- `pnpm generate` and `node scripts/locales.check.ts` pass.
- Local cloud preview (full books, VAT, supplier, credit customer, Kiswahili):
  - the table loaded;
  - Record other → Move money opened its form;
  - the books check showed every check passing (sales 96,000 = 96,000; stock
    1,766,150 = 1,766,150);
  - the chart of accounts opened in a dialog;
  - Every entry listed all 20 entries;
  - opening an expense row showed balanced debit and credit lines (64,900).
- At 375 px neither Money nor Reports scrolls sideways; on phones the date
  sits under the details.

### Next steps
- Tour plan steps 2–5.

## Phase 24: tour steps 2–5, support email, team handbook (2026-09-30)

### Findings being fixed
- Only the welcome, Settings, Products and Point of Sale pages had a tour
  (`frontend/app/composables/useTour.ts`). Seen tours lived only in the
  browser, so a new device repeated them.
- The dashboard did not tell a new owner what was left to set up.
- `SUPPORT_SMTP_PASSWORD` was missing on the server and in GitHub, so support
  messages waited in the database and desktop builds could not send email.
- The team kept asking the same questions (subscriptions, the sales tool,
  where expenses go) with no guide to point to.

### Implementation status
- [x] Tours for Users, Roles, Shops, Stock, Customers, Orders, Suppliers,
      Money, Reports, Dashboard, Discounts and Sales, in English and Kiswahili.
      Each runs the first time its page opens. The Money tour explains where
      expenses are recorded.
- [x] "Getting started" checklist on the dashboard, for owners only
      (`frontend/app/components/GettingStartedCard.vue`). It covers business
      phone and address, logo, first product, a cashier and the first sale.
      Items tick themselves off, and the card can be hidden.
- [x] Seen tours are remembered on the server:
  - migration 000053 adds `users.seen_tours`;
  - `PUT /api/auth/tours` records a tour;
  - `/api/auth/me` returns `seen_tours`;
  - `/api/dashboard` returns `getting_started`.
- [x] `SUPPORT_SMTP_PASSWORD` added to `/opt/balce/.env.prod` (the API was
      restarted and the container has the variable) and as a GitHub Actions
      secret for desktop release builds. It was never printed or committed.
- [x] Team handbook (`docs/team/README.md`): the guide index and the
      documentation plan. New guides: `docs/team/subscriptions.md` and
      `docs/team/recording-expenses.md`.
- [x] PRs: balceinv-api #66, balceinv #40.

### Verification performed
- `go vet ./...` and `go test ./...` pass on SQLite and Postgres, including
  new tests:
  - tours are recorded once per user and company, bad names are refused, and
    sign-in is required;
  - the checklist follows setup and does not leak between companies.
- `pnpm generate` and the locales check pass (2439 keys in each language).
- Local cloud preview (Kiswahili):
  - the welcome tour, then the dashboard tour, ran;
  - the checklist showed 3 of 5;
  - `/api/auth/me` returned `seen_tours` [welcome, dashboard];
  - with local storage cleared, the dashboard tour did not repeat;
  - all 11 other page tours ran;
  - steps with no target on screen were skipped (Send stock with one shop;
    Roles in the menu while the drawer is closed).
- https://pos.faltasi.com/health returned 200 after the API restart.

### Subscription check (for the team's questions)
POS_MASTER and wapangaji were read on 2026-09-30.
- Every endpoint and field POS_MASTER uses still exists and has the same
  shape.
- A licence made with POS_MASTER is the same record as one the customer pays
  for inside the POS.
- Timing difference: a device still on the free trial does not pick up a
  POS_MASTER licence until the trial and grace days end. The startup sync
  sends the key `trial` (`backend/license/license.go:334`), and the status
  check only asks the server when the POS is locked
  (`backend/internal/licensing/handler.go:84`).
- Trial is 14 days and grace is 5 days, counted from expiry
  (`backend/license/license.go:27,57`).

### Manual follow-up required
- Send a test message from Help → Contact the Balce team on pos.faltasi.com
  and confirm it arrives at the support inbox.
- Wapangaji payment security, which lives in the wapangaji repository:
  - the Balce payment callback accepts unauthenticated posts
    (`apps/payments/api/balce_views.py:189`);
  - partner accounts can register themselves and record payments.
  Decide how to lock both down.

## Phase 25: subscriptions for web businesses, sales tool fixes (2026-09-30)

### Findings being fixed
- The web version had no subscription at all. Licensing only worked on the
  desktop, where it is tied to one computer's hardware ID
  (`backend/internal/config/config.go`, `EnforceLicense`).
- A desktop still on the free trial did not notice an activation from the
  sales tool until the trial and grace days ran out.
- POS_MASTER (the sales tool):
  - it lost its sign-in every second launch and after a few hours of use,
    because it discarded the rotated refresh token and never re-saved the
    session;
  - it accepted shortened device IDs.

### Implementation status
- [x] `company_subscriptions`: migration 000054 in both engines, with RLS.
  Existing businesses got 14 days from the migration; new businesses get
  14 days when created, from self-signup or the admin tool
  (`backend/internal/tenancy`).
- [x] Web ID `cloud-<company id>`. It uses the same Wapangaji plans, payment
  and licence record as the desktop, so the sales tool works unchanged
  (`backend/internal/subscriptions`).
- [x] Web lock: after the 5-day grace, signed-in routes return 402
  `subscription_required`. Sign-in, licence, support and platform routes stay
  open.
- [x] Frontend:
  - the badge, payment flow and lock screen run on the web too;
  - the web ID is called "Subscription ID";
  - during a trial the app asks the licensing server once per page load, on
    both platforms, so sales-tool activations show at once.
- [x] POS_MASTER v.1.0.3:
  - keeps the rotated refresh token and saves the session after every
    refresh;
  - on a 401 it refreshes once and retries once;
  - it accepts only full 64-character or `cloud-<uuid>` IDs.
- [x] PRs: balceinv-api #67, balceinv #41, POS_MASTER #1 (tag v.1.0.3).
- [x] `docs/team/subscriptions.md` updated for the web.

### Verification performed
- `go vet ./...` and `go test ./...` pass on SQLite and Postgres. New tests
  use a fake Wapangaji and cover:
  - the 14-day trial and the grace period;
  - the lock for the owner and cashiers, with the pay-screen routes left
    open;
  - no effect between businesses;
  - owner-only payment, sent as `cloud-<id>`;
  - refresh before and after payment;
  - an older licence never shortening a newer one;
  - a trial picking up a sales-tool activation straight away.
- Local cloud preview:
  - the migrated business showed a 14-day trial and the header badge;
  - once expired in the database, the page showed the lock screen with the
    real plans and the Subscription ID, and data calls returned 402.
- POS_MASTER: `go test ./...` passes, including tests for the rotated token,
  the refresh-and-retry on 401 (no loop), and the ID check.

### Incident during the deploy
- Migration 000054's copy of every company into `company_subscriptions`
  inserted nothing in production. It runs as `balce_owner` under FORCE
  row-level security, so it saw no companies. Local tests missed this because
  the local role is a superuser.
- The 7 web businesses were locked for a few minutes. Their rows were then
  inserted as the database superuser (trials end 14 Oct 2026).
- Fix (balceinv-api #68): a missing row now starts a 14-day trial in its own
  write transaction instead of locking. A test covers it.
- Lesson: a Postgres data migration that reads tenant tables sees nothing in
  production. Do data fixes in application code, or run them as the
  superuser on purpose.

### Manual follow-up required
- Every existing web business is on a 14-day trial ending
  about 14 Oct 2026. Tell them before it runs out.
- The live Wapangaji plan list includes "Dev License" at TSh 100, and web
  owners will see it. Remove or hide it in Wapangaji.
- Sales staff on POS_MASTER v.1.0.0 or v.1.0.1 must download v.1.0.3 by hand;
  v.1.0.2 offers the update itself.

## Phase 26: amounts shown with commas as people type (2026-09-30)

### Findings being fixed
- Money fields showed raw digits while typing (1500000), which were hard to
  read and easy to get wrong. Amounts on screen were already formatted.

### Implementation status
- [x] `frontend/app/utils/amountText.ts`: cleans typed text, groups thousands
      with commas and keeps the cursor in place. Currencies with no decimals
      drop anything after a dot.
- [x] `frontend/app/components/MoneyInput.vue`: shows the grouped text but
      hands the form the plain number, so no saving code changed. It uses the
      currency's decimals, or 2 for a percentage discount.
- [x] Used for 25 money fields: products, customers, suppliers and purchases,
      orders, discounts, Money and the POS payment box. Quantity fields are
      unchanged.
- [x] `frontend/scripts/amountText.check.ts` runs in Build check and Deploy
      cloud.
- [x] PR: balceinv #43.

### Verification performed
- `node --experimental-strip-types frontend/scripts/amountText.check.ts`
  passes. It covers grouping, pasted amounts with commas, leading zeros,
  letters, decimals and cursor position. It caught one bug before release:
  1500.50 had become 150,050.
- `pnpm generate` and the locales check pass.
- Local cloud preview:
  - typing 1500000 in Money out showed 1,500,000;
  - typing a 2 in the middle gave 12,500,000 with the cursor after the 2;
  - backspace kept the grouping;
  - saving recorded TSh 1,500,000;
  - in the POS payment box, the total showed 11,800, quick cash 20,000 gave
    TSh 8,200 change, and typing 50,000 gave TSh 38,200 change.

### Manual follow-up required
- On a touch till, check the on-screen keypad in Point of Sale → Pay. It was
  not on screen at the preview width.

## Phase 27: moving a desktop business online (2026-10-01)

### Findings being fixed
- The desktop app and pos.faltasi.com keep separate data and never sync. A
  desktop shop that wanted to go online had to start again from nothing.
- The setup page had no toast area, so its success and error messages never
  showed. Toast styles were loaded by the layouts, not by the toast component.

### Implementation status
- [x] Desktop `POST /api/move-to-web/file` (owner only). It builds a `.balce`
      moving file: a manifest, a `VACUUM INTO` copy of the database, and every
      logo, product photo and receipt photo
      (`backend/internal/businessmove/service.go`).
- [x] Online `POST /api/setup/move-from-desktop`, public, with the signup rate
      limit (`backend/internal/businessmove/copier.go`):
  - checks: size limits; refuses a newer schema; migrates the copy; exactly
    one business, matching the manifest;
  - copy: one Postgres transaction with the tenant set; tables ordered
    parents-first from the foreign keys; self-referencing rows ordered;
    types converted per target column;
  - skipped: sessions, subscriptions and support messages. The business
    starts a fresh 14-day trial;
  - pictures are stored only under the business's own folder;
  - clear refusals for a second move, an email clash, a newer file and a bad
    file.
- [x] The server-wide upload limit went from 8 MB to 65 MB, to fit the moving
      file.
- [x] Screens:
  - desktop: Settings → Backups → **Move this business online**;
  - online: the setup page card **Already use Balce on a computer?** with an
    upload dialog and a sign-in hint.
- [x] Setup now has a toast area, and toast styles load with the toast
      component.
- [x] Team guide `docs/team/moving-online.md`, covering both "does my data
      follow me?" and the move steps.
- [x] PRs: balceinv-api #69, balceinv #44.

### Verification performed
- `go vet ./...` and `go test ./...` pass on SQLite and Postgres. The new
  end-to-end test builds a real desktop business (variants, logo, product
  photo, cash and credit sales, books with a reversal, a cashier), moves it
  into a Postgres server, and checks:
  - every tenant table has the same row count;
  - the owner and cashier sign in with their desktop passwords;
  - the logo is served online;
  - the sales summary and money figures match;
  - the business is on a 14-day trial, and a new sale works afterwards;
  - moving twice, an email clash (nothing left behind) and junk files are
    refused;
  - a cashier cannot download the file.

  A unit test covers the picture-folder rule.
- Desktop-mode server plus web preview:
  - the seeded business (logo, product photo, 2 products, 3 sales) was saved
    to a moving file, which contained the database, the logo and the photo;
  - importing through the setup dialog worked, and signing in with the
    desktop password showed Mchele stock 114, 3 sales, TSh 21,000 and a
    14-day trial;
  - a second move showed "Biashara hii tayari iko mtandaoni. Ingia badala
    yake." as a toast;
  - the failed first attempt (the preview had no picture storage) left no
    rows behind.

### Manual follow-up required
- The desktop button ships in the next desktop release (v2.0.2). Until then
  shops cannot make a moving file.
- Move one real shop together with the owner, and check products, stock and
  today's sales online before they stop using the computer.
- Paid days on the desktop do not move. Add any remaining days to the new
  Subscription ID with the sales tool.

## Phase 28: Windows desktop sign-in (2026-10-01, v2.0.2)

### Findings being fixed
- Every v2.0.0 and v2.0.1 Windows install showed "Can't reach Balce" on sign-in.
  Since 29 Sep the sign-in request sends `X-Balce-Client: desktop`, but the CORS
  allowed headers never listed it. The webview's preflight was refused, so the
  sign-in POST never left the screen (`backend/internal/server/server.go`).
- A v1 server left running after a crash survived the v2 install: it kept
  port 8080 and its `backend.exe` was not replaced. The NSIS pre-install hook
  matched on `Process.Path`, which 32-bit PowerShell (the installer's) reads as
  empty for a 64-bit process (`src-tauri/windows/hooks.nsh`).

### Implementation status
- [x] `httpx.DesktopClientHeader` is shared by the auth handler and the CORS
      allowed headers.
- [x] The hook matches `Win32_Process.ExecutablePath` and stops by process id.
- [x] PRs: balceinv-api #70, balceinv-desktop #38. Released as v2.0.2.

### Verification performed
- On a GitHub Windows runner with the published v2.0.1 installer, the preflight
  to `/api/auth/login` returned allowed headers without `X-Balce-Client`.
- `TestDesktopScreenMayCallTheApiFromEveryWebviewOrigin` fails on the old code
  and passes now. The full suite passes on SQLite and Postgres.
- From 32-bit PowerShell with a leftover v1.0.19 server: the shipped hook left
  1 server running, the fixed hook left 0.
- Two shop computers' logs matched: one showed `OPTIONS /api/auth/login` 204
  with no POST after it, the other had an old server on 8080 and no v2 log.

### Manual follow-up required
- Install v2.0.2 on a Windows shop computer that still runs v1 and confirm
  sign-in works without a restart.

## Phase 29: tester reports on receipts, printing and products (2026-10-02, v2.0.3)

### Findings being fixed
- Desktop POS "no way to print": the Print button falls back to `window.open`
  when no receipt printer is set up, and the desktop app ignores it
  (`frontend/app/composables/usePrint.ts`). The printer status was also read
  once per session.
- Web receipts: no PDF download on the screen after a sale, and no Share
  anywhere.
- Web "no way to delete a product": it exists as Archive ("Weka kando") in the
  row menu.
- Desktop "subscribing fails": no cause visible in code. The log did not
  record what the payment server answered.
- Not fixed, not current: the sales-import template and the export button
  were v1 bugs (`window.open` and an empty export function). v2 has no sales
  template, and report export uses the native save dialog.

### Implementation status
- [x] `openBrowserReceipt` opens a `WebviewWindow` on Tauri. Receipt windows
      (`receipt-*`) get the app permissions
      (`src-tauri/capabilities/default.json`). The printer status is re-read
      on every print.
- [x] `useSales.shareSaleReceipt` and a `kind` for `downloadSaleDocument`.
      Share and Receipt (PDF) buttons on the POS completion dialog and the
      sale details dialog.
- [x] Archive is called Delete / Futa. Glossary updated.
- [x] The licensing proxy logs each payment server reply (status, duration,
      reason) and each activation failure.
- [x] PRs: balceinv-api #71, balceinv #45.

### Verification performed
- `go test ./internal/licensing/ ./internal/server/`, `node
  scripts/locales.check.ts`, `pnpm generate`.
- Web preview on a scratch Postgres database:
  - Receipt (PDF) fetched `kind=receipt` (200) and showed the saved toast;
  - Share with a stubbed share API passed a 41 KB `application/pdf` file, and
    without the API it saved the file with the attach hint;
  - sales history shows Share, Receipt (PDF), A4 invoice and Print;
  - the product menu shows Futa.

### Manual follow-up required
- On a Windows and a Mac desktop with no receipt printer: make a sale, press
  Print receipt, and check that a receipt window opens and the print dialog
  appears. The Tauri window path cannot be checked in the browser preview.
- On a phone browser: press Share after a sale and check WhatsApp is offered
  with the PDF attached.
- After a failed desktop payment, run the PowerShell log command from the team
  and read the `licensing server responded` line for the reason.

## Phase 30: cashier discount at the till (2026-10-06, v2.0.4)

### Findings being fixed
- The 29 Sep till rebuild (frontend `9e6195a`) removed the per-line "% off"
  box. It worked only because the server trusted prices sent by the screen,
  so any cashier could sell at any price with no record. Phase 5 listed it as
  "left out on purpose, add when asked", but the owner was never told.

### Implementation status
- [x] Migration 000055:
  - `sale_items.manual_discount_amount`;
  - `settings.till_discount_limit_basis_points` (default 10000);
  - permission `till_discounts:create`. It is granted to no role; owners
    tick it in Roles.
- [x] Server pricing: percent (basis points) or amount per line, on top of
      the automatic discount, capped at the line. 403
      `till_discount_not_allowed`; 422 `till_discount_over_limit` (the owner
      has no limit) (`backend/internal/sales/pricing.go`, `service.go`).
- [x] Receipts (PDF and thermal) show the automatic and cashier discounts as
      separate rows.
- [x] Till: a Discount / Punguzo button per line with a percent or amount box
      that warns above the limit (`frontend/app/components/pos/LineDiscountPopover.vue`).
- [x] The owner's limit in Settings → Hardware. The permission label in
      Roles. The receipt page and sales history show the cashier discount.
- [x] Team guide `docs/team/till-discounts.md`.
- [x] PRs: balceinv-api #72, balceinv #46.

### Verification performed
- `go vet ./...`, `go test ./...` on SQLite and Postgres. The new pricing
  test and the end-to-end test cover the permission, the limit, saved lines
  and the owner without a limit.
- `node scripts/locales.check.ts`, `pnpm generate`.
- Web preview with a cashier holding the permission and a 10% limit:
  - 15% was blocked in the box;
  - 10% gave server totals of −2,000 and 18,000;
  - the sale saved the cashier discount;
  - the receipt showed "Cashier discount −TSh 2,000";
  - the limit saved 12.5% as 1250;
  - Roles listed the permission.

### Manual follow-up required
- On a touch till, open the Discount box on a cart line and check it is easy
  to use with fingers and does not cover the Pay button.
- Tell owners the button is off for staff until they tick "Give discounts at
  the till" in Roles.

## Phase 31: no limit on cashier discounts (2026-10-06)

### Findings being fixed
- The owner does not want a cap: anyone allowed to give discounts may take up
  to the full price.

### Implementation status
- [x] Removed the limit check, the `till_discount_over_limit` error, the limit
      in till options and the Settings field. Migration 000056 drops
      `settings.till_discount_limit_basis_points`.
- [x] The till's discount box no longer shows or enforces a limit.
- [x] Team guide updated.
- [x] PRs: balceinv-api #73, balceinv #47.

### Verification performed
- `go vet ./...`, `go test ./...` on SQLite and Postgres. The end-to-end test
  gives 100% on one line as a permitted cashier.
- `pnpm generate`, locale check.
- Web preview: a permitted cashier set 100% ("Takes TSh 20,000 off this
  line"), Pay showed TSh 0, and the sale completed.

### Manual follow-up required
- None beyond Phase 30.

## Phase 32: void a sale, linked money records, tester answers (2026-10-07, v2.0.5)

### Findings being fixed
- A confirmed sale could not be corrected: there was no void, refund or edit.
- In simple books the Money page listed only hand-typed records, while the
  balances included sales and purchases, so money looked unlinked.
- Salaries could not say who was paid. A note was the only option.
- Credit at the till was labelled "Lipa baadaye" and only appears after a
  customer is added, so testers thought it was missing. Open tills kept old
  settings until a reload.
- On phones the held carts were hidden behind the cart bar.
- The menu showed a shortened ID that people retyped into the sales tool.
- Found to be the old v1 app, not v2: the sales import template.

### Implementation status
- [x] Migration 000057: sale void columns and `fiscal_credit_notes`.
      `POST /api/sales/:id/void` (`sales:delete`, reason required) puts stock
      back, reverses the sale entry, and queues an EFD credit note when the
      receipt was sent (drops it when never sent; refuses while sending).
      Voided sales are left out of totals, reports, customer debt and
      catch-up.
- [x] Migration 000058: `journal_entries.paid_to_user_id`. Money out takes
      Paid to; `GET /api/accounting/people`. Entries return the party name and
      who was paid.
- [x] Screens:
  - Void sale in sales history;
  - Money → Show → Everything in all modes, with names and source links;
  - Paid to (required for Salaries);
  - Mkopo wording and the add-customer hint;
  - settings re-read on focus;
  - the phone cart bar;
  - click-to-copy ID.
- [x] Team guides: `where-is-it.md` (new), `recording-expenses.md`,
      `subscriptions.md`, `sales-tool.md`.
- [x] PRs: balceinv-api #74, balceinv #48.

### Verification performed
- `go vet ./...`, `go test ./...` on SQLite and Postgres. New tests cover
  voiding (with and without an EFD receipt) and paid-to with party names.
- `node scripts/locales.check.ts`, `pnpm generate`.
- Web preview with books on:
  - voiding a sale of 4 showed the banner, set sales to 0 and put the stock
    back to 30;
  - Money → Everything listed the sale, the cancellation and the stock
    change, with a link to the receipt;
  - a salary saved as "Paid to Check Owner";
  - the payment box showed the credit hint;
  - the phone bar read "Cart 1 · 1 item".

### Manual follow-up required
- With a real EFD provider: void a sale whose receipt was accepted and check
  the provider accepts the credit note (document_type `credit_note`,
  original receipt number and reason).
- Ask testers to retest on v2.0.5 using `docs/team/where-is-it.md`.

## Phase 33: permanent product delete and refunds (2026-10-08)

### Findings being fixed
- Products could only be archived. Products made by mistake stayed forever.
- Mistakes found after a sale could only be fixed by voiding the whole sale.
  There was no partial return.

### Implementation status
- [x] `POST /api/products/delete` deletes one or many products with their
      variants when they never appear on a sale (including voided), purchase,
      purchase order, supplier return, customer order or transfer. Opening
      stock in the books is reversed first. Used products are skipped with a
      reason. Products page: tick boxes, bulk bar, "Delete permanently";
      archive is called Archive / Weka kando again.
- [x] Migration 000059: `sale_refunds`, `sale_refund_lines`,
      `fiscal_refund_notes`. `POST /api/sales/:id/refunds` (`sales:edit`)
      refunds quantities per line by cash, card, mobile or off the customer's
      debt, optionally restocking. It reverses money, sales and VAT (and
      restocked cost) in the books under the existing `sale_void` source type,
      because the SQLite source-type check cannot be changed safely. Customer
      debt, sales totals and the summary subtract refunds. An EFD refund note
      is sent after the original receipt is accepted.
- [x] Sales history: Refund panel and refund history on the sale; Takings
      card shows refunds.
- [x] `docs/team/where-is-it.md` updated.
- [x] PRs: balceinv-api #75, balceinv #49.

### Verification performed
- `go vet ./...`, `go test ./...` on SQLite and Postgres. New tests cover
  delete (unused, sold, variants, other business, books, permission) and
  refunds (partial and rest, retry, stock, limits, credit, debt, void
  blocked, voided refused, totals, summary, EFD refund note).
- `node scripts/locales.check.ts`, `pnpm generate`.
- Web preview:
  - deleting 3 products with one sold gave "2 deleted, 1 kept";
  - refunding 1 of 3 showed the refund on the sale, put stock from 17 back to
    18, and the Takings card showed the refunds.

### Manual follow-up required
- Refunds recorded while the books are off are not caught up later; start
  the books before taking refunds if they should appear there.
- With a real EFD provider, refund part of a sale whose receipt was accepted
  and check the provider accepts the refund note.

## Phase 34: feature pages, screenshots and the bugs found writing them (2026-10-09)

### Findings being fixed
- No single place explained each recent feature, why it came, what was
  removed and how it works. `docs/team/README.md` still listed voiding a sale
  as planned.
- A refund's entry on Money linked to `/receipts/<refund id>`, which does not
  exist (`frontend/app/components/money/EntryDetailsDialog.vue`).
- A refund to the customer's account was capped by the sale's credit only,
  so after the customer paid the debt it could leave them owed money
  (`backend/internal/sales/refund.go`).
- Bulk delete counted products ticked on every page but sent only the
  current page's (`frontend/app/pages/products/index.vue`).
- "Paid to is required for salaries" was checked by the screen only
  (`backend/internal/accounting/service.go`).
- EFD credit notes for a void and for a refund looked the same
  (`backend/internal/sales/fiscal.go`).

### Implementation status
- [x] `docs/features/`: README with release history, and pages for the
      Windows sign-in fix, cashier discounts, void, refunds, product delete,
      Money and the books, till and receipts; 16 screenshots from a local web
      preview with test data.
- [x] Entries carry `source_sale_id` (the sale for sales, voids and refunds);
      the Money link uses it.
- [x] A refund to the account is also capped by the customer's current
      balance (`customers.Service.Balance`).
- [x] The products page keeps the ticked products themselves across pages.
- [x] A salary without `paid_to_user_id` gets 400 `paid_to_required`, with an
      English and Kiswahili message.
- [x] EFD credit notes carry `credit_for`: `void` or `refund`.
- [x] Team handbook links the feature pages; "Voiding a sale" removed from
      Planned.
- [x] PRs: balceinv-api #76, #77, #78; balceinv #50, #51, #52.
- [ ] Admin panel: paused. Started on a local branch, not pushed (see the
      session report).

### Verification performed
- Backend, on each branch: `go vet ./...` and `go test ./...` on SQLite and
  Postgres. New checks: refund entries return the sale as `source_sale_id`;
  a refund to the account after the customer paid is refused with
  `refund_credit_not_possible`; a salary with no Paid to is refused with
  `paid_to_required`; void and refund credit notes carry `credit_for`.
- Frontend: `pnpm build`, `pnpm generate`, `node scripts/locales.check.ts`.
  (`nuxi typecheck` cannot run here: the vue-tsc it fetches does not match
  the installed TypeScript; it is not part of the build.)
- Web preview with all six branches built in (local Postgres, test data):
  - a refund's entry on Money showed "Open the receipt →" to
    `/receipts/<sale id>` and opened SALE-20261008-0001;
  - Money out for Salaries with no Paid to returned 400 `paid_to_required`;
  - with 52 products (two pages), ticking one on page 1 and a sold one on
    page 2 and deleting gave "1 deleted, 1 kept" and 51 products.

### Manual follow-up required
- Desktop shops get these fixes in v2.0.7.
- With a real EFD provider, check it accepts (or ignores) the new
  `credit_for` field.

## Manual follow-up required
- The first run of "Deploy cloud" happens when this PR merges into `main`;
  watch it in GitHub Actions.
- Anyone who can change workflows in this repository can use the deploy key,
  which logs in as root. Keep write access to the owner and trusted team.
- Before tagging a desktop release, add the `SUPPORT_SMTP_PASSWORD` secret;
  without it, support messages from desktop apps wait until a later release.

## Manual follow-up required
- Add the route `pos.faltasi.com` → `http://localhost:8080` in Networking →
  Tunnels → balce-server → Routes.
- Sign-up can be shut off at once by a Cloudflare WAF rule blocking
  `POST /api/setup` if it is abused; Turnstile on the setup form is the
  upgrade if bots appear.

## Manual follow-up required
- Add `SUPPORT_SMTP_PASSWORD=<Yahoo app password>` to
  `/opt/balce/.env.prod` and run `deploy.sh`; until then support messages
  wait in the database.
- Create the first cloud company:
  `docker exec balce-api /balce-admin create-company -business-name "…" -owner-name "…" -owner-email "…"`
  (it prints a one-time password; the owner must change it at first sign-in).
- The tunnel token was shared in chat: refresh it in Networking → Tunnels →
  balce-server, then `cloudflared service uninstall` and install again with
  the new token.
- SSH (22) stays open to the internet with password login, by the owner's
  decision.

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
