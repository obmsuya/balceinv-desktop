# Balce: one codebase, three ways to run (discussion draft)

Status: **draft for discussion**, 2026-09-29. Nothing here is built yet.
The accounting design (ledger, posting rules, reports) was covered separately;
this doc is about *where it all lives*.

---

## 1. The shape

`frontend/` (balceinv) and `backend/` (balceinv-api) are independent repos.
This desktop repo only pulls them in as submodules and wraps them in Tauri.
The same two repos run in three modes:

```
                    ┌──────────── same frontend build (nuxt generate) ────────────┐
                    │                                                              │
   CLOUD            │   DESKTOP (offline)            DESKTOP + LAN (offline)       │
   many companies   │   one shop, one PC             one shop, several tills       │
                    │                                                              │
 Browser ─► Vercel  │   ┌─ Tauri app ─────────┐      ┌─ Tauri app (server PC) ──┐  │
   (app.<domain>)   │   │ webview ─► Go ─► SQLite │  │ webview ─► Go ─► SQLite  │  │
   └─► Caddy ─► Go ─► Postgres ──────────────┘    └──────────▲───────────────┘  │
       (api.<domain>)                                                             │
                    │                                  Till 2 browser ─┤ http://192.168.x.x:8080
                    │                                  Till 3 browser ─┘            │
                    └──────────────────────────────────────────────────────────────┘
```

| | Cloud | Desktop | Desktop + LAN |
|---|---|---|---|
| Who | Multi-shop clients with internet | Rural shop, no internet, one PC | Rural shop, no internet, several tills |
| Go runs as | systemd service on a VPS | Tauri sidecar | Tauri sidecar on the "server" PC |
| Database | **Postgres** | **SQLite** file | **SQLite** file on the server PC |
| Companies / shops | many / many | 1 / 1 | 1 / 1 |
| Go listens on | `127.0.0.1` (behind Caddy) | `127.0.0.1` | `0.0.0.0` (LAN switched on) |
| Frontend served by | **Vercel** (custom domain, same site as the API) | Tauri webview | Tauri on the server PC; Go serves the same files to the other tills |
| Auth (opaque sessions, `plan.md` §A) | httpOnly cookie, `Secure` | Bearer token in Stronghold | Server PC: Bearer. Tills: httpOnly cookie (plain http, so not `Secure`) |
| Receipt printing | Browser print | Go → serial port (today) | Server PC: Go → serial. **Each till prints from its own browser** |
| License | Subscription per company | Hardware ID (today) | Hardware ID on the server PC only; tills are just browsers |
| Backups | WAL archiving off-box | SQLite copies + export to a USB drive (today) | Same, on the server PC |
| Updates | Deploy the binary | Tauri updater when online, installer on a flash drive when not | **Only the server PC updates**; tills load the new frontend automatically |

**Answer to "will the other be SQLite?": yes.** The backend picks its
database from config: `DATABASE_URL` set → Postgres (cloud), otherwise
`DB_PATH` → SQLite (desktop). It's one binary with the same code, schema and
migrations. Mode isn't a separate setting; it follows from which database
you gave it.

---

## 2. Where the code is today

| Area | Today | What changes |
|---|---|---|
| Database | SQLite via `glebarez/sqlite`, GORM `AutoMigrate` | Add a Postgres driver (`gorm.io/driver/postgres`) and versioned migrations that run on both |
| Tenancy | `companies`; `users.company_id`, `settings.company_id`, `companyId` in the JWT | **Products, sales, stock and purchases have no `company_id`**. Add it everywhere. On desktop it's always `1` |
| Uniqueness | `sku`, `barcodes.code`, `receipt_number` are unique globally | Unique **per company** |
| Stock | `products.quantity`, a single number | Quantity per shop (`shop_stock`). Desktop has one shop row |
| Listen address | `app.Listen(":" + cfg.Port)` binds **all interfaces** | Desktop defaults to `127.0.0.1`; `0.0.0.0` only when the owner turns LAN on. Today the till PC is reachable from the network without anyone choosing it |
| SQLite concurrency | WAL on, **no `busy_timeout`** | Needed before several LAN tills write at once, or they'll get "database is locked" |
| CORS | Allowlist: localhost:3000 + tauri origins | LAN tills load the frontend from Go, so they're same-origin and need no CORS. Cloud: allowlist read from env (`https://app.<domain>` + Tauri origins) with `AllowCredentials` |
| Auth | HS256 JWT; secrets compiled into every desktop binary; access tokens can't be revoked; refresh tokens stored as plain text | Replaced by opaque server-side sessions (`plan.md` §A). The plugin's `isTauri()` → Bearer / else cookie split stays |
| Printing | Go opens USB/serial on its own machine | Still right for desktop. Cloud and LAN tills print from the browser (§7) |
| Frontend API URL | `apiBase` baked in at build from `API_BASE_URL` | Worked out at runtime (§5), so **one build** serves all three |

---

## 3. Database: shared schema with `company_id`, on both engines

**Recommendation: one schema, `company_id` on every business table, and the
same schema in SQLite and Postgres.**

Why not a schema or database per client: a schema per client means running
each migration N times on a cheap VPS, and a database per client loses every
cross-client view (your admin panel, billing, support). Desktop gets real
per-client isolation for free anyway, because each rural shop has its own
SQLite file.

### Isolation

- **Cloud:** Postgres Row-Level Security is the backstop, so a forgotten
  `WHERE` fails instead of leaking another client's data:

  ```sql
  ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
  ALTER TABLE sales FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON sales
    USING      (company_id = current_setting('app.company_id')::bigint)
    WITH CHECK (company_id = current_setting('app.company_id')::bigint);
  ```

  `current_setting` with no fallback **errors** if the tenant isn't set, so it
  fails closed. The app connects as a non-owner role; migrations run as the
  owner; your platform admin area uses a separate `BYPASSRLS` role.
- **Desktop:** one company per file. The policies simply aren't created;
  they're a Postgres-only migration step.

### One transaction per request (both engines)

The ledger needs this anyway: a sale and its journal entry must commit
together.

```go
func RequestTransaction(database *gorm.DB, isPostgres bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tokenPayload := c.Locals("user").(*utils.TokenPayload)

		return database.Transaction(func(requestTransaction *gorm.DB) error {
			if isPostgres {
				companyIdText := strconv.FormatUint(uint64(tokenPayload.CompanyID), 10)
				setTenantError := requestTransaction.Exec(
					"SELECT set_config('app.company_id', ?, true)", companyIdText,
				).Error
				if setTenantError != nil {
					return fmt.Errorf("set tenant for request: %w", setTenantError)
				}
			}

			c.Locals("db", requestTransaction)
			handlerError := c.Next()
			if handlerError != nil {
				return handlerError
			}
			if c.Response().StatusCode() >= 400 {
				return errRollbackRequest
			}
			return nil
		})
	}
}
```

The status-code check matters. Handlers return `utils.Error(...)`, which
writes a 4xx response and returns `nil`, so without it a failed half-sale
would **commit**. Repository methods take the request's `*gorm.DB`. That's
a mechanical change across all repos.

### Keeping SQL portable (one rule set, two engines)

- Use the GORM builder or plain ANSI SQL in repositories. `SUM`,
  `GROUP BY`, `DATE(created_at)` and `COALESCE` behave the same in both.
- Put the few differences (month grouping: `strftime` vs `to_char`) in
  **one dialect helper file**, never inline in a repository.
- Money is `BIGINT` minor units (cents), exact in both engines.
- `metadata` is `TEXT` in SQLite and `jsonb` in Postgres. That's safe
  because metadata is never queried in SQL (§6).
- **Tests run against both engines.** SQLite is the default `go test`;
  Postgres runs in CI or through a local Docker container. The two-company
  leak test runs on Postgres.

### Migrations

Replace `AutoMigrate` with a numbered list of Go migration functions
(`0001_add_company_id`, `0002_shop_stock`, …) using GORM's `Migrator`,
each applied in a transaction and recorded in `schema_migrations`. The
same list runs on both engines; a step branches on dialect only when it
has to (RLS policies are Postgres-only). No new dependency.

- **Desktop:** migrations run on app start. **Take a SQLite copy first.**
  `backup/local.go` already has `SaveBeforeRestoreCopy`; reuse that
  pattern, because an offline rural shop has no one to call when an update
  corrupts the file.
- **Cloud:** migrations run at startup under a Postgres advisory lock, so
  two instances never migrate at once.

### Which tables get what

| Scope | Tables |
|---|---|
| Platform (no `company_id`) | `companies`, `catalog_products`, `permissions`, subscriptions (cloud only) |
| Company | `users`, `roles`, `role_permissions`, `user_permissions`, `settings`, `products`, `barcodes`, `price_history`, `product_addons`, `discounts`, `suppliers`, `customers`, `employees`, `accounts`, `journal_entries`, `expense_categories`, `notifications` |
| Company + shop | `shops`, `user_shops`, `shop_stock`, `stock_movements`, `stock_alerts`, `sales`, `sale_items`, `purchases`, `purchase_items`, `payments`, `expenses`, `payroll_runs`, `journal_lines` (`shop_id` nullable) |

Schema rules:
- `company_id` goes **directly** on every tenant table, even child tables.
- Composite FKs on the money path, e.g. `(company_id, product_id) →
  products(company_id, id)`.
- Per-company uniques: `(company_id, sku)`, `(company_id, receipt_number)`.
- Indexes lead with `company_id`, e.g. `(company_id, shop_id, created_at)`.
- Every sale, purchase and payment carries a `client_ref` (unique per
  company), generated by the till. A retry on flaky Wi-Fi or mobile data
  then can't create a second sale. It's needed on LAN as much as in the
  cloud, and it's the key a future desktop→cloud sync would dedupe on.

---

## 4. Tenancy and shops

```
Company                 (desktop: exactly one)
├── Users, Products, Suppliers, Customers, Employees, Ledger accounts
└── Shops               (desktop: exactly one)
    ├── Shop stock (quantity per product)
    ├── Sales, purchases, stock movements
    └── Till cash account, receipt prefix, address
```

- Login identifies the company (`users.email` stays globally unique).
- The JWT carries `companyId` + `shopId`. Owners can switch shops or pick
  "All shops".
- Stock transfers between shops are one document with two stock movements.
- The ledger has one set of books per company; every line is tagged with
  `shop_id`. That gives a P&L per shop, and a consolidated one when the
  filter is dropped.
- On desktop the shop switcher is hidden (there's one shop), but the
  columns are still there, so the code paths are identical.

---

## 5. One frontend build, features shown by platform

`nuxt generate` runs **once**. The same `.output/public` goes to:
1. Tauri (`frontendDist`, as today)
2. Vercel (cloud)
3. the Go sidecar in LAN mode, so it can serve the other tills (bundled as a
   Tauri resource; its path is passed to Go as `BALCE_STATIC_DIR`)

Go serves `BALCE_STATIC_DIR` only in LAN mode, with `index.html` as the
fallback for SPA routes. In cloud, Caddy only terminates TLS for the API.
Cookie and domain rules for Vercel are in `plan.md` §B.

**API URL at runtime, not build time:**
- In Tauri → the saved server URL (default `http://localhost:8080`)
- In a browser → `window.location.origin` (the page came from Go, so the
  API is the same origin)

That removes `API_BASE_URL` from the build.

**Two sources for "what to show", in one `usePlatform` composable**
(the `isTauri()` check in `plugins/auth.ts` moves there):

| Source | Answers | Examples |
|---|---|---|
| `isTauri()` | What this *device* can do | Updater, Stronghold, native save/open dialogs, serial printer setup |
| `GET /api/platform` → `{ mode, lan_enabled, lan_urls }` | What this *installation* is | Shop switcher and billing (cloud), backup/restore page (desktop), LAN toggle and QR (desktop server PC) |

| Feature | Tauri on desktop PC | Browser on LAN till | Browser in cloud |
|---|---|---|---|
| Auto-updater | ✔ | — | — |
| Backup / restore / export to USB | ✔ | — | — (server does it; "Export my data" instead) |
| Serial printer setup | ✔ | — | — |
| LAN on/off + address/QR | ✔ | — | — |
| Shop switcher, billing | — | — | ✔ |
| Browser receipt print | fallback | ✔ | ✔ |
| Everything else (POS, products, accounting, reports) | ✔ | ✔ | ✔ |

A feature flag is never a build flag. If something doesn't apply to a
surface, it's hidden, not compiled out.

---

## 6. `metadata`: what it's for

- **Yes:** client-specific descriptive extras the app shows but never
  calculates on, such as colour, size, IMEI, expiry note or shelf location.
- **Never:** money, quantities, anything summed in a report, uniqueness,
  foreign keys, or things the POS filters on.
- **Promotion rule:** when a key shows up for a second client, or someone
  asks to report on it, it becomes a real column in a migration.
- This is also what keeps it portable: nothing queries inside it, so TEXT
  on SQLite and jsonb on Postgres behave the same.

---

## 7. LAN mode: how the setup works

**On the server PC** (the one with the desktop app installed):
1. Normal setup wizard, as today.
2. Settings → Network → **"Let other devices on this network use Balce"**.
   Go restarts listening on `0.0.0.0:8080` (off = `127.0.0.1`).
3. The screen shows the address, e.g. `http://192.168.1.10:8080`, plus a QR
   code (`qrcode` is already a frontend dependency).
4. Windows asks once about the firewall. Allow **private networks** only.
5. Manual step, documented for installers: reserve the PC's IP in the router
   (DHCP reservation) so the address never changes.

**On each extra till:**
1. Open Chrome or Edge at that address and bookmark it. "Install app" in
   Chrome gives it its own window.
2. Log in as that cashier's own user.

Nothing is installed on the tills, so there's no version skew. Update the
server PC and every till gets the new frontend on its next reload.

**Printing from LAN tills (decided): each till prints from its own browser.**
- The receipt page is sized `@page { size: 80mm auto }`, and each till's
  printer is installed with its normal OS driver. Chrome's
  `--kiosk-printing` flag on the till's shortcut skips the print dialog.
- WebSerial isn't an option on LAN: browsers only allow it on HTTPS or
  localhost, and a LAN till is plain `http://192.168.…`.

**SQLite with several tills:** set `PRAGMA busy_timeout` (for example 5 s)
on connect so concurrent writes wait instead of failing with "database is
locked", and keep write transactions short. A single rural shop's tills
generate a few writes a minute, well within SQLite's limits.

(Skipped: automatic discovery of the server (mDNS). Typing or scanning the
address once is enough; add discovery if installers complain.)

---

## 8. Cloud on a cheap VPS

```
Browser ─► Vercel  app.<domain>   (static frontend)
   └────► Caddy     api.<domain>   (auto HTTPS) ─► Go :8080 (systemd, API only)
                                                   └─► Postgres (localhost only)
                                                         └─► WAL archive → off-box object storage
```

- A 2 vCPU / 4 GB VPS runs all three comfortably. Even 200 shops at one
  sale a minute is about 3 writes/second. The first thing that hurts is
  report queries over years of data, which the `company_id`-leading indexes
  and ledger-based reports handle.
- **Backups:** WAL archiving (WAL-G or pgBackRest, server tools, not Go
  deps) for point-in-time recovery, copied off the box, **and a scheduled
  restore drill**.
- Cookies get `Secure` in cloud mode only.
- Remove the desktop-only background goroutines (license timestamp ticker,
  SQLite backup scheduler) from the cloud path. Anything that stays runs
  under an advisory lock.
- **Scaling path:** one VPS → Postgres on its own box → several Go instances
  (already stateless; sessions live in the DB) → a read replica for reports.
- **Licensing:** cloud uses a subscription on `companies`
  (`plan`, `max_shops`, `paid_until`). Past `paid_until` the account becomes
  read-only, never deleted. Desktop keeps the hardware-ID license as it is.

---

## 9. Moving between modes

- **Desktop → cloud (a rural shop gets internet):** an importer reads their
  `balce.db` (the backup file they already export), creates a company and
  shop, and inserts every row with the new ids. It prints row counts and
  stock value on both sides as its self-check.
- **Desktop ↔ cloud live sync is skipped.** It's a big feature (conflicts,
  stock going negative, receipt numbering). Building `company_id`,
  `shop_id` and `client_ref` into the desktop schema now means it can be
  added later without a rewrite. Revisit when a client needs offline shops
  and cloud shops in one set of books.

---

## 10. Build order

See **`plan.md`**: baseline reset → tenancy → auth and security → frontend
platform layer → LAN → cloud deploy → languages and currency → accounting →
desktop-to-web importer.

Every step keeps the desktop app shippable; nothing is desktop-only or
cloud-only except the rows in the tables above.

---

## 11. Decisions still open

1. **Per-shop prices** in cloud: needed now, or one price list per company?
2. **Cloud billing:** stays on the Django license server, or moves into Go?
3. **LAN device limit:** should the desktop license cap how many tills can
   connect, or is it unlimited?
4. From the accounting plan: go-live date vs backfill, VAT-registered
   clients, payroll gross-only vs statutory deductions.
5. The ones listed at the end of `plan.md` (onboarding, session lifetime,
   languages, currencies, Vercel plan).
