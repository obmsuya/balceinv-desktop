# The sales tool (FALTASI POS Control Centre)

A guide for the Balce sales and support team. No technical knowledge needed.

The sales tool is a small program for your own computer. It records payments a shop makes to us (cash, bank transfer or to your number) and switches the shop's subscription on at once. It also looks up a shop's subscription and lists the payments the team has recorded.

How the payment reaches the shop's POS is explained in [How subscription payments work](how-payments-work.md).

Every screen is in **Kiswahili or English**; you choose when it starts. The names in this guide are written as **English (Kiswahili)**.

---

## 1. Get an account

You sign in with a **Wapangaji partner account**: a phone number and a password.

- Ask the **system admin** (the owner of Balce) to give you a partner account. Do not share one account between people. Every payment records who entered it.
- An ordinary Wapangaji account (a landlord or tenant) cannot use the tool. It says **This account can't use FALTASI POS**.

## 2. Download it

1. Open **https://github.com/obmsuya/POS_MASTER/releases/latest** in your browser.
2. Under **Assets**, download the file for your computer:

| Your computer | Download |
| :--- | :--- |
| Windows | `faltasi-windows-amd64.exe` |
| Mac with an Apple chip (M1, M2, M3…) | `faltasi-darwin-arm64` |
| Older Mac with an Intel chip | `faltasi-darwin-amd64` |
| Linux | `faltasi-linux-amd64` |

Not sure which Mac you have? Click the Apple menu → **About This Mac**. "Chip: Apple M…" means Apple chip; "Processor: Intel…" means Intel.

There is nothing to install. The downloaded file **is** the tool.

## 3. Open it the first time

### Windows

1. Move `faltasi-windows-amd64.exe` from **Downloads** to your **Desktop** so it is easy to find.
2. Double-click it.
3. If a blue box says **Windows protected your PC**, click **More info**, then **Run anyway**. This appears only the first time.
4. A black window opens. The tool runs inside it.

### Mac

A Mac blocks programs that are not from the App Store the first time. Do this once:

1. Open **Terminal** (press ⌘ Space, type `Terminal`, press Enter).
2. Copy the line below, paste it into Terminal and press Enter. On an Intel Mac, change the three `arm64` to `amd64` first.

   ```
   chmod +x ~/Downloads/faltasi-darwin-arm64 && xattr -c ~/Downloads/faltasi-darwin-arm64 && ~/Downloads/faltasi-darwin-arm64
   ```

3. The tool starts in the Terminal window.

Next time, double-click the file in **Downloads**. It opens in Terminal by itself.

### Using the keyboard

- **Arrow keys ↑ ↓** move between choices.
- **Enter** chooses or goes to the next step.
- **Esc** or **Ctrl+C** goes back or closes the tool.

## 4. Sign in

1. **Choose a language (Chagua lugha):** pick **Kiswahili** or **English**.
2. **Phone number (Namba ya simu):** your partner phone number, for example `0712345678`.
3. **Password (Nywila):** your password. Nothing shows on screen as you type; that is normal.

The tool remembers you for 12 hours, counted again from each time you open it. When it remembers you, it says **Welcome back** and skips the sign-in.

### Updates

After you sign in, if there is a newer version the tool asks **Version … is available. Update now?** Choose **Yes**. When it says **Updated! Restart the app**, close the window and open the tool again.

This works from version v.1.0.2 onwards. If you have v.1.0.0 or v.1.0.1, download the latest file again (step 2).

---

## 5. The main menu

| Menu | Use it to |
| :--- | :--- |
| **Activate or Renew License (Anzisha au Ongeza Leseni)** | Record a payment and switch the subscription on |
| **Search Customer (Tafuta Mteja)** | See a shop's plan and end date, without taking payment |
| **Payment History (Historia ya Malipo)** | See the payments the team has recorded |
| **Manage Packages (Simamia Vifurushi)** | Create or change plans. Shown to the system admin only |
| **Exit (Toka)** | Close the tool |

## 6. Activate or renew a shop

**Before you start:** get the shop's full ID. On the shop's screen, open the account menu (initials at the top right) and click:
- **Hardware ID (Kitambulisho cha kifaa)** on the desktop app, or
- **Subscription ID (Kitambulisho cha usajili)** online.

Clicking it copies the whole ID. Ask the shop to paste it to you on WhatsApp or SMS. Never type it by hand from the screen, because the screen shows only the start of it.

Then, in the tool:

1. Choose **Activate or Renew License**.
2. **Enter the customer's Hardware ID:** paste the full ID and press Enter.
   - Windows: right-click inside the black window to paste.
   - Mac: ⌘ V.
   - If it says **Paste the full Device ID…**, the ID is cut short or wrong. Ask for it again.
3. The tool looks the shop up:
   - **Customer found (Mteja amepatikana):** it shows their phone, current plan and end date. Carry on.
   - **No existing customer found… (Mteja huyu hajapatikana…):** the shop has never paid. Enter the **new customer's phone number**. The customer's SMS goes to this number.
4. **Choose a package (Chagua kifurushi):** pick the plan the shop paid for. The list shows each plan's price and days.
5. **Amount paid (TZS):** type the amount you actually received. Check it matches the plan price; the tool does not check this for you.
6. **Payment method (Njia ya malipo):** **Cash**, **Mobile Money** or **Bank Transfer**.
7. **Reference (optional):** the transaction code or receipt number. Always fill it in if there is one; it is how we find the payment later.
8. Check the summary and choose **Yes** at **Proceed with this payment?**
9. **Success! (Imefanikiwa!)** shows the plan, days added and the new end date. The customer gets an SMS.

Then tell the shop:
- **If the POS is locked,** it unlocks within about a minute.
- **Otherwise,** refresh the page (desktop: close and open Balce). The new end date shows once the plan is on the trial or within 7 days of its end. Until then the extra days are kept safe and added to the end.

## 7. Search a shop

1. Choose **Search Customer**.
2. Choose how to search:
   - **By Hardware ID:** the full ID. This is the most reliable.
   - **By phone number:** works best for shops activated with the sales tool. Shops that paid inside the POS may not be found by phone; search by ID instead.
3. The tool shows the phone, plan and end date, or **No existing customer found**.

## 8. Payment history

Choose **Payment History** to see recent payments recorded **with the sales tool**: phone, plan, amount, method, who recorded it and when. Payments the owner made inside the POS are not listed here.

## 9. Manage plans (system admin only)

**Manage Packages** appears only for the system admin.

- **Create New Package:** name, **Price (TZS)**, **Days granted** and **Max devices allowed**.
- **Edit a Package:** change any of these. Changes apply only to **new** payments. Shops that already paid keep what they bought.

Every plan here is shown to every shop on its payment screen. Remove test plans (such as a TSh 100 "Dev License") before shops see them.

---

## When something goes wrong

| The tool says… | What to do |
| :--- | :--- |
| **This account can't use FALTASI POS** | Your account is not a partner account. Ask the system admin. |
| **Sign in failed: …** | Check the phone number and password. If you forgot the password, ask the system admin to reset it. |
| **Couldn't reach the server. Check your connection.** | Check your internet, then try again. |
| **Paste the full Device ID…** | The ID is cut short or has a typing mistake. Ask the shop to copy it again with the copy button. |
| **No packages exist yet** | The system admin must create a plan first. |
| **Error: Device limit reached** (seen by the shop) | The plan's computers are all used. Send the shop's ID to the technical team to remove an old computer. |
| It keeps asking you to sign in | Update to the latest version (v.1.0.3 or newer). |

---

> **Not the same as the admin tool.** The technical team also has a tool called `balce-admin`, which creates online businesses directly on our server. It runs on the server itself, and the sales team does not need it. For creating businesses, see [Creating a business](create-a-business.md).
