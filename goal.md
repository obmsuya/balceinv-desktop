# Goal — post-audit fix round (2026-07-13)

Source: prod-workflow-audit run against `main` (`6f52a8d`) covering six named
use cases — full findings are in chat history; this file states the target
state, `steps.md` tracks execution.

## Why this round exists

Clients hand over their stock as Excel files and expect the app to print a
receipt with the change they're owed on a printer they just plugged in.
Right now:

- The Excel template button lies to the user — it claims success and
  produces no file.
- The printer settings screen is decorative — nothing typed into it ever
  reaches the backend, so there is no way to connect a printer through the
  app at all, let alone automatically.
- The printed paper receipt drops the change amount that the on-screen
  summary already knows.
- The hardware ID (needed for support/licensing conversations) isn't
  visible anywhere in the UI.

Product/category detail display and on-screen change display already work
and are explicitly **not** part of this round — don't touch them.

## Target state (what "done" looks like)

1. **Excel template download** actually writes a file to disk on Windows,
   macOS, and Linux, and the success toast only appears once the file is
   confirmed written. A failed write shows a real error, not a fake success.
2. **Printer setup actually works**, and specifically:
   - Plugging in a USB/serial thermal printer and opening
     Settings → Hardware shows it in a list **without the user typing a
     device path** — auto-detected, not hand-entered.
   - Picking a detected printer and saving actually persists
     `printer_enabled` / `printer_port` / `printer_model` to the backend
     (today it silently doesn't).
   - A "Test Print" action exists so connection can be confirmed without
     completing a real sale.
   - The POS "Print Receipt" button appears exactly when a printer is
     enabled and configured, matching real backend state.
3. **The printed receipt shows amount paid and change**, not just
   subtotal/tax/total.
4. **Hardware ID is visible in the UI** (header, per audit ask) so it can be
   read off during a support call without opening dev tools.

## Non-goals for this round

- No credit/partial-payment ("balance due") flow — out of scope per audit.
- No network/Bluetooth printer *discovery* protocol implementation
  (mDNS/Bluetooth pairing) — only USB/serial auto-detect is required now;
  Network/Bluetooth stay as manual-entry options in the UI, unchanged.
- No redesign of the Settings page layout beyond what's needed to replace
  the port text field with a detected-device picker.

## Definition of done

- `steps.md` implementation checklist fully checked off.
- `go build ./... && go vet ./...` clean in `backend/`.
- `pnpm build && pnpm generate` clean in `frontend/`.
- A physical (or documented simulated) USB/serial thermal printer plugged
  into a real machine is detected by the new endpoint and a test print
  succeeds — recorded in `steps.md` under Verification.
- Excel template download verified to produce a real file with a byte size
  > 0 on at least one OS in this environment, with the other OSes' download
  mechanism reasoned through explicitly (Tauri's save-dialog plugin is
  OS-agnostic by design, so one clean run + code review of the plugin path
  stands in for a three-OS lab).
