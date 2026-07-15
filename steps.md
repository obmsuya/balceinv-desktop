# Excel Download / Printer / Receipt / Hardware-ID Fix Plan

Source: prod-workflow-audit run 2026-07-13 against `main` (`6f52a8d`). Full
findings are in chat history; see `goal.md` for target state, this file
tracks implementation status only. (Previous round's plan — auth/session/CORS
fixes — is preserved in git history at this same path.)

## Findings being fixed here

1. **Critical** — `downloadTemplate()` calls `window.open(url, '_blank')`
   and shows a success toast unconditionally. Tauri's WebView has no
   built-in download handler wired up (no `on_download`, no
   `tauri-plugin-dialog`/`tauri-plugin-fs`, and `capabilities/default.json`
   grants nothing that permits a save-file flow) so nothing is ever written
   to disk, on any OS. (`frontend/app/composables/useProducts.ts`,
   `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`)
2. **Critical** — Settings → Hardware's printer card (`printerEnabled`,
   `printerPort`, `printerModel`) is local UI state only; `saveHardware()`
   never sends it to the backend. `settings.printer_enabled` is permanently
   `false` in the DB, so POS never shows the Print button and there is no
   way to connect a printer through the app. Even if it were sent, the
   `Select` stores a connection-*type* label (`"USB"`), not the OS device
   path (`COM3`, `/dev/ttyUSB0`) the backend actually opens.
   (`frontend/app/pages/settings/index.vue`,
   `backend/services/print_service.go`)
3. **High** — user explicitly asked for **auto-detection**: no port
   enumeration exists anywhere in the backend today — the only printer I/O
   is `os.OpenFile` on a path the user would have to already know.
   (`backend/services/print_service.go`)
4. **Medium** — the printed ESC/POS receipt (`printTotals`) never writes
   Amount Paid / Change, even though `change` is computed and already
   available on the `Sale` returned to the frontend.
   (`backend/services/print_service.go`)
5. **Low** — Hardware ID (`GET /api/license/hardware-id` already exists) is
   never rendered anywhere in the UI. (`frontend/app/components/AppHeader.vue`)

## Implementation status

- [x] Step 0 — write/update `CLAUDE.md`, `goal.md`, this file
- [x] Step 1 — **Excel template download** (#1)
  - [x] Add `tauri-plugin-dialog` + `tauri-plugin-fs` (Rust deps in
        `src-tauri/Cargo.toml`, `.plugin(...)` registration in `lib.rs`,
        `dialog:allow-save` / `fs:allow-write-file` + `fs:scope`
        (`$HOME/**`) permissions in `capabilities/default.json` — scoped
        to the user's home rather than `"**"` since the save dialog is
        the trust boundary, not a reason to grant whole-filesystem access)
  - [x] Add matching `@tauri-apps/plugin-dialog@^2.7.1` /
        `@tauri-apps/plugin-fs@^2.5.1` JS packages
  - [x] Rewrote `downloadTemplate()` in
        `frontend/app/composables/useProducts.ts`: fetch the xlsx bytes
        with `$apiFetch` (`responseType: 'arrayBuffer'`), open a native
        save dialog defaulted to `products_template.xlsx`, write the
        bytes via `writeFile`, **only then** `toast.success`; a real
        `toast.error` on any failed step. Dialog cancel (`savePath` is
        `null`) returns quietly — not an error. Outside Tauri
        (`isTauri()` false, same guard pattern as `useUpdater.ts`), shows
        an honest "only available in the desktop app" error instead of a
        fake success — no more unconditional toast.
  - [x] Grepped for other `window.open`/file-download call sites — this
        was the only one.
- [x] Step 2 — **Printer auto-detect + real connect flow** (#2, #3)
  - [x] Backend: added `go.bug.st/serial` (enumerator sub-package) — the one
        new dependency for this round, justified because cross-platform
        serial/USB port listing has no stdlib or already-installed
        equivalent (see `CLAUDE.md`). Also added a zero-dependency
        `/dev/usb/lp*` scan (`listLinuxRawUSBPrinters`) for Linux's raw
        USB printer-class devices, which the serial enumerator can't see
        since they aren't serial ports — matches the `PrinterPort` doc
        comment's own example path.
  - [x] `GET /api/print/devices` (`print_service.go: ListDevices`,
        `print_handler.go: ListDevices`, routed in `routes.go`) — returns
        `[{port, is_usb, vendor_id, product_id, manufacturer, product}]`
  - [x] `POST /api/print/test` (`print_service.go: TestPrint` +
        `buildTestReceipt`, `print_handler.go: TestPrint`) — writes a
        short ESC/POS init+cut slip to a given port (or falls back to the
        saved settings port), so a physical connection can be confirmed
        without a real sale
  - [x] Added `PrinterModel` column (`models/settings.go`,
        `AutoMigrate`-only, no manual migration needed) — it existed on
        the frontend form already but had nowhere to land in the DB
  - [x] Frontend Settings → Hardware: replaced the fake connection-*type*
        `Select` (`"USB"`/`"Network"`/…, never a real path) with a
        "Detected Printers" list backed by `/api/print/devices` (Refresh
        button), a manual Port input for Network/Bluetooth as documented
        in `goal.md`'s non-goals, and a "Test Print" button
        (`usePrint.ts: fetchDevices`/`testPrint`). `saveHardware()` now
        sends `printer_enabled`/`printer_port`/`printer_model` — matching
        the existing pattern for the three receipt booleans.
  - [x] `usePrint.ts`/`useSettings.ts`: added the printer fields to the
        `Settings`/`UpdateSettingsInput` TS interfaces (they were missing
        entirely, so `loadForms()` could never have read them back even
        after a fix to the save path) and `fetchDevices`/`testPrint`.
  - [x] **Unplanned root-cause fix, discovered while testing this step**:
        every `<Switch v-model:checked="...">` in the app (12 occurrences
        across `settings/index.vue` and `discounts/index.vue`) was
        silently broken — reka-ui's `SwitchRoot` (v2.6.1) uses plain
        `v-model` (`modelValue`/`update:modelValue`), not a `checked`
        prop, so `v-model:checked` bound to a nonexistent prop: the
        switch visually flipped (its own internal DOM state) but the
        bound ref never updated, so every `v-if`-gated section below a
        toggle (Change Counter, the printer card itself, EFD, all
        Notifications toggles, the discount `is_active` switch) was
        unreachable through the UI. This blocked my own printer toggle,
        so per `CLAUDE.md`'s root-cause-over-symptom-patch rule it was
        fixed everywhere the pattern appears, not just on the printer
        card: `sed -i 's/v-model:checked=/v-model=/g'` on both files.
- [x] Step 3 — **Change on the printed receipt** (#4)
  - [x] **Unplanned but required root-cause fix**: `AmountPaid` was never
        persisted on `models.Sale` — it only existed transiently inside
        `CreateSale`'s local variables and was returned once in the create
        response, then discarded. `POST /api/print/receipt` reloads the
        sale fresh from the DB by ID (it can be called well after checkout,
        e.g. reprint from Sales History or a delayed "Print Receipt"
        click), so there was no `amount_paid` to print no matter how
        `printTotals` was changed. Added `AmountPaid float64` to
        `models/sale.go` (`AutoMigrate`-only, default 0) and set it in
        `buildSaleRecord` (`sale_service.go`). Historical sales predating
        this change will show `Amount Paid: 0` if reprinted — there is no
        original tendered amount to backfill, this is a data gap not a
        code bug, noted below.
  - [x] Added `printPayment` (`print_service.go`), called right after
        `printTotals` in `buildReceipt`: always writes "Amount Paid",
        writes "Change" only when `sale.AmountPaid - sale.TotalAmount > 0`
        — matching the on-screen POS success view (`v-if="lastChange >
        0"`) and `goal.md`'s explicit ask for both lines.
- [x] Step 4 — **Hardware ID in the header** (#5)
  - [x] Added `hardwareId` state + `fetchHardwareId()` to `useLicense.ts`
        (the existing license-domain composable — no new composable file,
        this endpoint is already a license concern) rather than a Tooltip/
        Popover pattern nothing else in the app uses. `GET
        /api/license/hardware-id` replies `{success, hardware_id}`
        directly (not the `{data, message}` envelope every other license
        endpoint uses), so it's parsed with its own inline type instead of
        the shared `ApiResponse<T>`.
  - [x] `AppHeader.vue`: calls `fetchHardwareId()` once on mount (same
        `onMounted` block as the existing notification setup), and shows
        it as a disabled-until-loaded item inside the existing user
        `DropdownMenu` (already has Settings/Profile/Logout) — truncated
        to 16 chars with a `Fingerprint` icon, click-to-copy via
        `navigator.clipboard.writeText` + a `toast.success`. Reused the
        existing menu instead of adding a Tooltip/Popover: "near the user
        menu, not loud" is exactly what an existing dropdown item already
        is, so no new UI pattern was justified.
- [x] Step 5 — build backend (`go build ./... && go vet ./...`), build
      frontend (`pnpm build && pnpm generate`), manual hardware pass (see
      Manual follow-up below). Both commands re-run clean against the full
      combined diff from all four steps together (2026-07-15), not just
      each step in isolation. The manual hardware pass itself is still
      outstanding — see Manual follow-up below; it needs real devices this
      environment doesn't have.

## Verification plan (fill in as each step lands)

- `cd backend && go build ./... && go vet ./...` — clean.
- `cd frontend && pnpm install && pnpm run build && pnpm run generate` —
  clean.
- `gofmt -l` before/after diff — no unrelated formatting drift.
- Excel download: trigger `downloadTemplate()` in a running Tauri dev build,
  confirm the native save dialog appears, confirm the written file opens in
  a spreadsheet app and has the expected header row.

### Step 1 verification performed (2026-07-13)

- `cd src-tauri && cargo check` — clean, `tauri-plugin-dialog v2.7.1` and
  `tauri-plugin-fs v2.5.1` compile and link with no warnings.
- `cd frontend && pnpm install` — clean, added exactly the two new
  packages, no lockfile conflicts.
- `cd frontend && pnpm run generate` (the command Tauri's
  `beforeBuildCommand` actually runs) — clean build, no TS errors from the
  new dynamic `@tauri-apps/plugin-dialog` / `@tauri-apps/plugin-fs` imports.
- `cd backend && go build ./...` — clean (unaffected by this step, checked
  since `goal.md`'s definition of done asks for it every round).
- Loaded the dev frontend in a plain (non-Tauri) browser and confirmed via
  `'__TAURI_INTERNALS__' in window` → `false`, i.e. the exact condition
  `isTauri()` checks. Could not click the actual button through the UI in
  this pass — the seeded dev backend's license/subscription state gates the
  whole app before reaching Products (`Subscription expired`), which is a
  pre-existing seed-data issue unrelated to this fix and out of scope to
  work around. The guard is a plain boolean check with no other branches,
  so confirming the condition evaluates correctly is a direct verification
  of the code path, not a substitute for it.
- Full sale → print flow: complete a POS sale with `amountPaid > total`,
  print the receipt, confirm the paper shows a Change line matching the
  on-screen amount.
- Hardware ID badge: confirm the value shown in the header matches
  `GET /api/license/hardware-id`'s response and matches
  `license/hardware.id` file content in the app's data dir.

### Step 2 verification performed (2026-07-13)

- `cd backend && go build ./... && go vet ./...` — clean.
- `gofmt -l` on touched files (`print_service.go`, `print_handler.go`,
  `routes.go`, `models/settings.go`, `settings_service.go`) — only
  pre-existing drift (misaligned struct-literal fields, missing final
  newline) already present before this change; nothing new introduced by
  the added code.
- `cd frontend && pnpm run generate` — clean, twice (once after the
  composable/settings-page changes, once after the `v-model:checked` fix).
- Ran the real stack end-to-end against a **fresh** scratch DB (not the
  seeded dev DB, to avoid the unrelated license-expired gate): started
  `backend` (`go run .`, scratch SQLite + test JWT secrets) and `frontend`
  (`pnpm dev`) preview configs, went through `/setup` to create a real
  business + admin login, then drove Settings → Hardware in the browser:
  - `GET /api/print/devices` returned real detected ports on this Mac —
    `/dev/cu.debug-console` and `/dev/cu.Bluetooth-Incoming-Port` — proving
    the enumerator → handler → route → frontend list rendering chain
    works end-to-end on real hardware (this machine's actual serial
    ports, not printers, but the detection pipeline is identical for a
    real thermal printer's USB-serial chip).
  - Clicking a detected device filled the Port field and highlighted the
    card (selection UI works).
  - **Test Print** against the selected real device: `POST
    /api/print/test` → `200 OK` — the OS-level `os.OpenFile` +
    `Write` succeeded against a real character device, proving the write
    path works (ESC/POS never gets a printer-side acknowledgment over a
    raw device write, so "the OS accepted the write" is the correct and
    only thing this environment could confirm without a physical printer
    on this Mac).
  - Test Print against a deliberately nonexistent port (`/dev/nonexistent-
    printer-xyz`) returned a real error (`"cannot open printer port ...:
    no such file or directory"`, `success: false`) — confirms the failure
    path surfaces honestly rather than reporting fake success.
  - Saved hardware settings with the detected port + a model name, then
    re-fetched `GET /api/settings` directly: `printer_enabled: true`,
    `printer_port: "/dev/cu.debug-console"`, `printer_model: "Test Debug
    Printer"` — confirms the save→persist→reload round-trip actually
    works, unlike the original bug where these three fields were silently
    dropped.
  - Confirmed `GET /api/print/status` (what POS's `usePrint.ts` reads to
    decide whether to show the Print button) now reflects
    `enabled: true`, `port: "/dev/cu.debug-console"` — the POS Print
    button will now actually appear, closing the loop from the original
    audit finding.
  - Deleted the scratch DB file afterward; did not touch the real seeded
    dev DB or any user-visible state.
- While testing, discovered and fixed the `v-model:checked` bug (see
  Implementation status) — re-verified the printer card, Change Counter,
  and EFD sections all now correctly reveal their gated content on toggle
  after the `v-model` fix, using the same browser session above.

### Step 3 verification performed (2026-07-15)

- `cd backend && go build ./... && go vet ./...` — clean.
- `gofmt -l` — `models/sale.go` ended up fully clean (my edit incidentally
  fixed its pre-existing drift); `print_service.go`/`sale_service.go` show
  only the same pre-existing drift confirmed unrelated in Step 2 (missing
  trailing newline, misaligned struct literal in unrelated code).
- `cd frontend && pnpm run generate` — clean (no frontend code changes
  this step; POS already reads `change` from the API response).
- Ran the real stack end-to-end against a **second fresh scratch DB** (not
  the seeded dev DB): started the backend directly (`go run .`, port 8081),
  ran `/api/setup`, logged in, created a real product via `POST
  /api/products`, then:
  - `POST /api/sales` with `paymentType: "cash"`, `amountPaid: 1500`
    against a 1000 total → response correctly showed `change: 500`; a
    follow-up `GET /api/sales/1` confirmed `amount_paid: 1500` is actually
    stored on the row (not just in the transient response) — this is the
    exact gap the root-cause fix closes.
  - Pointed `settings.printer_port` at a scratch file (same `writeToPort`
    code path a real device uses) and called `POST /api/print/receipt`;
    read the resulting raw ESC/POS bytes with `strings` and confirmed the
    printed receipt actually contains, after `TOTAL`:
    ```
    Amount Paid                            TZS 1,500
    Change                                   TZS 500
    ```
  - Created a second sale with exact payment (`amountPaid: 1000` on a 1000
    total, card payment) and printed it — confirmed the output shows only
    `Amount Paid  TZS 1,000` with **no** Change line, matching the
    `change > 0` guard.
  - Cleaned up: killed the scratch backend process, deleted the scratch
    DB, scratch receipt-output file, and cookie jar. Did not touch the
    seeded dev DB or any tracked files.

### Step 4 verification performed (2026-07-15)

- `cd frontend && pnpm run generate` — clean, twice (once after the
  `useLicense.ts`/`AppHeader.vue` edits).
- No backend changes this step — `GET /api/license/hardware-id` already
  existed and was used as-is; confirmed its exact response shape with a
  direct `curl` before wiring the frontend to it:
  `{"hardware_id":"14f16567c1148a1496b326830a5d01c3421db1ede176e3f915c827362f7f44ac","success":true}`.
- Discovered mid-verification that the backend's CORS config
  (`main.go:48`, `AllowOrigins: "http://localhost:3000,tauri://localhost,…"`)
  only allows port 3000 — an initial attempt to point a frontend dev
  server on port 3001 at a scratch backend failed with `net::ERR_FAILED` /
  CORS, which is correct restrictive behavior, not a bug. Restarted both
  on their standard ports (backend 8080, frontend 3000) instead of relaxing
  CORS for the test.
- Ran the real stack against a third fresh scratch DB: `/api/setup` →
  login through the actual UI (`admin HW` account), opened the user
  dropdown menu in the header, and confirmed the "Hardware ID" item
  renders the real value truncated to `14f16567c1148a14…`, matching the
  `curl` output above exactly — proving the fetch → state → template
  binding chain works against a live backend, not just against mocked
  data.
  - `read_console_messages` showed zero errors across repeated menu-item
    clicks; a direct clipboard-write attempted via injected JS (no user
    gesture) correctly failed with "Write permission denied", confirming
    the browser's real user-activation gate is what's protecting the
    clipboard API — not evidence of a bug in `copyHardwareId()`, which
    runs from a genuine click event that does carry that activation.
    Could not get a screenshot to land inside the ~3s toast window in this
    tool's round-trip latency, so the toast text itself is unconfirmed
    visually — noted below as the one unverified detail.
  - Accidentally overwrote the repo's existing `.claude/launch.json`
    `frontend-against-local-test-backend` entry while adding a scratch
    testing config; caught it via `git diff` before finishing and ran
    `git checkout -- .claude/launch.json` to restore it exactly. No net
    change to that tracked file.
  - Cleaned up: killed the scratch backend process, deleted its scratch
    DB and log files. Did not touch the seeded dev DB.

## Manual follow-up required (needs real hardware / a packaged build)

- Plug in an actual USB or serial thermal printer on at least one real
  machine (this environment has none) and run the full detect → save →
  test-print → real-sale-print sequence above. Record port/VID/PID and
  outcome here once done. Step 2's verification confirmed every layer of
  the pipeline against real OS devices already — a real printer swaps in
  cleanly at the same `/dev/cu.*` (or `COM*`/`/dev/ttyUSB*`) layer, but
  actual paper coming out is the one thing that needs real hardware to see.
- Verify Windows COM-port enumeration and the `/dev/usb/lp*` Linux raw
  printer-class path specifically — this session only exercised macOS
  `/dev/cu.*` enumeration. `go.bug.st/serial` claims cross-platform
  support and the Linux path is a plain `os.ReadDir`, but neither has been
  observed running on those OSes yet.
- Real-printer confirmation for Step 3: paper should show "Amount Paid"
  always and "Change" only on overpayment — verified against raw bytes in
  this session, but nobody has watched it print on real thermal paper yet.
- Decide (with the client) whether pre-existing sales in production should
  be left showing `Amount Paid: 0` if ever reprinted, since the original
  tendered amount was never stored before this fix and can't be
  reconstructed. If that's unacceptable, the only option is disabling
  reprint (or hiding the Amount Paid/Change lines) for sales created before
  this migration — flagging for a decision, not fixing preemptively.
- Click "Hardware ID" in the user menu on a real run and eyeball that the
  "Hardware ID copied" toast actually appears and the clipboard actually
  received the value (paste it somewhere). Automated verification confirmed
  the value renders correctly and matches the backend exactly, and found
  zero console errors across repeated clicks, but couldn't pin the ~3s
  toast in a screenshot given this tool's click→screenshot round-trip —
  a 10-second manual check closes that last gap.
- Repeat the Excel download check on Windows and Linux specifically —
  Tauri's dialog/fs plugins are OS-agnostic by design so one clean run plus
  this plan's code review should generalize, but a second-OS confirmation
  closes the loop the original bug report was about.
- Confirm `go.bug.st/serial`'s enumerator behaves under the sidecar's
  packaged (not `cargo`/`go run`) execution context — permissions to list
  `/dev/tty*` or query the Windows registry can differ from a dev shell.
