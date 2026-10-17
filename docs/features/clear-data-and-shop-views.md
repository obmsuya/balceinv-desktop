# Clearing test data, and seeing every shop

**Added in v2.0.12 (17 Oct 2026).** Online when this release merges; desktop from v2.0.12. The per-shop views matter for businesses with more than one shop.

Two things the owner asked for:

1. After testing Balce during the free trial, clear everything that was tried and start selling for real.
2. See clearly, per shop: the stock in each shop, the stock each shop received, transfers between shops, low-stock alerts, and which shop made each sale. When one shop runs out, bring stock from another.

## Clearing all data

### Why it was added

Shops test Balce with made-up products, sales and customers. Before, the only way to get a clean start was to ask the team or open a new account.

### How it works

**Settings (Mipangilio)** → **Business** → **Clear all data (Futa data zote)**. Only the owner sees it, at any time.

During the free trial it is also suggested:

- in the trial badge in the top bar: "Done testing? Clear the test data before you start selling";
- on the screen shown when the trial ends: "Only tested Balce? Clear the test data now, then choose a plan when you are ready." This works even though the rest of the app is locked.

The confirmation lists what is removed and what stays. To confirm, the owner types the business name (capital letters and extra spaces do not matter) and their password. The button stays off until the name matches. While clearing, the form locks and says "Clearing… do not close Balce". When it is done, Balce opens the clean business on the dashboard. A wrong name or password deletes nothing.

### The rules

| Removed | Kept |
| :--- | :--- |
| Products, prices, barcodes, add-ons, discounts | The owner's account and password |
| Stock in every shop, stock history, transfers, stock alerts | The business name, logo, settings and features |
| Sales, receipts, refunds, voids, customer orders, customers and their credit | Roles and permissions |
| Suppliers, purchase orders, stock deliveries, supplier payments and returns | The subscription, trial days and licence |
| Cash flow and the books (they can be started again) | The shop the owner is working in, with receipt numbers starting again at 1 |
| Every other shop, and every staff account | The owner's own support messages |
| Product images, delivery notes and expense receipts that were uploaded | |

Desktop: make a backup first (**Settings → Backups**) to keep a copy. Nothing can bring cleared data back.

### For developers

- `POST /api/business/clear-data` (`internal/cleardata`), owner only, body `{business_name, password}`. It runs in one transaction outside the request transaction, and stored files are deleted after the commit.
- The books are append-only. Migration 000063 lets one company's journal rows be deleted only while that company is being cleared: Postgres checks `app.clearing_company_id`, set for the transaction; SQLite checks a `journal_clearing` row that exists only inside the transaction. Every other change to the journal is still refused.
- `cleardata.ClearedTables` is the delete order. `TestEveryCompanyTableIsClearedOrKept` fails when a new table with `company_id` is in neither `ClearedTables` nor `KeptTables`.
- `company_subscriptions` is kept on purpose: deleting it would hand out a new trial.

## Every shop, side by side

### Why it was added

Stock, sales and alerts were already kept per shop, but every list only showed the shop the user was working in. The owner had to switch shops one by one, and a list of every shop's sales could not tell the shops apart.

### How it works

A **Which shops** picker appears for anyone who works in more than one shop: **{shop} (current)**, **All shops**, or another shop. The owner sees every shop; staff see only the shops they work in.

| Page | With All shops |
| :--- | :--- |
| **Sales history (Historia ya mauzo)** | A **Shop (Duka)** column. Receipt numbers count per shop, so two shops can both have SALE-20261017-0001. The column tells them apart. |
| **Stock → Levels** | One column per shop with a coloured badge (in stock, low, out), plus **Total (Jumla)**. Stock is changed in the shop you are working in, so **Change stock** hides here. |
| **Stock → History** | A **Shop** column. Each delivery, sale, adjustment and transfer shows the shop it happened in. A transfer shows as "Transfer out" in one shop and "Transfer in" in the other. |
| **Notifications (Taarifa)** and the bell | Every shop's low and out-of-stock alerts, each with its shop name. The count covers all the user's shops. |

### When a shop runs low or out

On **Stock → Levels**, a low or out product gets an **Other shops (Maduka mengine)** button. It lists how many each other shop has, with **Bring here (Leta hapa)**.

**Bring here** opens **Send stock** already filled in: **Take from (Chukua kutoka)** that shop, **Send to** this shop, with the product added. **Send stock** can now take stock from any shop the user works in, not only the current one.

### Which shop made a sale

Every sale records its shop and cashier. A cashier sells in the shop they are working in, and only that shop's products show at its till ([products per shop](shop-products.md)). Staff can only open sales, receipts and sale PDFs from shops they work in, and only void or refund those.

### For developers

- `internal/common/shopscope` resolves `?shop=` ("" = current shop, `all`, or a shop id) under the same rules as reports, and builds the SQL condition.
- `?shop=` is accepted by `GET /api/sales`, `/api/sales/totals`, `/api/stock`, `/api/stock/summary`, `/api/stock-movements` and every `/api/notifications` route. `GET /api/stock` also takes `product_id`. With more than one shop in scope, each stock row has `shops: [{shop_id, shop_name, quantity, min_stock, status}]`.
- New error codes: `shop_not_assigned` (403), plus `not_found` for an unknown shop.
- Not done yet: the till's "not enough stock" message does not name the other shops (balceinv #74). Reports keep their own copy of the shop rule.
