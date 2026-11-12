# Order drafts and taking payment

**Added on 11 Nov 2026, for the next release.**

The client sent two messages:

- *"Kwenye ku create order mtu aweze kusave kama draft, halafu aweze ku edit kabla hajakamilisha."* Staff want to save an order as a draft and edit it before finishing.
- *"Mteja akilipia order inaenda Moja Kwa Moja kwenye collected hata kama alichagua tarehe za mbeleni. Inatakiwa ikae kwenye ready."* When a customer pays, the order went straight to Collected, even when they chose a later date. It should stay in Ready.

## What was wrong

- **No drafts.** Saving a new order committed it at once: it got its number, the goods came off the shelf, and the deposit was taken. An order couldn't be edited afterwards; the only way to change it was to cancel it and start again.
- **Paying meant handing over.**
  - The big button on an order was **Kabidhi · pokea {amount}** (Hand over · take {amount}). That one button took the money, made the sale and marked the order **Collected**.
  - The only way to pay without handing over was the small **Ongeza malipo ya awali** (Add deposit) button.
  - Nothing checked the date the customer chose.

## Drafts (Rasimu)

1. **Customer orders (Oda za wateja) → New order (Oda mpya).** Choose the customer and the products as usual.
2. Press **Save as draft (Hifadhi kama rasimu)**. A draft:
   - keeps **no stock aside** and does not check the shelf, so you can draft an order for goods that are still coming;
   - takes **no deposit**: the deposit is taken when you save it as an order;
   - gets its order number straight away.
3. It shows under the **Drafts (Rasimu)** tab. Open it to:
   - **Continue editing (Endelea kuhariri):** change the customer, products, quantities, Discount, Extra, Brk lines, collection date and note. Prices are today's prices.
   - **Discard draft (Futa rasimu):** it moves to **Cancelled**, as "Draft discarded". Nothing else changes, because nothing was kept aside or paid.
4. When the customer confirms, open the draft, press **Continue editing**, then **Save order (Hifadhi oda)**. Only now are the goods taken off the shelf, and any deposit is taken. The order moves to **Waiting (Zinasubiri)**.

Only drafts can be edited. Once an order is saved as an order, its goods are reserved and its money recorded, so changing it still means cancelling it and making a new one.

## Taking payment (Pokea malipo)

On a **Waiting** or **Ready** order that still has money owed:

- The main button is **Take payment · {amount} (Pokea malipo · {amount})**. It opens with the whole balance filled in; change it to take part.
- The order **stays where it is**. A fully paid Ready order stays **Ready** until you hand it over.
- Payments show under **Payments (Malipo)**.

**Hand over (Kabidhi oda)** is separate:

- If money is still owed, **Hand over · take {amount} (Kabidhi · pokea {amount})** takes the rest and hands over in one step, as before.
- If it is paid, the main button becomes **Hand over (Kabidhi oda)**.
- **Before the customer's date**, the app asks first: "Hand over before 20 Nov 2026? (Kabidhi kabla ya …?)". Press **Hand over today (Kabidhi leo)** to go ahead, or **Back**.

Handing over is when the sale and receipt are made. Payments taken before that are held as deposits, as before.

## For the team

- **Storage:** a draft is a `customer_orders` row with `is_draft = TRUE` and status `open` (migration 000073). The API reports it as `status: "draft"`.
  - It is a column, not a new status, because the status rule is written inside the table on SQLite. Rebuilding that table would have deleted every order's lines and payments through `ON DELETE CASCADE`.
- **API:**
  - `POST /api/orders` takes `"draft": true`.
  - `PUT /api/orders/:id` (`orders:create`) edits a draft. With `"draft": false` it confirms the draft: it reserves the stock, takes the deposit, and sets `created_at` to the moment of confirmation.
  - Deposit, ready and collect on a draft return `invalid_status`. A deposit on a draft returns `draft_deposit`.
- **Books:** reserved stock (`ReservedStockValueByShopAt` and the stock value on the balance sheet) leaves drafts out.
- **Code:** `backend/internal/orders/{service,repository}.go`; `frontend/app/components/orders/{NewOrderDialog,OrderDetailsSheet}.vue`.
