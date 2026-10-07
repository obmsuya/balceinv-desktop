# Subscriptions, activation and the grace period

A guide for the Balce sales and support team. No technical knowledge needed.

Subscriptions apply to **both** the desktop app and the online version at pos.faltasi.com. They work the same way. The only difference is the ID:

| | ID | Where to find it |
| :--- | :--- | :--- |
| Desktop app | **Hardware ID** (64 letters and numbers, one per computer) | Account menu → Hardware ID (Kitambulisho cha kifaa) |
| Online (pos.faltasi.com) | **Subscription ID** (starts with `cloud-`, one per business) | Account menu → Subscription ID (Kitambulisho cha usajili) |

Clicking the ID in the account menu copies the full ID.

Button names are written as **English (Kiswahili)**.

---

## The short answers

| Question | Answer |
| :--- | :--- |
| How long is the free trial? | **14 days**. On the desktop it starts when the business is created on that computer. Online it starts when the business signs up. Online businesses that already existed got 14 days from 30 Sep 2026. Everything works during the trial. |
| What happens when the trial or a plan ends? | A **5-day grace period**. Everything still works, with red "renew" warnings. |
| What happens after the grace period? | The POS **locks**: no selling, no reports, and other tills connected to that computer stop too. **No data is lost.** It all comes back the moment the POS is renewed. |
| Does the POS need internet every day? | Desktop: no. It works offline until the plan (plus the 5 grace days) runs out, and internet is only needed to pay or renew. Online: it always needs internet anyway. |
| Who can pay? | Only the **owner** (or an admin signed in as owner). Other staff see "Ask the owner or an admin to renew". |

---

## What the customer sees, step by step

1. **Free trial (14 days).** A badge at the top shows **Free trial (Kipindi cha majaribio)** and the days left. The owner sees a **Subscribe** button.
2. **Plan ending soon.** When 7 days or fewer are left on a paid plan, the badge says the subscription ends soon.
3. **Grace period (5 days).** The badge turns red and a message says **Subscription ended (Usajili umeisha)**, with the days left before the POS locks. Selling still works.
4. **Locked.** A full screen says **Subscription ended (Usajili umeisha)**:
   - The **owner** chooses a plan and pays by mobile money on that screen. The POS unlocks by itself in about a minute.
   - **Staff** see "Ask the owner or an admin to renew. Your data is safe." and a **Sign in as admin** button.
   - At the bottom there is the **Device ID** with a copy button.

If the computer's date is wrong, the lock screen says **The computer's date is wrong**. Set the correct date and time on the computer, then press **Check again**.

---

## Two ways to activate or renew

### 1. The customer pays inside the POS (self-service)

The owner opens the plans (from the badge at the top, or the lock screen), picks a plan, enters the mobile money number, and confirms the PIN on the phone. The POS checks every few seconds and switches on by itself.

### 2. We activate it with the sales tool (Faltasi Control Centre / POS_MASTER)

How to get the tool and every screen in it: [The sales tool](sales-tool.md). What happens behind the scenes: [How subscription payments work](how-payments-work.md).

Use this when the customer pays you in cash, by bank transfer, or to your number.

1. On the customer's screen, open the account menu (the initials at the top right) and click **Hardware ID (Kitambulisho cha kifaa)** on the desktop, or **Subscription ID (Kitambulisho cha usajili)** online. This **copies the full ID**. Send it to yourself (WhatsApp or SMS).
   - **Always use the copy.** The menu says **Click to copy the full ID (Bonyeza kunakili kitambulisho kamili)**; the full ID is 64 characters on the desktop, or `cloud-` plus 36 characters online. The sales tool (version v.1.0.3 or newer) refuses anything shorter. If copying fails, a message shows the full ID to select and copy by hand.
2. In the sales tool, choose **Activate / Renew**, paste the full Device ID, pick the plan, and record the payment (amount, method, reference).
3. The licence is created on our server straight away. When the computer picks it up depends on its state:

| The POS is… | It picks up the new plan… |
| :--- | :--- |
| **Locked** (grace period over) | Within about a minute, from the lock screen. |
| Still on the **free trial** | The next time the page is opened or refreshed (desktop: the next time Balce is opened). |
| On a **paid plan** that has not ended | As soon as the old plan is within 7 days of ending, the next time the page is opened (desktop: the next time Balce is opened). The added days are already safe on our server, and they are added to the end of the current plan. |

Both ways create the same licence on our server. A licence made with the sales tool is just as valid as one the customer paid for inside the POS.

> **Known limits of the sales tool**
> - **Search by phone** may not find customers who paid inside the POS, because their phone number is saved in a different format. Search by Device ID instead.
> - **Payment history** in the sales tool lists only payments recorded with the tool.
> - **Amount check:** the tool accepts whatever amount you type. Check it against the plan price before saving.
> - **Sign-in:** since v.1.0.3 the tool stays signed in and refreshes the sign-in by itself. If it still asks, update it (it offers the update when it starts).

---

## Common questions from customers

**"We paid but it still says Free trial."**
If they paid inside the POS, wait a minute and press **Check again**. If you activated it with the sales tool, ask them to refresh the page (desktop: close and open Balce). Nothing is lost: the paid days are already on our server.

**"We changed or repaired the computer."**
The new computer has a new Device ID. Activate the new ID. Old IDs keep using up a device slot on the plan until support removes them.

**"Will we lose our sales if it locks?"**
No. Locking only stops use. Everything comes back when the POS is renewed.

**"Can we use it without internet?"**
Yes, until the plan ends. Internet is needed only to pay or renew.
