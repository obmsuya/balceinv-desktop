# Balce Inventory — working conventions

Read this before touching code. It describes how this codebase is actually
written today, not an aspirational style guide — match what's already here.

## Stack

- **Shell**: Tauri v2 (`src-tauri/`, Rust). Ships a Go binary as an
  `externalBin` sidecar (`bin/backend`).
- **Backend**: Go 1.25, Fiber v2, GORM over SQLite (`glebarez/sqlite`).
  Layered `handlers/ → services/ → repository/ → models/`.
- **Frontend**: Nuxt 4 / Vue 3 `<script setup lang="ts">`, shadcn-vue
  components, `vue-sonner` for toasts, one composable per domain
  (`useProducts`, `useSettings`, `usePrint`, …).

## Go backend discipline

- **Descriptive names, no abbreviations.** `hardwareIdComputeError`, not
  `err`; `receiptBytes`, not `data`. Loop vars can stay short (`i`) only in
  genuinely trivial loops.
- **Every fallible call gets its own named error var and is checked
  immediately** — no `if err := f(); err != nil` chains stacked three deep.
  Wrap with `fmt.Errorf("... : %w", err)` so the caller/log has context.
- **Handlers stay thin.** Parse/validate input, call one service method,
  translate the result/error to `utils.Success` / `utils.Error`. Business
  logic lives in `services/`, DB access in `repository/`.
- **Comments explain *why*, not *what*.** See
  `backend/services/print_service.go` (`buildReceipt`) and
  `backend/models/settings.go` (printer field block) for the pattern: a
  short comment above a field/func only when the reasoning isn't obvious
  from the code itself (e.g. why a raw device path is expected, why a
  buffer is passed instead of the bufio.Writer).
- **GORM models list column mapping and defaults explicitly** —
  `gorm:"column:x;default:y"` — even when it matches the zero value, because
  the frontend forms rely on knowing the exact default.
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
