# v1.0.18: Smooth In-App Updates on Every Platform

Previous rounds (v1.0.17 backup/restore, tabs) are preserved in git history
at this same path.

## Findings being fixed here

1. "Download Update" in Settings did nothing after the header's automatic
   check found an update. The found `Update` object lived in a per-call
   `let` inside `useUpdater()`, so the header's copy had it and the
   Settings page's copy was `null`, and `downloadAndInstall` returned
   silently. (`frontend/app/composables/useUpdater.ts`)
2. Windows: the updater leaves the app with `std::process::exit(0)`
   (tauri-plugin-updater 2.10.1 `updater.rs:865`), which skips our
   `RunEvent::Exit` handler, so the Go sidecar `backend.exe` kept running.
   The NSIS installer only asks Restart Manager to close
   the main app executable (`CheckIfAppIsRunning`), so copying the locked
   `backend.exe` failed with "Error opening file for writing", or the old
   backend kept serving the new UI. (`src-tauri/src/lib.rs`, installer)
3. Intel Macs had no installer and no update: the release matrix built
   only for the runner's arch, and `latest.json` had only
   `darwin-aarch64`. (`.github/workflows/release.yml`)
4. The "Update available" toast opened Settings on the Business tab, and
   the download showed no progress or explanation.

## Implementation status

- [x] `pendingUpdate` moved to module scope, and `downloadAndInstall`
      re-checks if it is missing.
- [x] Install flow: download with a % progress bar → save a backup on
      this PC (`useBackup().saveBackupOnThisPC`) → on Windows
      `invoke('stop_backend')` → `update.install()` → relaunch. If install
      fails after the backend was stopped, the app relaunches so the
      backend comes back.
- [x] `stop_backend` Tauri command kills the sidecar and waits 800 ms.
- [x] NSIS `NSIS_HOOK_PREINSTALL` (`src-tauri/windows/hooks.nsh`) stops
      the `backend.exe` whose path is `$INSTDIR\backend.exe`, before any
      file is copied. This runs inside the new installer, so it also fixes
      updates started from v1.0.17 and older, whose updater code cannot
      change.
- [x] Release matrix builds `aarch64-apple-darwin` and
      `x86_64-apple-darwin` separately; Rust targets installed on macOS
      runners.
- [x] Update toast and header check open `/settings?tab=updates`;
      settings tabs follow `?tab=`.
- [x] Updates card explains what happens ("backup first, closes and
      reopens by itself, data kept") and the button reads "Update and
      restart".

- [x] Header update indicator (`frontend/app/components/UpdateIndicator.vue`):
      a green "Update available" pill appears only when an update exists
      and stays until installed. Clicking it opens a card with "Update and
      restart" and live progress ("Updating 42%"). Checks at launch, every
      6 hours, and when the internet comes back, because POS PCs stay open
      for days. A toast shows once per new version. Background checks
      never flip the UI to "checking" or "error", and a failed install
      keeps the pill so the client can retry.

## Why data is not lost during an update

- The database, backups and license live in the app data folder
  (`%APPDATA%\com.balceinv.app`, `~/Library/Application Support/com.balceinv.app`,
  `~/.config/com.balceinv.app`). Installers only replace program files.
- A fresh local backup is saved right before installing.
- The in-progress cart is kept in webview storage, which survives updates.

## Verification performed

- `cd src-tauri && cargo check`: clean.
- `cd frontend && pnpm build`: clean.
- Release workflow YAML parses, and the matrix expands to 4 jobs.
- Browser: `/settings?tab=updates` opens directly on the Updates tab.
- Browser: the header pill, one-time toast and update card render in light
  mode, and the "Updating 42%" progress state in dark mode (update state
  set by hand, since the updater only runs inside the desktop app).
- v1.0.17 `latest.json` inspected: signed entries for windows
  (msi/nsis), linux (AppImage/deb/rpm) and darwin-aarch64 only, which
  confirms finding 3.
- Read the plugin and NSIS template sources to confirm findings 1 and 2
  (not reproduced on a Windows machine in this session).

## Manual follow-up required

1. Windows PC on v1.0.17 (installed with the `-setup.exe`). This PC still
   runs v1.0.17's updater code, so in Settings → Updates click "Check for
   Updates" first and then "Download Update". Expect: the installer
   progress bar with no "Error opening file for writing" box, then the
   app reopens on v1.0.18 with the same sales and products. Check in Task
   Manager that exactly one `backend.exe` is running afterwards. From
   v1.0.18 on, the toast → "Update and restart" path works in one click.
2. Windows PC installed with the `.msi`: same test. The NSIS hook does
   not apply to MSI. Updates from v1.0.17 may ask for a reboot to replace
   `backend.exe`; from v1.0.18 on, `stop_backend` handles it.
3. Apple Silicon Mac and Intel Mac: update from the toast and confirm the
   app relaunches by itself on the new version. The Intel Mac needs the
   v1.0.18 `x86_64` installer first, because no earlier Intel build
   exists.
4. Linux: AppImage and `.deb` install, then update. The `.deb` path asks
   for the admin password (the updater runs `dpkg -i`).

# Subscription payment audit and redesign (also in v1.0.18)

## Findings fixed

1. False "Payment received" during a trial or grace period: the old poll
   read `/api/license/status`, which already said `licensed: true`, so it
   passed within 4 s whether or not anything was paid, and nothing asked
   the server for the new expiry until the next app start.
2. Trial and grace banners were never visible: `fixed top-0 z-40` sat
   under the header (`fixed top-0 z-50`).
3. The grace banner showed days since expiry as "days left"
   (`Math.abs(days_remaining)`). Expired 1 day ago displayed "1 day left",
   when 4 remained.
4. "Subscribe" during a trial opened an empty plan list, because plans
   were only fetched when the app was locked.
5. A PC with a wrong date got "subscription expired" instead of "fix the
   date".
6. Stuck states: no way out of the 90 s waiting screen, "Check again"
   could start parallel polls, and no sign-out on the lock screen, so a
   cashier could not switch to an admin.
7. After an unlock, pages that failed with 402 stayed empty, and raw
   "license expired on …" error toasts stacked above the lock screen.
8. Friction: phone numbers with spaces or +255 were rejected, the network
   was picked from a dropdown, and the prompt said "MNO PIN".

## What changed

- Backend `license.CurrentStatus()`: one calculation with rounded-up days,
  real `grace_days_remaining`, and `lock_reason` (missing / expired /
  clock). New `POST /api/license/refresh` asks the server for this
  device's license (works while locked). Activation never replaces a
  paid license with an older one, and "offline" is a typed error with a
  plain message. The pay proxy validates phone, network and plan, and
  server 5xx or HTML answers become one plain sentence.
- Payment flow: Plan → Pay → Confirm. Plans get tiered icons (sprout /
  trees / crown), price per month, "Current" and "Best value" tags. The
  phone field is focused automatically, accepts any format, and formats
  as you type. Network buttons in each network's colour are picked from
  the prefix. The waiting screen has a timer, "Send again" after 30 s,
  and Cancel. Success is declared only when the server reports a new or
  longer license. "Not confirmed yet" warns not to pay twice.
- Lock screen: a reason-specific message, a payment flow for admins,
  "Sign in as admin" for cashiers, a copyable device ID, and sign-out.
  After any unlock it shows "All set" and reloads.
- Header: a card icon with a days-left badge (amber for trial or ending
  within 7 days, red for grace), a popover with Subscribe / Renew now,
  and one grace warning per session.
- Any 402 from the API re-checks the license at once, and toasts are
  hidden while the lock screen is up.
- The brand name was replaced with "POS" in all user-facing text. The
  installer product name and internal IDs were kept, because changing
  them would move the install folder and orphan existing data.

## Verification performed

- `go test ./license ./backup`: all license states (missing, paid,
  5 hours left, grace, expired, trial, clock set back), activation
  (trial upgrade, renewal saved, older copy ignored, offline detected).
- `node frontend/scripts/mobileMoney.check.ts`: phone normalizing for
  `0712…`, `+255 712…`, `255…`, `712…`, and bad input; network
  detection; duration and price formatting.
- `pnpm build`: clean.
- Live in the browser against the scratch backend and a fake licensing
  server that confirms payments 12 s after the request:
  - Trial: amber badge "10" → Subscribe → plans listed → `+255 754 123 456`
    became `0754 123 456` with M-Pesa auto-picked → still waiting at 6 s
    (no false success) → "Payment received, active until 26 October"
    after confirmation. The badge disappeared.
  - Grace: red badge "4" and a one-time warning with Renew. A declined
    payment showed the server's reason ("Insufficient balance…"). Typing
    and Enter worked with no clicks.
  - Expired: lock screen with plans, no stray toasts. Paying Quarterly
    with `688123456` (Airtel auto-picked) → "All set" → the app reloaded
    unlocked with data.
  - Wrong clock: the "computer's date is wrong" screen with Check again,
    and no payment option.
  - Licensing server down while locked: "No internet connection…" with
    Try again.
  - Cashier while locked: "Ask the owner or an admin", with a Sign in as
    admin button.
  - Plan tiles checked in light and dark mode.

## Manual follow-up required

- One real payment against production (`backend.wapangaji.com`) from a
  trial PC and from an expired PC, to confirm that
  `/balce/license/by-hardware/` returns the new expiry soon after the
  mobile money callback. The flow waits up to 2 minutes, then offers
  Check again.
- Confirm the prefix → network map with the sales team (Vodacom
  074/075/076, Tigo 065/067/071/077, Airtel 068/069/078, Halotel
  061/062). The cashier can always change the network by hand.

# Release v1.0.18

- Pushed backend `6c10d72..9706426`, frontend `0cb1055..222f9ae`, parent
  `7557908..450ffea`, then the annotated tag `v1.0.18`.
- Release run: https://github.com/obmsuya/balceinv-desktop/actions/runs/36250028047
  finished with all 4 jobs green: ubuntu-22.04, windows-latest,
  macos-latest `aarch64-apple-darwin`, and the new macos-latest
  `x86_64-apple-darwin`.
- `gh release download v1.0.18 -p latest.json -O -` shows version
  `1.0.18` with platforms `darwin-aarch64`, `darwin-x86_64`,
  `linux-x86_64` (AppImage, deb, rpm) and `windows-x86_64` (msi, nsis).
  Intel Macs now get updates through the updater from this version on.

# Common products catalog with hidden team tools

## Findings fixed

- The catalog never reached clients. `backend/seeds/*.json` were empty,
  and `services/setup.service.go` read them with a relative path that
  does not exist next to the installed sidecar, so the "Pick from
  Catalog" panel was always empty.
- Seeding would have failed anyway. GORM's multi-row insert writes
  `DEFAULT` for empty optional fields (`category`, `sub_category`),
  which SQLite rejects (`near "DEFAULT": syntax error`). Found live and
  covered by `repository/catalog_repository_test.go`.
- The sales and support team had no way to load or refresh a list.
- `handlers/catalog_handler.go` queried the database directly and
  ignored errors.

## Implementation status

- [x] `backend/seeds/seeds.go` embeds `seeds/*.json` in the binary.
- [x] `repository/catalog_repository.go`:
  - find and count, per business type;
  - replace, and merge by product name (ignoring case and spaces);
  - clear;
  - rows inserted one by one inside a transaction.
- [x] `services/catalog_service.go`:
  - Reads `.xlsx` and `.csv`, including semicolon CSVs and Excel's BOM.
  - Header aliases: `product name` → name, `selling price` → price,
    `sku` → sku prefix, `uom` → unit. Any other column becomes a detail
    (metadata), such as strength or form.
  - Prices like `TSh 1,500` or `500/=` are read correctly.
  - Skips blank rows. Reports empty names, repeated names and bad
    prices by row number.
  - Limit of 20,000 rows. Template download.
  - The bundled seed list is loaded at startup and at setup when the
    shop's list is empty.
- [x] `middleware/support.go`:
  - The `X-Support-Passcode` header is checked against a SHA-256 hash
    (`CompiledSupportPasscodeHash` via ldflags, or
    `BALCE_SUPPORT_PASSCODE_HASH`).
  - 5 wrong tries lock it for 1 minute.
  - Returns 503 "Team tools are not set up in this build" when no hash
    was built in.
- [x] Routes under `/api/catalog/team` (sign-in plus passcode):
  `GET summary`, `GET items`, `GET template`, `POST import`, `DELETE`.
  The client-facing `GET /api/catalog` is unchanged. CORS allows the
  new header.
- [x] `.github/workflows/release.yml` passes
  `secrets.SUPPORT_PASSCODE_HASH` to all four sidecar builds.
- [x] Frontend `utils/businessTypes.ts`: one business-type list with
  icons, now used by setup and team tools.
- [x] Frontend `composables/useCatalog.ts`:
  - client list cached with `useState`;
  - team unlock, import, clear, template and "Export for bundling"
    (JSON in the seed format);
  - file checks before upload (type, empty, 4 MB).
- [x] `components/catalog/TeamCatalogDialog.vue`:
  - Passcode screen.
  - Business-type tiles with counts and a "This shop" tag.
  - Drop zone with inline file errors.
  - "Add and update" or "Replace all" (red button).
  - Result with added, updated and skipped counts, plus a skipped-rows
    table.
  - Searchable list preview, export, and clear with a confirm step.
  - Closing the dialog always locks it again.
- [x] Hidden entry: Settings → Updates → tap the version number 7 times
  within 2.5 seconds between taps. Nothing on screen hints at it.
- [x] `components/catalog/CatalogPicker.vue` in the add product dialog:
  - "Pick from common products" with a count, search, and Enter picks
    the top match.
  - Retry on error. Hidden when the shop's list is empty.

## Verification performed

- `go build ./...`, `go vet` on the touched packages, and `go test ./...`:
  - catalog parsing;
  - seed reading;
  - passcode lockout;
  - SQLite replace, merge and clear.

  With the insert fix reverted, the repository test fails with the same
  `DEFAULT` error.
- `pnpm generate` built cleanly. `nuxi typecheck` could not run here
  because of a vue-tsc and TypeScript version mismatch in the npx cache.
- Live API checks against a scratch backend (port 8099, scratch HOME,
  test passcode hash):
  - The bundled seed list loaded into an empty `retail` list at startup.
  - No passcode gives 403. Not signed in gives 401. After 5 wrong
    passcodes, even the right one gives 429.
  - A messy semicolon CSV added 3 and skipped rows 4, 5 and 6 with
    reasons. Importing it again gave 0 added and 3 updated.
  - A file with no name column, a header-only file, an `.xls` file, a
    business type of `../etc` and an unknown mode each gave a plain 400
    message.
  - The template `.xlsx` downloaded. Importing it into `retail` with
    Replace put 3 products with strength and form details into the
    client list.
  - Clear removed 3. The CORS preflight allows `X-Support-Passcode`.
  - 20,000 rows took 0.44 s to add and 0.25 s to update all of them.

## Manual follow-up required

1. **Set the passcode before the next release.**
   - Pick a long passphrase for the team.
   - Get its hash:
     `printf %s 'the passphrase' | shasum -a 256`
   - Add the hash as the repository secret `SUPPORT_PASSCODE_HASH`.
   - Without it, the team dialog shows "Team tools are not set up in
     this build".
2. **Visual check.** The browser run was not possible in this session.
   - In `pnpm dev`, go to Settings → Updates and tap the version 7
     times.
   - Check the passcode screen, tiles, drop zone, result and preview in
     light and dark mode.
   - Then open Products → Add Product → "Pick from common products".
3. **Bundle curated lists.**
   - Use "Export for bundling" to save `<type>.json`.
   - Commit it as `backend/seeds/<type>.json`.
   - Every new install and every existing shop with an empty list gets
     it on the next start.
