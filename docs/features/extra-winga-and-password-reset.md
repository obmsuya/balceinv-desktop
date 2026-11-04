# Extra, winga lines and forgotten passwords

Three things a client asked for on WhatsApp on 2 November 2026:

1. **Extra (Ziada):** cashiers sometimes sell above the list price, for example in a busy city market, so they need to raise a line's price the way they can lower it with Discount.
2. **Winga lines:** a winga (a broker) brings a customer and sells something the shop does not stock. The shop takes the money, keeps part, and gives the winga their share.
3. **Forgot password?** The link on the sign-in page went to a page that did not exist.

For the support answers, see the team guides [Extra and Brk lines](../team/extra-and-brk.md) and [Forgotten password](../team/forgot-password.md).

## Update, 4 November 2026: "Brk" and the reports

The client liked winga lines and asked for three changes:

1. **Call it "Brk"** (short for brokerage), not "winga", in both languages. Customers should not understand the word. In Kariakoo a seller says they are fetching the goods "from the store" when they fetch them from another shop.
2. **Show Brk in the reports.** That money is set aside every evening.
3. **Show Extra in the reports.** It usually goes to the fundi or salesperson who brought the customer.

What changed:

- **Words people see:** the till, orders, sale details, Settings → Features, error messages, report labels, and the EFD item code (`WINGA` → `BRK`). Tables, JSON fields, error codes and code names stay `winga`, so there is no migration and no API change.
- **Sales per day** and **Sales per staff member** gain Extra, Brk and Brk share columns, shown only when the period has any.
- **New report: Brk and Extra** (`GET /api/reports/brk-extra/export`). It has one row per Extra or Brk line, with time, receipt, staff member, item, quantity, Extra, Brk and Brk share, and the totals at the top.
- **Not recorded:** who brought the customer. The report shows the staff member who made the sale. Upgrade trigger: the owner asks to pay a fundi from the system.

The rest of this page keeps the original wording, "winga", as it was built.

## Extra (Ziada) on a till line

- **Where:** next to **Discount (Punguzo)** on every cart line, and on every line of a new customer order.
- **Who:** every cashier. The owner decided no permission is needed (Discount still needs one).
- **How:**
  1. Press **Extra (Ziada)**.
  2. Type an amount **per item**, or a percentage of the list price.
  3. The line shows the raised price, and the badge shows **+ amount**.
- **The customer sees** only the raised price, on the screen, the receipt and the A4 invoice. The word "extra" never appears for them.
- **Staff see** "Extra +X each" in the sale details and on customer orders.
- **Revenue:** the extra is part of the sale, so sales, profit and the books include it. The sales summary export has a line "Extra charged (already in takings)".
- **With discounts:** the automatic discount is worked out on the list price, then the extra raises the price. A cashier discount and an extra can sit on the same line.

## Winga lines

- **Off until the owner turns it on:** **Settings → Features (Vipengele) → Winga lines (Mistari ya winga)**. Not every shop needs it.
- **Adding one:**
  1. At the till, press **Add winga line (Ongeza mstari wa winga)**.
  2. Type what was sold, how many, the price each, and the **winga share** (optional).
  3. Leave the share empty if the shop keeps it all. The share cannot be more than the line total.
- **Customer orders** take winga lines too, and they carry into the sale when the order is collected.
- **What it does:**
  - It counts in the sale total, the cash taken, the EFD receipt and every receipt. The customer never sees the share.
  - It takes nothing from stock and adds no stock movement.
  - **The winga share is cost.** Profit is the shop's true margin: price minus share. In the books it is cost of sales, paid out of the till's cash.
  - **Reports:** the sales summary export lists "Brk sales" and "Brk share" separately. Since 4 November, the daily and staff reports have their own columns and there is a Brk and Extra report.
- **Not possible yet:** refunding a single winga line. Voiding the whole sale undoes it.

## Forgot password

1. On the sign-in page, press **Forgot password? (Umesahau nenosiri?)**.
2. Type the email you sign in with and press **Send code (Tuma namba)**.
3. A 6-digit code arrives:
   - by **email** to that address;
   - by **SMS** to the **business phone** (Settings → Business).
4. Type the code and a new password (at least 8 characters).
5. Every device that was signed in with the old password is signed out. Sign in with the new one.

**Rules:**
- The code works for 15 minutes.
- Five wrong tries and that code stops working.
- At most three codes an hour for one person.
- The page answers the same way whether the email exists or not, so it cannot be used to find out who has an account.

**No code?** The desktop app needs the internet to send it. The owner can always set a new password for staff under **Users (Watumiaji)**.

## For developers

- **Extra**
  - Request: `items[].extra {kind: percent|amount, value}` on `/api/sales/quote`, `/api/sales` and `/api/orders`.
  - Stored per unit in `sale_items.extra_unit_amount` and `customer_order_lines.extra_unit_amount` (migration 000068). `unit_price` holds the raised price, so the existing line total CHECK still holds.
  - Order lines also gained `manual_discount_amount`. A discount on an order needs `till_discounts:create`.
  - Pricing: `sales/pricing.go` `extraUnitAmount`. A percentage is capped at 1000%.
- **Winga**
  - Request: `winga_lines [{name, quantity, unit_price, winga_share}]`.
  - Tables `sale_winga_lines` and `customer_order_winga_lines` (migration 000069, RLS on Postgres). The `winga_enabled` switch is in `company_features`.
  - Books: `postSale` adds Dr COGS / Cr Cash for `WingaShareTotal`. Reports add the share to cost in the summary, daily and per-shop views.
  - Two `ponytail:` notes, each naming its upgrade:
    - **Paid from the till:** the share assumes the winga is paid in cash at the time of the sale. Upgrade: a payable and a pay-out screen.
    - **Refunds:** there is no single-line refund for winga lines. Upgrade: a `sale_refund_winga_lines` table.
- **Password reset**
  - Package `backend/internal/passwordreset`.
  - Routes `POST /api/auth/password-reset/code` and `POST /api/auth/password-reset`, behind a 10-per-15-minutes IP limiter.
  - Codes are SHA-256 hashed in `password_reset_codes` (migration 000070).
  - Delivery runs in the background so the answer time is the same for any email.
  - Email goes through `internal/common/mailer`, which the support inbox also uses now.
  - SMS goes to Wapangaji `POST /api/v1/payments/balce/password-reset-sms/` with the header `X-Balce-Sms-Key`:
    - cloud: the env `BALCE_SMS_API_KEY`;
    - desktop: `config.CompiledBalceSmsApiKey`, set by `release.yml`.
  - Wapangaji sends a fixed message, at most 5 per phone an hour and 300 a day.
  - Frontend: `pages/forgot-password.vue` renders `login.vue` in reset mode.
- **Pull requests:**
  - balceinv-api #121 (CI), #122, #123, #124;
  - balceinv #92, #93;
  - wapangajikiganjani #11 (CI), #12.
