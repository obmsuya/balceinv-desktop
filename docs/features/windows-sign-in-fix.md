# Windows sign-in fix ("Can't reach Balce")

**Fixed in desktop v2.0.2 (1 Oct 2026).** Affected every Windows install of v2.0.0 and v2.0.1.

## What shops saw

On the sign-in screen, after typing the email and password, Balce said:

> **Can't reach Balce. Check the connection and try again.** (Imeshindwa kufikia Balce. Angalia muunganisho kisha ujaribu tena.)

The internet was fine. Restarting did not help. Nobody could sign in.

## Why it happened

There were two separate causes. A shop could have one or both.

### 1. The server refused the desktop's sign-in request

- Since 29 Sep, the desktop app adds a small label to its sign-in request: `X-Balce-Client: desktop`. It tells the server "this is the desktop app", so the server hands back the session the desktop needs.
- On Windows, the app's screen and the Balce server on the same computer count as two different web addresses. Before such a request, the screen first asks the server "may I send these labels?" (a CORS preflight).
- The server's list of allowed labels did not include `X-Balce-Client`. So it answered "no", and the sign-in request was never sent. The screen only knew it got no answer, so it showed "Can't reach Balce".

### 2. An old v1 server kept running through the update

- If the old Balce (version 1) had crashed, its server could still be running in the background. It kept port 8080, the port the new app talks to.
- The installer is meant to stop that server before copying the new files. It looked for the server by its file path.
- The installer runs a 32-bit PowerShell. A 32-bit PowerShell sees the path of a 64-bit program as empty. So it never found the old server, never stopped it, and could not replace its `backend.exe`.
- The new app then talked to the old server, which does not understand version 2.

## How it was found

- **A GitHub Windows machine** installed the published v2.0.1 installer. The answer to the "may I?" request for `/api/auth/login` listed the allowed labels, without `X-Balce-Client`.
- **Logs from two shop computers**, sent by the team:
  - one showed `OPTIONS /api/auth/login` answered 204, with no sign-in request after it (cause 1);
  - the other had an old server on port 8080 and no v2 log at all (cause 2).
- **From a 32-bit PowerShell** with a leftover v1.0.19 server: the old installer step left 1 server running; the fixed step left 0.

## What was fixed

| Problem | Fix |
| :--- | :--- |
| Server refused the desktop label | The label name is now defined once and used both by sign-in and by the list of allowed labels, so they cannot drift apart again. |
| Old server survived the install | The installer now finds the server through Windows' process list (`Win32_Process.ExecutablePath`), which 32-bit PowerShell can read, and stops it by its process number. |

## What support should do

- A Windows shop on v2.0.0 or v2.0.1 that cannot sign in: install v2.0.2 or newer.
- To check the version: account menu → **Settings (Mipangilio)** → **Updates (Masasisho)**.
- Still to confirm on a real shop: install v2.0.2 on a Windows computer that still runs v1, and check sign-in works without a restart.

## For developers

- CORS allowed headers: `backend/internal/server/server.go`, built from `httpx.DesktopClientHeader` (`backend/internal/common/httpx/request.go`). The auth handler reads the same constant (`backend/internal/auth/handler.go`) and returns `session_token` only for desktop clients.
- Test: `TestDesktopScreenMayCallTheApiFromEveryWebviewOrigin` fails on the old code and passes now.
- Installer hook: `src-tauri/windows/hooks.nsh` (`NSIS_HOOK_PREINSTALL`). Old: `Get-Process -Name backend | Where-Object { $_.Path -eq ... }`. New: `Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq ... } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`.
- PRs: balceinv-api #70, balceinv-desktop #38. Details: `steps.md`, Phase 28.
