# Balce features: what changed and why

Pages about the features built between 1 and 11 October 2026: what each one does, why it was added, what was removed, how a shop uses it, and what happens behind the scenes.

Written for the owner, the sales and support team, and future developers. Plain words first; each page ends with a short **For developers** section.

- Button names are written as **English (Kiswahili)**, exactly as the app shows them.
- **Online** means pos.faltasi.com. Online gets every change as soon as it is merged.
- **Desktop** means the Balce app on a shop's computer. It gets changes in the version listed below.
- For step-by-step support answers, see the [team handbook](../team/README.md). These pages link to it instead of repeating it.

## Pages

| Page | In one line |
| :--- | :--- |
| [Windows sign-in fix](windows-sign-in-fix.md) | Why every Windows install of v2.0.0 and v2.0.1 said "Can't reach Balce", and how v2.0.2 fixed it |
| [Cashier discounts](cashier-discounts.md) | The per-line discount at the till: why it left on 29 Sep, why it came back, and why the limit was dropped |
| [Void a sale](void-sale.md) | Cancel a whole sale with a reason: stock back, books reversed, debt removed, EFD credit note |
| [Refunds](refunds.md) | Give back some or all items of a sale, by cash, mobile, card or off the customer's debt |
| [Deleting products](product-delete.md) | Permanent and bulk delete for unused products; Archive for the rest |
| [Cash flow and the books](money-and-books.md) | What goes into the books by itself, the **Everything (Kila kitu)** view, and **Paid to** for salaries |
| [Admin panel](admin-panel.md) | pos.faltasi.com/admin for the Faltasi team: every web shop, trials, password resets, the support inbox and an audit log |
| [Owner requests, v2.0.8](owner-requests-v2-0-8.md) | Shop for new stock, deleting an unused shop, capital when the books go on, Cash flow, Faltasi in the top bar and tabs, and three confirm buttons that did nothing |
| [Faltasi branding](faltasi-branding.md) | Where the app now says it is made by Faltasi, and why each place was chosen |
| [Till and receipts](till-and-receipts.md) | Desktop Print without a printer, receipt PDF and Share, held carts, credit wording, copying the full ID |

## Release history

Dates are the desktop release dates. Online had each change on the same day or earlier.

| Version | Date | What came in |
| :--- | :--- | :--- |
| **v2.0.2** | 1 Oct 2026 | [Windows sign-in fix](windows-sign-in-fix.md): the server now accepts the desktop sign-in header. The installer now stops a leftover old Balce server before installing. Also the desktop button **Move this business online** ([moving online](../team/moving-online.md)). |
| **v2.0.3** | 2 Oct 2026 | [Desktop Print without a receipt printer](till-and-receipts.md#print-on-the-desktop-without-a-receipt-printer). [Receipt (PDF) and Share (Tuma)](till-and-receipts.md#receipt-pdf-and-share) after a sale and in sales history. Archive renamed **Delete (Futa)** so testers could find it ([history](product-delete.md#naming-history)). The payment server's replies are written to the desktop log. |
| **v2.0.4** | 6 Oct 2026 | [Cashier discount](cashier-discounts.md) on each cart line, behind the permission **Give discounts at the till (Kutoa punguzo kaunta)**, with an owner limit in Settings. |
| **v2.0.5** | 7 Oct 2026 | Cashier discount limit removed at the owner's request. [Void sale](void-sale.md) with an EFD credit note. [Money → Show → Everything](money-and-books.md#seeing-everything-on-the-money-page) with names and links. [Paid to](money-and-books.md#paid-to-for-salaries) on money out. [Credit called **Mkopo**](till-and-receipts.md#credit-is-called-mkopo) with the add-customer hint. [Phone cart bar](till-and-receipts.md#held-carts-and-the-phone-cart-bar). [Click to copy the full ID](till-and-receipts.md#copy-the-full-id). Settings picked up when a window is clicked again. |
| **v2.0.6** | 8 Oct 2026 | [Permanent and bulk product delete](product-delete.md), with **Archive (Weka kando)** named again. [Refunds](refunds.md), partial or full. |
| **v2.0.7** | 9 Oct 2026 | [Faltasi branding](faltasi-branding.md) on the start, sign-in and setup screens, the footer, receipts, PDFs and the installer. Plus fixes found while writing these pages: Refund entries on Money open their sale. A refund to the account can no longer leave the customer owed money. Bulk delete sends products ticked on every page, not only the current one. The server refuses a salary without **Paid to**. EFD credit notes say whether they are for a void or a refund. Online had them the same day. |
| **v2.0.8** | 10 Oct 2026 | [Owner requests](owner-requests-v2-0-8.md): choose the shop for new stock, delete a never-used shop, starting capital when the books are switched on, **Money** renamed **Cash flow (Mzunguko wa fedha)**, Faltasi in the top bar, browser tabs and desktop window title. Fixed **Close shop**, **Stop discount** and removing a customer, which did nothing. |
| Online only | 11 Oct 2026 | [Admin panel](admin-panel.md) at pos.faltasi.com/admin for the team. Nothing changes in the desktop app. |

> The cashier discount limit was added in v2.0.4 and removed in **v2.0.5** (merged the same day as v2.0.4, 6 Oct). A desktop on v2.0.4 still shows and enforces the limit until it updates.

## Screenshots

Images live in [`images/`](images/).
