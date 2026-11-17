# Purchases: orders, stock arrived, drafts and paying

## Short answer

- **A supplier order can wait as a draft.** Save it with **Save draft (Hifadhi rasimu)**. While it is a draft you can **Change (Hariri)** or **Delete (Futa)** it.
- **Stock arrived (Stoku imefika) can be saved as a draft too.** Nothing goes into stock or what you owe until you press **Save stock (Hifadhi stoku)**.
- **A saved stock arrival can be changed.** Open it and press **Change (Hariri)**. Stock moves only by the difference, and payments already made stay with it.
- **Pay (Lipa)** is on any stock arrival that still owes money. After saving one with money still owed, its details open by themselves so you can pay straight away.

These need the backend from balceinv-api #149 and #150 and the screens from balceinv #121. They are not in a release yet.

## Save a supplier order as a draft

1. Go to **Purchases → Orders** and press **New order**.
2. Pick the supplier and add the products.
3. Press **Save draft (Hifadhi rasimu)** if it isn't final, or **Save as sent (Hifadhi kuwa imetumwa)** if you have already sent it.
4. To change a draft later, open it and press **Change (Hariri)**.
5. To throw a draft away, open it and press **Delete (Futa)**, then confirm.

An order that was sent can't be deleted; use **Cancel order (Ghairi oda)** instead. A draft that already had stock arrive against it can't be deleted either, even if that delivery was cancelled.

## Save stock arrived as a draft

1. Press **Stock arrived (Stoku imefika)** and start entering the products.
2. If you have to stop, press **Save draft (Hifadhi rasimu)**.
3. The draft is listed under **Drafts (Rasimu)** at the top of the Stock arrived tab. Press **Continue (Endelea)** to finish it, or the bin to delete it.
4. When the counting is done, press **Save stock (Hifadhi stoku)**. The stock goes in and the draft disappears.

## Change a saved stock arrival

1. Go to **Purchases → Stock arrived** and open the arrival.
2. Press **Change (Hariri)**.
3. Add products, remove products, or fix quantities and costs. Supplier and shop can't be changed here; for those, cancel the arrival and enter it again.
4. Press **Save changes (Hifadhi mabadiliko)**.

The arrival gets a new number, for example PUR-000002. The old one stays in the history marked **Changed (Imehaririwa)**, with a link to the new one. Payments already made move to the new number.

## Pay for one stock arrival

1. Open the arrival. **Still to pay (Bado kulipa)** shows what is left.
2. Press **Pay (Lipa)**. The amount is filled with what is left on it.
3. Choose how you paid and press **Save payment (Hifadhi malipo)**.

**Pay supplier (Lipa msambazaji)** at the top of the page still pays the supplier's whole balance. The oldest arrival is paid off first.

## Common questions

- **"Some of this stock was already sold…" when lowering a quantity.** You can only lower a line by as much as is still in the shop. If 10 arrived and 7 were sold, you can lower it by 3 at most.
- **"That is more than is still owed on this stock arrival".** The payment is bigger than what is left on that arrival. Pay the rest with **Pay supplier** instead.
- **The edit was refused because of payments.** The new total is less than what was already paid. Void a payment first in **Payments (Malipo)**, then change the arrival.
- **Does changing an arrival change the cost price?** Yes. The old line's cost comes out of the average and the new one goes in. If more of that product was sold than is left, the cost price stays as it was.
- **Where is Pay?** It shows only when the arrival still owes money and has a supplier, and only for roles that can edit purchases.
