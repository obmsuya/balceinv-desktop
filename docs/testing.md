# Testing without Docker on a laptop

Docker Desktop is slow and unreliable on the development laptop: it takes minutes to start, crashes, and holds several GB of memory while it runs. Tests that need Postgres or PostGIS now run on throwaway GitHub runners instead. Each run gets a fresh machine and database, and GitHub deletes it when the job ends, so nothing is left on the laptop.

## What runs where

| What | Where | How |
| :--- | :--- | :--- |
| Go tests on SQLite | Laptop | `cd backend && go test ./...` (no Docker) |
| Go tests on Postgres 17 | GitHub, every pull request to balceinv-api | `.github/workflows/tests.yml` with a Postgres service |
| Go tests on both before a deploy | GitHub, on merge to `main` here | `deploy-cloud.yml`, test step |
| Wapangaji `manage.py check` and payments tests on PostGIS | GitHub, every pull request to wapangajikiganjani | `.github/workflows/tests.yml` with a PostGIS service |
| Frontend build and locales | Laptop | `pnpm build`; the locales check script |

## Reading a run

```bash
gh pr checks <number> --repo obmsuya/balceinv-api
```

```bash
gh run view <run-id> --repo obmsuya/balceinv-api --log-failed
```

Start a run by hand on any branch from the Actions tab (**Run workflow**).

## Known Windows-only failures on the laptop

These fail only on Windows, and pass on the Linux runners:

- `internal/config`: tests expect `/tmp` paths.
- `internal/server`: a static-file test hits a Windows file lock.
- `products` import timeouts under load.

## If Docker is really needed

- Bound every command with a timeout. Never wait in a loop for Docker Desktop to start.
- When finished, quit Docker Desktop and run `wsl --shutdown` so the memory comes back.
