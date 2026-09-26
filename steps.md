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
