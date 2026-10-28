# Invoices, quotations, delivery notes and purchase orders

**Added 28 Oct 2026.** It goes online when the PRs merge, and reaches the desktop in the next release. Step-by-step help for shops is in the [team guide](../team/invoices.md).

## Why it was added

The owner asked for an invoice generator: branded, well structured documents a shop can send to customers and to suppliers. Before this:

- **Customers:** the only "invoice" was an A4 copy of a sale that was already paid. A shop could not bill first and be paid later. It also had no way to send a price offer or a list of goods for the driver.
- **Suppliers:** purchase orders existed inside Balce, but there was nothing to send to the supplier.

## What a shop can make

| Document | Kiswahili | For | Moves stock or money? |
| :--- | :--- | :--- | :--- |
| Invoice | Ankara | Bill a customer, get paid later | Yes, when delivered and when paid |
| Proforma invoice | Ankara ya awali | A price offer before the customer commits | No |
| Quotation | Nukuu ya bei | A quote with a valid-until date | No |
| Delivery note | Hati ya kupokelea | The goods list for the driver, with no prices, signed on delivery | No |
| Supplier invoice | Ankara kwa msambazaji | Bill a supplier: damaged goods, charges, or goods sold to them | Yes, when charged and when settled |
| Purchase order | Oda kwa msambazaji | What you are ordering from a supplier | No (stock comes in with **Stock arrived**) |

**Numbering.** Each kind is numbered per year: INV-2026-0001, PRO-, QUO-, DN-, SINV-. Purchase orders keep their PO number.

## How it works

1. **Write it.** Pick the customer or supplier. Add products from stock, or type a line (transport, labour, a damaged carton) with its own price. A line can have a discount. The preview on the right is the real PDF the customer will get.
   - The due date defaults to **Days to pay** in Settings.
   - The terms default to **Default terms** in Settings.
2. **Save draft or send.** A draft can still change. Once sent (issued), the document is fixed. Cancel it and make a new one to change it.
3. **Share or print.** PDF saves the file. **Share (Tuma)** opens WhatsApp, email or the phone's other apps, with the PDF attached.
4. **Invoice: get paid and deliver**, in any order.
   - **Record payment:** cash, card or mobile money. It also appears on the customer's statement, and in the books when they are on.
   - **Mark delivered:** the products leave the invoice's shop now, and the customer owes the invoice.
   - **A customer who pays before delivery** shows **In credit** until the goods go out.
5. **Quotation or proforma:** **Make invoice** copies it into a new draft invoice, and the quotation is marked accepted. From an invoice, **Make delivery note** gives the driver's copy.
6. **Supplier invoice:** **Charge the supplier** lowers what you owe them; products on it leave stock. Then settle it in one of two ways:
   - **Taken off what we owe:** no money moves.
   - **Money they paid you:** cash, bank or mobile money.

**Status on every invoice:** Draft, Unpaid, Part paid, Paid, Overdue (past the due date and not fully paid), Cancelled. The Invoices page shows what customers owe, what is overdue, and what was paid this month.

## The rules

- **Cancelling:** an invoice with payments cannot be cancelled. Cancel the payments first. Cancelling after delivery brings the stock back and reverses the books entry.
- **Shop staff:** they only see invoices for the shops they work in.
- **Permissions:**
  - **View invoices:** see them.
  - **Create invoices:** make them and convert them.
  - **Edit invoices:** send, deliver and take payments.
  - **Delete invoices:** cancel them.
- **Switching it on:** the feature is off until it is switched on in **Settings → Features → Invoices**. It needs Customers or Suppliers on.
- **Sales reports and the dashboard count till sales only.** Invoice revenue is in Profit & loss, the books, and the Invoices summary.

## What each document shows

The same branded A4 layout is used for every document, including the A4 copy of a till sale:

- **Header:** logo, business name in the brand colour, TIN/VRN, address, phone, email; the document name and number.
- **Status chip.**
- **Two boxes:** who it is for (name, phone, email, address, TIN) and the dates and references.
- **Lines:** description (with SKU), quantity, unit, price, discount, amount.
- **Totals:** the balance due highlighted, and the amount in words in English or Kiswahili ("Shilingi laki moja na elfu arobaini na tatu tu").
- **How to pay:** the bank and Lipa number from Settings. It is left off quotations.
- **Terms and notes.**
- **Signature lines:** Prepared by and Received by. A delivery note has Dispatched by, Driver and Received by. A purchase order has Authorised by and Accepted by supplier.

## For developers

- **API:** `/api/invoices` handles list (filters `kind`, `status`, `payment`, `q`, `customer_id`, `supplier_id`, `shop`), `summary`, `:id`, `:id/document`, create, `PUT` (drafts), `issue`, `accept`, `deliver`, `payments`, `payments/:paymentId/void`, `convert` and `cancel`. Purchase orders: `GET /api/purchase-orders/:id/document`.
- **Migrations:**
  - **000064:** company invoice settings.
  - **000065:** `invoices`, `invoice_lines`, `invoice_payments`, `invoice_counters`, `supplier_receipts`, the switch and the permissions.
  - **000066:** journal sources `invoice`, `invoice_cancel`, `supplier_receipt` and `supplier_receipt_void`. On SQLite this is a table rebuild, tested on a database that already holds books.
  - **000067:** stock reasons `invoice_delivered` and `invoice_cancelled`.
- **Books on delivery:**
  - Dr Receivable (customer) or Payable (supplier).
  - Cr Sales and VAT output.
  - Dr COGS and Cr Inventory, at the cost recorded at delivery.
  - Replay picks up invoices delivered before the books started.
- **Customer payments on invoices** are ordinary `customer_payments`, linked through `invoice_payments`. Paid status is worked out from them, so cancelling one from the customer page also updates the invoice.
- **PDF:** `documents.InvoicePdf` / `RenderInvoice`. Statements and registers keep their own writer.
