# Balce Inventory — working conventions

Read this before touching code. It describes how this codebase is actually
written today, not an aspirational style guide — match what's already here.

## Stack

- **Shell**: Tauri v2 (`src-tauri/`, Rust). Ships the Go server
  (`backend/cmd/server`) as an `externalBin` sidecar (`bin/backend`) and
  bundles the generated frontend so LAN tills can load it.
- **Backend** (`backend/`, module `balceinv-api`): Go 1.26, Fiber v2,
  `database/sql` with raw SQL on two engines: SQLite through
  `modernc.org/sqlite` on the desktop and Postgres through `pgx` in the
  cloud. golang-migrate runs the embedded migrations in
  `migrations/{sqlite,postgres}` at startup. There is no ORM.
  - Layout: `cmd/server` (the app), `cmd/admin` (cloud company setup),
    `internal/<feature>/` with `domain.go`, `dto.go`, `repository.go`,
    `service.go`, `handler.go`, and `internal/common/` for shared pieces
    (database, httpx, response, storage…). The root `license/` package is
    the desktop hardware-ID license.
  - Every tenant table has `company_id`; Postgres enforces it with row-level
    security, set per request in the transaction middleware.
  - Tests: `testkit.ForEachEngine` runs each test on SQLite and, when
    `TEST_DATABASE_URL` is set, on Postgres.
- **Frontend** (`frontend/`): Nuxt 4 / Vue 3 `<script setup lang="ts">`
  (SPA, `ssr: false`), shadcn-vue components, `vue-sonner` for toasts, one
  composable per domain (`useProducts`, `useSettings`, `usePrint`, …).
  - Text goes through `t()` from `useI18n()` (English and Kiswahili, JSON in
    `app/locales/<lang>/<area>.json`).
  - Swahili terms follow `app/locales/glossary.md`: notifications are
    "taarifa".
  - `node scripts/locales.check.ts` must pass.

## Go backend discipline

- **Descriptive names, no abbreviations.** `hardwareIdComputeError`, not
  `err`; `receiptBytes`, not `data`. Loop vars can stay short (`i`) only in
  genuinely trivial loops.
- **Every fallible call gets its own named error var and is checked
  immediately** — no `if err := f(); err != nil` chains stacked three deep.
  Wrap with `fmt.Errorf("... : %w", err)` so the caller/log has context.
- **Handlers stay thin.** Parse/validate input, call one service method,
  translate the result/error to `response.Success` / `response.Error` with a
  stable error `code` (the frontend translates by code). Business logic lives
  in `service.go`, SQL in `repository.go`.
- **No inline code comments** (the owner's rule). Names and small functions
  carry the meaning.
- **Migrations come in pairs per engine**, append-only, with explicit column
  defaults, because the frontend forms rely on knowing the exact default.
- No new dependency for something the stdlib or an already-imported package
  can do. The one exception worth taking: cross-platform serial/USB port
  enumeration has no reasonable stdlib equivalent (Windows registry vs.
  Linux `/sys` vs. macOS IOKit) — a small, well-maintained library is the
  lazy-correct choice there, not three OS-specific code paths.

## Frontend discipline

- Composables own all API calls and state for their domain; pages never
  call `$apiFetch` directly.
- Every mutating action in a composable does try/toast-success →
  catch/toast-error → finally/loading-false. **The success toast only fires
  after the awaited call resolves** — never before or unconditionally
  (this is exactly what's broken in `downloadTemplate` today; don't repeat
  it anywhere else).
- Settings page forms are annotated with a one-line comment stating which
  backend fields they actually send (see `settings/index.vue` — e.g.
  `// Only the three mapped receipt booleans are sent to the backend.`).
  If a UI control doesn't yet reach the backend, **say so in a comment**,
  don't leave it silently decorative.
- Detail dialogs render everything the list/detail API returns rather than
  hand-picking fields — that's why category/metadata already show up for
  products; keep new detail views the same way.

## Ponytail rules (apply throughout)

- Ladder before writing anything: does it need to exist → already in the
  codebase → stdlib → native platform feature → already-installed dep →
  one line → minimum code.
- No speculative abstraction (no interface for one implementation, no
  config knob for a value that never changes).
- Root-cause fixes over symptom patches: when a bug traces back to a shared
  function or pattern (e.g. "toast fires before the async result is known"),
  fix the pattern everywhere it appears, not just the one reported spot.
- Deliberate corner-cuts get a `# ponytail:` / `// ponytail:` comment naming
  the ceiling and the upgrade trigger.

## Testing / verification discipline

Every fix round gets a `steps.md` (or dated variant) with:
1. Findings being fixed, each with file paths.
2. An implementation status checklist, checked off as work lands.
3. A **Verification performed** section — concrete commands run
   (`go build ./...`, `go vet ./...`, `pnpm build`, `pnpm generate`) and
   what they confirmed. Don't claim something "works" without a command or
   an observed behavior backing it.
4. A **Manual follow-up required** section for anything that needs a real
   device, a real OS, or human eyes (e.g. plugging in a physical thermal
   printer) — state exactly what to plug in and what to check for.

For hardware-facing code (printer discovery/connect, port writes): a
runnable self-check is not optional. At minimum, ship a debug/status
endpoint or CLI path that lists what was detected and why a given port was
chosen, so a plugged-in device can be confirmed without trusting the UI
alone.

## Commit hygiene

- Never add a `Co-Authored-By: Claude` trailer — this is a client-facing
  repo, no bot attribution in commits.
- New commits, not amends, unless explicitly told otherwise.
