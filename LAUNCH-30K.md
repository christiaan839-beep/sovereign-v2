# LAUNCH-30K — the 30-day playbook to first $30k

This is the exact day-by-day plan to close 5 founding customers at
$4,999 setup + $999/month inside the first 30 days.

> **Math:** 5 closes × $4,999 setup + 5 × $999 first month = **$29,990
> in cash collected, plus $4,995 MRR locked in.**

If you hit 6 customers it's $36k. If you hit 7 it's $42k. The plan is
the same — execution determines how far past 5 you go.

The full toolkit lives next to this file:

- `src/app/lead-engine/page.tsx` — the landing page
- `OUTREACH/loom-script.md` — the 90-second cold pitch
- `OUTREACH/icp-list.md` — how to build the ICP-150
- `OUTREACH/email-sequences.md` — email + DM templates
- `OUTREACH/first-customer-playbook.md` — 7-day delivery workflow
- `MIGRATIONS-RUNME.sql` — DB migrations to apply

Cross-reference these as you go. They are the unfair advantage.

---

## Three rules that override anything else in this doc

1. **One vertical for 30 days.** B2B SaaS founders, 1–50 employees.
   Anyone else who shows interest goes on the Q2 list.
2. **One offer for 30 days.** $4,999 setup + $999/mo, money-back
   guarantee on first batch. Don't invent new tiers mid-month.
3. **One channel of cold outreach for 30 days.** Founder Looms.
   Not paid ads, not SEO, not posts. Looms.

If you find yourself building a third tier, taking a second
vertical's call, or "trying X marketing channel," stop. Re-read
these three rules. Get back to the plan.

---

## Pre-launch (do these in order, BEFORE Day 1)

You cannot ship Looms until the website + checkout work. Block 6
hours for this. One sitting if possible.

### Hour 1 — apply migrations + verify DB

- [ ] Open Neon Console → SQL Editor
- [ ] Paste contents of `MIGRATIONS-RUNME.sql`
- [ ] Click Run. Confirm the verification query at the end returns
      13 rows.
- [ ] If anything errors, paste the failing block one at a time.

### Hour 2 — Vercel envs + domain

- [ ] Disconnect `sovereign-deploy` Vercel project from GitHub
      (Settings → Git → Disconnect). Don't delete yet.
- [ ] On `sovereign-v2` Vercel project: Settings → Environment
      Variables. Set all of:
  - `DATABASE_URL` (Neon prod connection string)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `CLERK_WEBHOOK_SECRET`
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_CLIENT_SECRET`
  - `PAYPAL_WEBHOOK_ID`
  - `PAYPAL_MODE=sandbox` (flip to `live` after smoke test)
  - `RESEND_API_KEY`
  - `CRON_SECRET` (any random 32-char string)
  - `ADMIN_USER_IDS` (your Clerk user id)
  - `SLACK_OPS_WEBHOOK_URL`
  - `NEXT_PUBLIC_APP_URL=https://sovereignmatrix.agency`
  - `NEXT_PUBLIC_CALENDLY_URL` (your Calendly URL — see Hour 4)
  - `NVIDIA_NIM_API_KEY` (if you have one — falls back gracefully)
- [ ] Add `sovereignmatrix.agency` to Domains. Set DNS A / CNAME at
      your registrar. Wait for SSL.

### Hour 3 — PayPal Live + webhook

- [ ] developer.paypal.com → My Apps → create production app
- [ ] Note the live `client_id` + `secret`. Paste in Vercel.
- [ ] Create 1 Billing Plan: **"Sovereign Lead Engine Monthly" —
      $999/mo recurring**, no setup fee in PayPal.
- [ ] (The $4,999 setup fee will be a one-time invoice — handled
      manually for the first 5 customers, easier than wiring a
      one-time purchase to a subscription.)
- [ ] Create webhook endpoint:
      `https://sovereignmatrix.agency/api/payments/paypal/webhook`
- [ ] Subscribe to events: `BILLING.SUBSCRIPTION.ACTIVATED`,
      `BILLING.SUBSCRIPTION.CANCELLED`,
      `BILLING.SUBSCRIPTION.PAYMENT.FAILED`,
      `PAYMENT.SALE.COMPLETED`
- [ ] Copy the webhook ID into `PAYPAL_WEBHOOK_ID` in Vercel.

### Hour 4 — Calendly + Loom + Slack

- [ ] Calendly → create event "Lead Engine Fit Call" — 15 min, weekday
      mornings only, Zoom link auto-generated
- [ ] Note the public Calendly URL. Paste into Vercel as
      `NEXT_PUBLIC_CALENDLY_URL`.
- [ ] Loom Pro account — needed for analytics + custom thumbnails
- [ ] Slack workspace with one private channel:
      `#sovereign-customers`. This is where customer Slack channels
      get created.

### Hour 5 — smoke test

- [ ] Trigger a Vercel redeploy after envs land.
- [ ] Visit `sovereignmatrix.agency/lead-engine` — should render.
- [ ] Visit `sovereignmatrix.agency/pricing` — should show updated
      copy.
- [ ] In sandbox PayPal mode, do an end-to-end fake checkout against
      a non-Lead-Engine plan to verify the webhook → DB write path
      still works.
- [ ] Check `error_logs` and `audit_logs` are getting writes.
- [ ] Flip `PAYPAL_MODE` to `live`. Redeploy.
- [ ] Test on yourself with a real card for $1 (use a $1 plan or
      cancel within 5 min) — verify subscription appears in DB.
- [ ] Cancel that test sub.

### Hour 6 — outreach prep

- [ ] Read `OUTREACH/loom-script.md` end-to-end. Record the script
      to yourself once for practice. Throw away the recording.
- [ ] Read `OUTREACH/icp-list.md`. Open Google Sheets, create the
      tracking spreadsheet with the schema in that file.
- [ ] Build the first 30 names of the ICP-150. Fill in the personal
      hook column for each.

You're now ready for Day 1.

---

## Days 1–7 — week one: ship the first 50 Looms

The goal of week 1 is **3 booked fit calls**. Not closes. Calls.

### Daily rhythm — every weekday in week 1

| Time        | Task                                                         | Output            |
| ----------- | ------------------------------------------------------------ | ----------------- |
| 7:00–7:30   | Coffee + open spreadsheet + pick today's 10 names            | List of 10        |
| 7:30–8:30   | Verify each name's hook. Tighten if soft.                    | 10 verified hooks |
| 8:30–10:00  | Record 10 Looms back-to-back                                 | 10 Loom URLs      |
| 10:00–11:00 | Send LinkedIn DM #1 + Email #1 to all 10                     | 20 sends          |
| 11:00–11:30 | Reply to anything inbound                                    | 0–N replies       |
| 11:30–13:00 | Run lunch + first delivery prep (you'll need this in week 2) | —                 |
| 13:00–15:00 | Build / harden / catch up on customer-side work              | —                 |
| 15:00–15:30 | Reply to anything inbound                                    | —                 |
| 15:30–17:00 | Followup emails (Email #2 / #3 / #4) for prior days          | —                 |
| 17:00–17:30 | Update spreadsheet, refill 10 names for tomorrow             | —                 |
| 17:30       | DONE — close laptop. Don't reply to Looms after hours.       | —                 |

### Day 1 — Monday

- [ ] 10 Looms sent to Tier 1 (warmest network)
- [ ] Spreadsheet updated
- [ ] Replied to anything inbound within 1 hr

### Day 2 — Tuesday

- [ ] 10 Looms sent (mix Tier 1 stragglers + Tier 2)
- [ ] Email #2 sent to any Day-1 non-watchers (skip — too early, wait
      until Day 5)
- [ ] Email #3 sent to any Day-1 watchers who didn't reply (within
      2 hrs of detecting watch)

### Day 3 — Wednesday

- [ ] 10 Looms sent (Tier 2 — IH + YC)
- [ ] Reply to inbound
- [ ] First booked call should land today or tomorrow if Tier 1
      picked well

### Day 4 — Thursday

- [ ] 10 Looms sent (Tier 2 — pain searchers)
- [ ] Email #2 (followup) to all Day-0 Looms with no response
- [ ] **Run your first scheduled fit call if booked** — script in
      "How a fit call should run" below

### Day 5 — Friday

- [ ] 10 Looms sent (mix of fresh names + warmest no-replies)
- [ ] Followups + breakup emails for any Day-0 with zero response
- [ ] EOD: if 0 calls booked, audit. Are Loom watch rates >30%?
      If not, fix the personal hooks. If yes, fix the offer pitch.

### Days 6–7 — Sat/Sun

- [ ] Reply to anything inbound (no new sends)
- [ ] Saturday: 90-min ICP-150 refresh — refill the spreadsheet to
      60 fresh names for week 2
- [ ] Sunday: re-read `OUTREACH/first-customer-playbook.md` so
      you're ready when week 2 starts closing customers

**End of week 1 metrics to track:**

| Metric          | Target | Below this means                         |
| --------------- | ------ | ---------------------------------------- |
| Looms sent      | 50     | You're not committing                    |
| Loom watch rate | 30%+   | Hooks are too generic                    |
| Reply rate      | 10%+   | Pitch isn't landing OR offer is wrong    |
| Calls booked    | 3      | Either of the above OR Calendly friction |

---

## Days 8–14 — week two: close the first customer

The goal of week 2 is **first customer closed at $4,999 + $999.**
That's $5,998 in cash collected by Day 14.

### How a fit call should run (15 min)

| Min   | Section                                                    | Goal                                                              |
| ----- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| 0–2   | Hello + agenda                                             | Set the format — don't let them control the call                  |
| 2–6   | Their pain                                                 | "Tell me about your current lead-gen — what works, what doesn't?" |
| 6–10  | Show 5 anonymised real leads (or sample for first 3 calls) | Demo the deliverable                                              |
| 10–12 | Pricing + guarantee                                        | "$4,999 setup, $999/mo, money-back on first batch"                |
| 12–14 | Ask for the close                                          | "Want me to send a payment link today?"                           |
| 14–15 | Either next-step (PAYMENT) or no (REFERRAL ASK)            |                                                                   |

**Closing language that works:**

- "I'm taking 5 founding customers this month at this price — you'd
  be one of them."
- "If we do this, I'd start sourcing tomorrow morning. First batch
  in your inbox by [day 7]."
- "Want me to send the payment link now or do you want 24 hours to
  think about it?"

If they say "I want to think about it":

- "Totally fair. What's the one thing you need to be sure of to
  decide tomorrow?"
- Whatever they say, address it on the call. Don't let them off the
  call with an unresolved objection.
- If you genuinely can't address it on the call, schedule the
  follow-up before they hang up: "Let's lock in 10am Thursday to
  finalise — works?"

### Days 8–14 daily rhythm

Same as week 1, but:

- [ ] **Mornings:** Loom batch (10 names/day, fresh from your refilled
      list)
- [ ] **Afternoons:** Run any booked fit calls (you should be
      averaging 1 call/day by Day 10)
- [ ] **Day 8 first close target:** if your first call from week 1
      booked, this is the day to close them. **Send the PayPal
      subscription link + the $4,999 invoice the moment they say
      yes — don't wait.**
- [ ] **Day 9–10:** start sourcing for that first customer (see
      `OUTREACH/first-customer-playbook.md`)
- [ ] **Day 12:** ideally 2 customers closed by now ($11,996
      collected).

**End of week 2 metrics:**

| Metric                    | Target  | Below this means                                            |
| ------------------------- | ------- | ----------------------------------------------------------- |
| Looms sent (cumulative)   | 100     | You're behind on volume                                     |
| Calls booked (cumulative) | 6       | Pitch isn't landing                                         |
| Customers closed          | 2       | Calls are happening but not closing — call recording review |
| Cash collected            | $11,996 | If you have closes but not cash, follow up on payment       |

---

## Days 15–21 — week three: deliver + scale outreach

Goal: **first delivery of 50 leads goes out to customer #1, and 2 more
customers close.** Cumulative cash: $23,994.

### Day 15 — Monday — first delivery

- [ ] 9am sharp: deliver the first 50 leads + outreach drafts to
      customer #1 in their Slack
- [ ] 30-second Loom walkthrough of the spreadsheet
- [ ] Update their CRM entry to 🟢 Green (or yellow/red, honestly)
- [ ] Schedule the Friday end-of-week check-in

### Days 15–21 — daily rhythm

Now you're juggling delivery + outreach. The discipline:

- **Mornings:** customer delivery work (sourcing, qualifying, drafting)
- **Late morning:** 5 fresh Looms (down from 10 — quality over
  quantity now that you have customers)
- **Afternoons:** fit calls + closes
- **EOD:** spreadsheet update + 5 fresh names for tomorrow

### Day 18 — case study capture

- [ ] Customer #1's first delivery has been in their hands for 3 days
- [ ] Ask them: "How many of the 50 leads are you actually going to
      contact this week?"
- [ ] Whatever they say, **screenshot the conversation** with their
      permission. That screenshot is the asset you attach to all
      future Looms.

### Day 21 — adjust pricing for new closes

- [ ] If you've closed 3+ customers by Day 21, raise pricing for
      customers #4 and #5: **$5,499 setup + $1,099/mo**.
- [ ] You earned the raise by demonstrating delivery. Founding-customer
      pricing was for the first 3.

**End of week 3 metrics:**

| Metric                   | Target   |
| ------------------------ | -------- |
| Customers closed         | 4        |
| Cash collected           | $23,994+ |
| Looms sent (cumulative)  | 135      |
| Customer #1 satisfaction | 🟢 Green |

---

## Days 22–30 — week four: close customer #5 + lock in the next month

Goal: **hit 5 customers, $30k+ collected, and have 5 fresh fit calls
booked for week-5 closes.**

### Days 22–28 — daily rhythm

- [ ] **Customer delivery:** weekly batches for the first 1–4
      customers continue
- [ ] **5 Looms/day** to fresh ICP names — focus on the "watched
      Loom but didn't reply" segment from earlier weeks (warmest
      pool)
- [ ] **Tuesday/Thursday:** post a build-in-public update to X/IH
      with this week's MRR and customer count. Real numbers. This
      is your future inbound channel.

### Day 25 — referral request

- [ ] Customer #1 has now had 2 deliveries
- [ ] Send them this exact message:

      ```
      [first name] — quick favour. The Lead Engine is working for
      you (you've replied to 3 prospects from the first batch).
      I'm taking customers #6 and #7 this month — would you intro
      me to one founder you know who's in the same lead-gen pain
      you were 30 days ago? I'll handle the rest. Whichever
      direction you choose, you've already won me over and I'll
      keep going.
      ```

- [ ] Aim for 1 intro. Even a 50% conversion rate on a warm intro
      is a $5,998 close.

### Day 30 — wrap-up

- [ ] Final close: customer #5 should be locked in by today
- [ ] Cash check: $30k collected (5 × $4,999 + 5 × $999) = **$29,990**.
      If you closed customer #6, $35,988.
- [ ] Pipeline check: at least 5 fresh fit calls on next month's
      calendar
- [ ] Case study #1 published as a blog post + X thread (use the
      `case-studies/[slug]` route that already exists in the repo)

---

## What success looks like at Day 30

| Asset                              | Target                  |
| ---------------------------------- | ----------------------- |
| Cash collected                     | $25k–$36k               |
| Customers active                   | 5                       |
| MRR locked in                      | $4,995                  |
| Case studies                       | 1 published, 2 in draft |
| Referral pipeline                  | 1+ warm intro           |
| Fit calls scheduled (next 30 days) | 5+                      |
| Looms sent (cumulative)            | 150+                    |

This sets up the **$30k → $50k MRR path for month 2.** The setup-fee
revenue compounds because each new close pays a $4,999–$5,499
one-time, and the recurring base grows by $999–$1,099/mo per close.

---

## What to do if you're behind by Day 14

If at end of week 2 you have **zero customers**, do not push harder
on the same plan. Diagnose:

1. **Loom watch rate < 25%?** Hooks are too generic. Spend Day 15
   doing nothing but rewriting hooks for the existing list.
2. **Watch rate fine, reply rate < 10%?** The pitch is unclear or
   the offer is wrong. Re-record the Loom with a sharper guarantee
   ("If I don't deliver 50 in 14 days, refund").
3. **Replies fine, calls < 3 booked?** Calendly friction —
   simplify availability, drop the "qualifying questions" form
   if you have one.
4. **Calls happening, no closes?** Record next call (with permission)
   and review. Most likely cause: not asking for the close
   directly enough.

Don't pivot the offer or the vertical in week 3. **Fix one funnel
stage per week.** Pivots in month 1 = month 2 also fails.

---

## What to do if you're ahead

If by Day 14 you have **3+ closes** ($18k+ collected):

- [ ] Raise prices for customers #4+ to $5,499 + $1,099
- [ ] Hire a $300/mo VA on Upwork for sourcing + dedup work — frees
      you for sales
- [ ] Open up the next vertical conversation in your Q2 plan, but
      do NOT chase those leads until month 2

The compounding payoff for hitting 5 in 30 days is that **month 2
starts with 5 customers + a tighter machine.** That sets up $50k
month 2 trivially.

---

## The single thing that determines success

It's not the product. The product is good — 1064 tests pass.

It's not the offer. $4,999 + $999 with a guarantee is well-priced.

It's not the script. The Loom script in this repo is tighter than
what most agency salespeople use.

**It's whether you ship 10 Looms by 11am every weekday for 21
working days in a row.** That's it. That's the whole game.

Most founders ship 30 Looms in week 1 and zero in week 2.
The ones who hit $30k ship 10 every single morning for a month.

The plan is right above. The next move is on you. Open the
spreadsheet. Pick the first 10 names. Hit record.
