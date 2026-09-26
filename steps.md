# v1.0.17: Backup and Restore UI, Offline Backups, Notification and POS Fixes

Previous rounds are preserved in git history at this same path.

## Findings being fixed here

1. Cloud backup (`backend/backup/backup.go`) had no UI, and on its own did
   nothing useful while the internet was down: every 6-hour run just
   failed until the next one.
2. No way to back up or restore without internet, and no way to move data
   to a new PC.
3. A restore had no undo reachable from the app (only
   `balce.db.before-restore` on disk).
4. Cloud network failures surfaced raw Go errors
   (`dial tcp 127.0.0.1:8765: connect: connection refused`) to cashiers.
5. Carried over from the previous round (now committed): notifications
   showing "undefined", empty bell dropdown, 404 on View Product, POS
   quantity field removing the item, image-first POS grid.

## Implementation status

Backend (`backend/`, on `main`):
- [x] Moved the two cloud-backup commits from a detached HEAD onto `main`
      (remote history had been rewritten with the noreply author; trees
      were identical).
- [x] `backup/local.go`: daily gzipped `VACUUM INTO` snapshot at
      `<app data>/backups/balce-YYYY-MM-DD.db.gz`, last 7 kept; export to
      a chosen `.gz` path (USB); restore from a local date or a file path.
- [x] Before-restore safety copy in its own slot
      (`balce-before-restore.db.gz`) so the automatic backup after the
      restart cannot overwrite it; every restore except the undo itself
      takes it first.
- [x] `backup/status.go`: one status call with local backups, last cloud
      attempt/success/error, pending restore, before-restore copy.
- [x] Automatic loop saves on this PC first, then retries the cloud every
      15 minutes while it fails, instead of waiting 6 hours.
- [x] `ErrCloudUnreachable` + `UserFacingCloudError`: plain "could not
      reach the cloud, check the internet connection", HTTP 503; full
      error still logged.
- [x] Routes under one `/api/backup` group: `GET /status`,
      `POST /local`, `POST /local/restore`, `POST /export`, `POST /import`,
      plus the existing `/cloud`, `/cloud/restore`. Restore, export and
      import are admin-only.

Frontend (`frontend/`, on `main`):
- [x] `useBackup.ts` composable; toasts fire only after awaited results.
- [x] Settings → Backup tab (`components/backup/BackupPanel.vue`): status
      tiles for this PC and cloud (offline / no license / last error),
      Back up now, Save to USB / file, Restore tabs (On this PC, Cloud,
      From a file), Undo last restore, pending-restore banner, confirm
      dialog, full-screen "Preparing your backup" overlay.
- [x] After a restore the desktop app signs out and relaunches itself so
      the backend applies the restore on start.

Shell (`src-tauri/`):
- [x] `dialog:allow-open` capability for the restore-from-file picker.

## Verification performed

- `cd backend && go build ./... && go vet ./backup ./handlers ./routes &&
  go test ./...`: clean. New tests cover local write/prune/restore,
  rejection of `../` names and non-database files, export → restore from
  file, the before-restore copy surviving a daily backup and restoring,
  and the unreachable-cloud message.
- `cd frontend && pnpm build`: clean.
- `cd src-tauri && cargo check`: clean.
- Live end-to-end in the browser against a scratch backend (scratch HOME,
  locally signed test license, a fake licensing/R2 server on
  127.0.0.1:8765, nothing sent to production):
  - Back up now → `POST /local` then `POST /cloud`, toast "Backup saved
    on this PC and in the cloud".
  - Added a product, restored today's local copy, restarted backend →
    product gone. Undo last restore, restart → product back.
  - Stopped the fake cloud → Back up now saved locally and showed "could
    not reach the cloud, check the internet connection. It will be
    retried automatically."; tile shows "Cloud can't be reached right
    now".
  - Cloud back → uploaded; added a product, restored from the Cloud tab,
    restarted → product gone.
  - `POST /export` wrote a `.gz` file; `/etc/passwd` rejected; a fake
    `.gz` rejected on import; a real export staged and showed the
    pending-restore banner.
  - Found and fixed during this run: "Restore and restart" did nothing,
    because closing the dialog cleared the selected backup before the
    click handler read it.
- At 1024px wide the Backup tab has no horizontal overflow. Below about
  900px the whole app overflows because of the shell's fixed `ml-64`
  sidebar margin. That is not new in this change.

## Manual follow-up required

On a real installed build (Windows and macOS):
1. Settings → Backup → Restore any backup. The app must sign out,
   relaunch by itself, and show the restored data after login. On
   Windows, check that the restore is applied on the first relaunch. If
   the old backend process still holds `balce.db` at that moment, the
   banner will say a restore is waiting; click Restart now once more.
2. Save to USB / file with a USB stick plugged in: pick the stick in the
   save dialog and check that the `.db.gz` file appears on it. Then, on a
   second PC, set up Balce, go to Settings → Backup → From a file, pick
   that file, and confirm the data arrives.
3. Unplug the network, wait for or click Back up now: the Cloud tile says
   Offline or can't be reached, and "On this PC" updates. Reconnect.
   Within 15 minutes of the next automatic run the cloud copy should
   upload.
4. Moving to a new PC through the cloud depends on how
   `backend.wapangaji.com` lists backups (by license key or by hardware
   ID). That server is not in this repo and was not checked. If it
   filters by hardware ID, a new PC will not see the old PC's cloud
   backups; use Save to USB / file for that case.

## Release

- [x] Tabs restyled app-wide (underline bar, sliding brand indicator,
      inline icons); checked in dark and light mode on Settings, Backup
      restore tabs and Notifications.
- [x] Pushed `backend` main (9fc4631..6c10d72), `frontend` main
      (296a9e9..0cb1055), then the parent main (f6bab3a..72c8690), then
      tag `v1.0.17`, which started the `Release Balce Inventory` workflow:
      https://github.com/obmsuya/balceinv-desktop/actions/runs/36247372591
