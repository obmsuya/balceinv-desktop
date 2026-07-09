# Auth/Session/CORS/License Fix Plan

Source: `/code-review`-style auth/session audit run 2026-07-09 against `main`
(backend `d494068`, frontend `8fbb5e7`). Full findings are in the audit output
in chat history; this file tracks implementation status only.

## Findings being fixed here

1. **Critical** — `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` are never
   injected into the packaged app. Every shipped install falls back to an
   empty-string JWT secret, so tokens are forgeable across every install.
   (`backend/config/config.go`, `.github/workflows/release.yml`)
2. **High** — `/api/auth/refresh` and `/api/auth/logout` only read the
   `refresh_token` cookie. The Tauri client sends it via `Authorization:
   Bearer …` instead (cross-origin `SameSite=Lax` cookies from
   `http://localhost:8080` never reach `tauri://localhost` /
   `https://tauri.localhost` anyway). Refresh always fails and logout never
   revokes the session in the packaged app.
   (`backend/handlers/auth_handler.go`)
3. **High** — macOS x86_64 sidecar build ldflags target
   `github.com/chrisostomematabs/balceinv-api/license.LicenseSecret` (typo:
   extra `s`, missing `a`). Go silently drops unmatched `-X` targets, so
   Intel Mac builds ship with an empty `LicenseSecret`, breaking Django
   license-sync signature verification on that platform only.
   (`.github/workflows/release.yml`)
4. **Medium** — `frontend/middleware/auth.global.ts` and
   `frontend/app/plugins/auth.ts` each implement their own refresh-token
   call. The backend rotates (invalidates) the refresh token on every use,
   so two concurrent un-deduped refresh attempts can race and force-logout a
   user with an otherwise valid session.
   (`frontend/middleware/auth.global.ts`, `frontend/app/plugins/auth.ts`)
5. **Low** — CORS config itself looked correct; expected to stop presenting
   as a CORS-shaped error once #2 is fixed. Re-verify against a real Tauri
   build after the above land.

## Implementation status

- [x] Step 0 — write/update this plan file
- [x] Step 1 — fix macOS ldflags module-path typo (#3)
- [x] Step 2 — compile-time inject JWT secrets, patch `config.Load()`
      fallback order (#1) — **requires repo owner to add
      `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` as GitHub Actions
      secrets before the next release build will pick them up**
- [x] Step 3 — `Authorization` header fallback for `/api/auth/refresh` and
      `/api/auth/logout` (#2)
- [x] Step 4 — unify frontend refresh-token flow through one deduped
      `doRefresh()` (#4)
- [x] Step 5 — build backend (`go build ./...`), build frontend
      (`pnpm build`), validate `release.yml` syntax

## Extra fix found while verifying builds

- `frontend/package.json` pinned `@tauri-apps/plugin-stronghold@^2.4.0`,
  which was never published (latest is `2.3.1`) and wasn't even present in
  `pnpm-lock.yaml`. `pnpm install` failed on a clean checkout — meaning
  `release.yml`'s own `pnpm --prefix frontend install` step was currently
  broken independent of anything in this audit. Repinned to `^2.3.1` and
  regenerated the lockfile so `pnpm install` / `pnpm build` / `pnpm generate`
  succeed.

## Verification performed

- `cd backend && go build ./... && go vet ./...` — clean.
- Simulated the release `-ldflags -X` injection locally against the new
  `config.CompiledAccessTokenSecret` / `CompiledRefreshTokenSecret` paths and
  confirmed the values land in the binary (`strings` check) — this is the
  same check that would have caught the original macOS module-path typo.
- `cd frontend && pnpm install && pnpm run build && pnpm run generate` — both
  clean (`generate` is what Tauri's `beforeBuildCommand` actually runs).
- Validated `.github/workflows/release.yml` parses as YAML and lists all
  expected steps after the ldflags edits (`ruby -ryaml`).
- `gofmt -l` before/after diff confirmed no new formatting drift was
  introduced by the Go changes.

## Manual follow-up required (cannot be done from this environment)

- Add `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` as **GitHub Actions
  repository secrets** (Settings → Secrets and variables → Actions), same
  place `BALCE_LICENSE_SECRET` already lives. Use strong random values —
  they do not need to match anything server-side, just be stable across
  builds so existing sessions survive an app update.
- Cut a new release tag once the secrets are added and re-verify: log in on
  a packaged build, wait past token expiry (or force it), confirm refresh
  succeeds and logout actually clears the session server-side.
