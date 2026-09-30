# Loading common products (the catalog)

A guide for the Balce sales and support team. No technical knowledge needed.

## What this is

A **common products list** is a ready list of products for one type of business: medicines for pharmacies, tools for hardware stores, and so on. When a shop adds a product, it can **pick it from the list** instead of typing it, and the name, unit, category and price fill in by themselves. This saves shops hours when they start.

- There is one list for each **business type** (Pharmacy, Hardware Store, Supermarket…).
- A shop sees the list for the business type it chose when it was created.
- Only the Balce team can change the lists. Shop staff only see the finished list.

> **Where you can do this today**
> - **Desktop app:** yes. The list you load stays on **that computer only**.
> - **Online (pos.faltasi.com):** not yet. Send your finished Excel file to the technical team and they will add it (see [Giving a list to every shop](#giving-a-list-to-every-shop)).

The button names in this guide are written as **English (Kiswahili)**. The **language button** is at the top right of the screen.

---

## Step 1. Prepare the Excel file

1. Open the team screen (Step 2 below) and click **Get template (Pakua kiolezo)**. Save the file.
2. Open it in Excel. Fill **one product per row**.
3. Only the **name** column must be filled. The others help, so fill what you know:

| Column | What to write | Example |
| :--- | :--- | :--- |
| **name** (required) | The product name as shops know it | Paracetamol 500mg |
| category | The group it belongs to | Pain relief |
| sub_category | A smaller group inside it | Tablets |
| unit | How it is sold | strip, box, pcs, kg |
| sku_prefix | A few letters for the product code | PARA |
| default_price | The usual selling price | 1500 |

4. You may add more columns, for example **strength** or **form**. They are kept as extra details.
5. Save as **Excel (.xlsx)** or **CSV**. If Excel asks, do not choose the old ".xls" type.

Rules to remember:

- Keep the file under **4 MB** (about 20,000 rows).
- Do not write the same product name twice.
- The price must be a number. "1,500", "1500" and "TSh 1,500" are all fine.
- Empty rows are ignored.

---

## Step 2. Open the team screen

This screen is hidden so shop staff do not find it.

1. Open the **Balce desktop app** and sign in with any account.
2. Click **Settings (Mipangilio)** in the menu on the left.
3. Click the **Updates (Masasisho)** tab.
4. Find **Current version (Toleo la sasa)**. Tap the **version number** under it **7 times quickly** (within about 2 seconds between taps).
5. A box opens asking for the **Team passcode (Nenosiri la timu)**. Type it and click **Unlock (Fungua)**.

> The team passcode is secret. Get it from the product owner and never share it with shops. After 5 wrong tries the screen waits one minute.

---

## Step 3. Upload the list

1. At the top you see a box for each **business type**, with how many products each list has. The shop's own type is marked **This shop (Duka hili)**.
2. Click the business type you are loading, for example **Pharmacy**.
3. Drag your Excel file into the box, or click the box and choose the file.
4. Choose how to save it:
   - **Add and update (Ongeza na sasisha):** new products are added, and products already in the list with the same name get the new details. **Use this most of the time.**
   - **Replace all (Badilisha zote):** the whole list for this business type is deleted and replaced by your file. Use it only to start again.
5. Click the green button, **Upload to Pharmacy** (or **Replace the Pharmacy list**).
6. Read the result: how many were **added**, **updated** and **skipped**. If rows were skipped, the screen shows each row number and why. Fix those rows in Excel and upload again with **Add and update**.
7. Scroll down to see the list. Use the search box to check a few products.
8. When finished, click **Lock (Funga)**, or close the box.

---

## Step 4. Check it like a shop would

1. Click **Products (Bidhaa)** in the menu.
2. Click **Add product (Ongeza bidhaa)**.
3. At the top, click **Pick from common products (Chagua kutoka bidhaa za kawaida)**.
4. Type part of a product name. It should appear. Click it, and the form fills in by itself.
5. Close the form without saving if you were only checking.

Remember: this only shows the list for **this shop's** business type.

---

## Giving a list to every shop

A list loaded in the desktop app stays on that one computer. To give it to **all shops** (new installs, and online at pos.faltasi.com):

1. Open the team screen (Step 2) and click the business type.
2. Click **Export for bundling (Hamisha kwa toleo lijalo)** and save the file. It is named after the business type, for example `pharmacy.json`.
3. Send that file, or your Excel file, to the Balce technical team, and tell them which business type it is for.

The technical team adds it to the next version of Balce. Every new shop of that type then gets the list, and existing shops whose list is still empty get it on the next update.

---

## When something goes wrong

| What you see | What to do |
| :--- | :--- |
| Tapping the version does nothing | Tap faster: 7 taps with no long pause. Make sure you are in **Settings → Updates**. The Updates tab is only in the desktop app. |
| "Team tools are not set up on this installation" | This copy of the app has no team passcode. Ask the technical team for a proper release. |
| "Use an Excel (.xlsx) or CSV (.csv) file" | Open the file in Excel, choose **Save As**, and pick **Excel Workbook (.xlsx)**. |
| "This file is too big" | Split the file into two and upload both with **Add and update**. |
| Many rows skipped | Usually a missing name, a repeated name, or a price with letters in it. Fix the rows shown and upload again. |
| The shop cannot see the list | The list must be loaded for the shop's own business type. On the team screen that type is marked **This shop (Duka hili)**. If the shop chose the wrong type when it was created, contact the technical team. |
