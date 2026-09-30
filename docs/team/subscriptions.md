# Subscriptions, activation and the grace period

A guide for the Balce sales and support team. No technical knowledge needed.

Subscriptions apply to the **desktop app** only. The online version at pos.faltasi.com does not ask for a subscription.

Button names are written as **English (Kiswahili)**.

---

## The short answers

| Question | Answer |
| :--- | :--- |
| How long is the free trial? | **14 days** from the day the business is created on that computer. Everything works. |
| What happens when the trial or a plan ends? | A **5-day grace period**. Everything still works, with red "renew" warnings. |
| What happens after the grace period? | The POS **locks**: no selling, no reports, and other tills connected to that computer stop too. **No data is lost.** It all comes back the moment the POS is renewed. |
| Does the POS need internet every day? | No. It works offline until the plan (plus the 5 grace days) runs out. Internet is only needed to pay or renew. |
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

Use this when the customer pays you in cash, by bank transfer, or to your number.

1. On the customer's computer, open the account menu (the initials at the top right) and click **Hardware ID (Kitambulisho cha kifaa)**. This **copies the full ID**. Send it to yourself (WhatsApp or SMS).
   - **Always use the copy.** The screen only shows the first few characters. A shortened ID creates a licence that the computer will never find.
2. In the sales tool, choose **Activate / Renew**, paste the full Device ID, pick the plan, and record the payment (amount, method, reference).
3. The licence is created on our server straight away. When the computer picks it up depends on its state:

| The computer is… | It picks up the new plan… |
| :--- | :--- |
| **Locked** (grace period over) | Within about a minute, from the lock screen. |
| On a **paid plan** that has not ended | The next time the Balce app is **closed and opened again**. |
| Still on the **free trial** | **Not until the trial and grace days run out.** It keeps showing "Free trial" until then, and then switches to the paid plan by itself. Tell the customer this is expected. |

Both ways create the same licence on our server. A licence made with the sales tool is just as valid as one the customer paid for inside the POS.

> **Known limits of the sales tool**
> - **Search by phone** may not find customers who paid inside the POS, because their phone number is saved in a different format. Search by Device ID instead.
> - **Payment history** in the sales tool lists only payments recorded with the tool.
> - **Amount check:** the tool accepts whatever amount you type. Check it against the plan price before saving.
> - **Sign-in:** you may be asked to sign in again more often than every 12 hours. This is expected; sign in and carry on.

---

## Common questions from customers

**"We paid but it still says Free trial."**
If they paid inside the POS, wait a minute and press **Check again**. If you activated it with the sales tool and they are still on the trial, it switches over when the trial ends (see the table above). Nothing is lost: the paid days are already on our server.

**"We changed or repaired the computer."**
The new computer has a new Device ID. Activate the new ID. Old IDs keep using up a device slot on the plan until support removes them.

**"Will we lose our sales if it locks?"**
No. Locking only stops use. Everything comes back when the POS is renewed.

**"Can we use it without internet?"**
Yes, until the plan ends. Internet is needed only to pay or renew.
