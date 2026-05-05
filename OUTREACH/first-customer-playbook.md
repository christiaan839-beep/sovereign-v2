# First-customer delivery playbook — 50 qualified leads in 7 days

Closing the customer is half the battle. Delivering on the
guarantee is the other half. This is the exact 7-day workflow
that uses the existing Sovereign Matrix agents to deliver 50
qualified leads + outreach drafts before the first weekly check-in.

The customer experience must feel like magic. The work behind it
is mechanical. Follow this playbook for the first 5 customers and
you will earn the renewal + the case study + the referral.

---

## Day 0 — they paid the $4,999 setup. Now what?

Within 30 minutes of the Stripe / PayPal email landing:

1. **Send a personal welcome via the channel they replied on.** Not
   a templated "thanks for your purchase!" — a real founder-to-founder
   message:

   ```
   [first name] — got the payment, you're in. Sending the kickoff
   call link below for tomorrow. Same time tomorrow I'll have a
   first-pass ICP brief ready for you to react to. Going to make
   sure this works.
   — [your first name]
   ```

2. **Schedule the kickoff call within 24 hours.** Same Calendly link,
   different booking type ("New Customer Kickoff — 30 min").

3. **Create a private Slack channel** with them. If they don't use
   Slack, fall back to a shared email thread or a dedicated WhatsApp.
   The channel is non-negotiable — you'll use it for daily delivery
   updates.

4. **Set up their tenant** in Sovereign Matrix:
   - Create their Clerk user / org
   - Mark their plan as `lead_engine` in the `subscriptions` table
     (or whatever tier exists; just record they're a Lead Engine
     customer for tracking)
   - Whitelist their email for direct support
   - Save their Stripe / PayPal customer ID against their tenant row

5. **Pre-fill a kickoff doc.** Open Notion / Google Doc, share with
   them. Sections:
   - ICP definition (blank — fill on the call)
   - Sample customer profiles (blank)
   - Disqualifiers (blank)
   - Outreach voice + tone (blank)
   - First batch delivery date (blank — set on call)

This single hour of prep is what separates a $999 customer from a
$0 churn.

---

## Day 1 — kickoff call (30 min)

The agenda is non-negotiable. Don't let them ramble for 25 minutes.

| Min   | Section         | What to ask                                                                                                          |
| ----- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| 0–3   | Intro + agenda  | Confirm what they bought, lay out the 7-day plan                                                                     |
| 3–10  | ICP definition  | Vertical, headcount range, ARR range, role title, geography. Get specific or get bad leads.                          |
| 10–17 | Sample profiles | Ask them to name 3 real existing customers. Pull each up in LinkedIn live. Reverse-engineer the pattern.             |
| 17–22 | Disqualifiers   | "Who do you NOT want to talk to?" — competitors, ex-employers, 500+ employee companies, free-tier-only signups, etc. |
| 22–27 | Voice + tone    | Get a sample of how they normally write to a prospect. Paste 2 of their best emails into the doc.                    |
| 27–30 | Wrap            | Confirm first batch delivery date (Day 7). Send Slack invite. End on time — they will respect this.                  |

**End of call deliverable:** the kickoff doc filled in. Send it to
them within 1 hour with: "Re-read the ICP section. If anything's
wrong tell me by tomorrow morning. Otherwise I start sourcing
tomorrow."

---

## Day 2 — sourcing run #1

Open Sovereign Matrix dashboard. Use the **lead-blitz** playbook with
the customer's ICP brief as input. Set a target of 200 raw leads
sourced (you'll filter to 50 qualified).

Sources in priority order:

1. **Apollo.io** filter on the ICP — vertical, headcount, role,
   geography. Pull 100 names.
2. **Crunchbase recent rounds** matching the funding stage in the
   brief — pull 50 names.
3. **LinkedIn Sales Navigator** if you have it — 50 more.
4. **Clay or Apify scrapers** for niche signals (recent hiring,
   tech stack triggers) — backfill.

Export to CSV. Drop into the Sovereign Matrix `lead-blitz` agent
input. Let it run enrichment + qualification.

Time budget: 2 hours active work, plus passive runtime.

---

## Day 3 — qualification + dedup

Open the Sovereign output. For each of the 200 raw leads:

1. **Verify the email** with Hunter / Reoon / DeBounce. Drop
   anything below 90% deliverability score.
2. **Check the buying signal** — did the agent surface a real one?
   (Recent funding, hiring, content, tech stack change.) If no
   signal, drop.
3. **Dedup against the customer's CRM** if they shared one. Worst
   thing you can do is hand them a "lead" who's already a customer.
4. **Sanity-check the ICP fit** by hand on 20 random rows. If you
   spot ICP drift, re-run with a tightened brief.

Target output: ~80 qualified leads. You'll hand-pick the top 50.

Time budget: 3 hours.

---

## Day 4 — outreach drafting

For each of the 80 qualified leads, run the **email-sequence**
playbook in Sovereign Matrix to draft 3 personalised messages:

1. First touch (cold, value-first, references the buying signal)
2. Follow-up (day 3, different angle)
3. Breakup (day 8, gives them an out)

The agent generates drafts. **You hand-review every single one before
they ship.** This is the #1 thing that makes the deliverable feel
human and not "AI slop."

For each draft, edit:

- Pronouns and titles (agent gets these wrong sometimes)
- Recent-event references (verify the signal is real, not hallucinated)
- Customer's voice (does it sound like them, not generic SDR?)

Time budget: 4 hours of focused review. **This is the work.** Don't
skip it.

---

## Day 5 — buffer day (intentional)

Block this day for:

- Customer Slack questions
- Last-minute ICP tweaks they've messaged you about
- Re-sourcing if Day 3 dropped the qualified pool below 50
- Polishing the delivery format

If everything's on track, use the day to start sourcing for customer
#2 in your pipeline. Always be 24 hours ahead.

---

## Day 6 — package the deliverable

Export the final 50 qualified leads + outreach drafts into the
delivery format. You have three good options:

### Option A — Google Sheet (recommended)

One row per lead, columns:

- Company
- Decision-maker name
- Title
- Verified email
- LinkedIn URL
- Buying signal (one line)
- Outreach message #1
- Outreach message #2
- Outreach message #3
- ICP-fit score (0-100)

Share read-only with the customer's Google account.

### Option B — Notion database

Same fields, prettier UX. Use if they're a Notion-first team.

### Option C — CSV upload to their tool

If they use Smartlead / Lemlist / Apollo, upload directly. Give
them the link. Most customers love this — it skips a manual step.

Whichever format you pick, **always include a delivery note** at
the top:

```
Delivery #1 — week of [date]
50 qualified leads, B2B SaaS founders, US/UK/CA, 5-50 employees.
Buying signal: hiring an AE in last 30 days OR posted about
outbound pain.

How to use:
1. Pick the top 10 you want to start with (sorted by ICP-fit score)
2. Drop the messages into your sequencer (Smartlead / Apollo / etc)
3. Send Tuesday-Thursday for best reply rates
4. Reply to me in Slack with anything you want changed for next week

Next delivery: [date]
```

This 8-line note tells them exactly what to do. Customers who don't
know what to do with the leads will churn even if the leads are
perfect.

---

## Day 7 — delivery + check-in call

Send the deliverable in their Slack channel at 9am their timezone.
Include a 30-second Loom walking through the format and how to use it.

Schedule a 15-minute check-in for end-of-week. Agenda:

| Min   | Topic                                                       |
| ----- | ----------------------------------------------------------- |
| 0–5   | Walk through 3 of the leads they liked + 2 they didn't      |
| 5–10  | Adjustments for next week's batch                           |
| 10–13 | Set their goal for the week (X meetings booked? X replies?) |
| 13–15 | Reconfirm next delivery date                                |

End-of-call action: update their "Customer Health" entry in your CRM.
Three colours:

- 🟢 **Green** — they liked the leads, are taking action, planning
  to renew
- 🟡 **Yellow** — they're lukewarm. Schedule a deeper check-in for
  Day 14.
- 🔴 **Red** — leads missed the mark. Trigger the money-back
  guarantee proactively, refund the $4,999 same-day, and ask "what
  would have to be true for this to have worked?" Take the lesson
  to the next customer.

Proactive refunds when you missed > waiting for them to ask. Your
reputation outlives any single $4,999.

---

## Weeks 2–4 — the recurring delivery

Same 7-day cycle, but now you're optimising:

| Week | Focus                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------- |
| 2    | Tighten ICP based on week-1 feedback. Aim for 60%+ "yes I'd contact this person" rating.                               |
| 3    | Start tracking customer's reply rate + meetings booked. Use the data in next week's case study.                        |
| 4    | Renewal conversation. Most customers will say yes if you delivered weeks 1-3 well. Ask for the testimonial + referral. |

---

## How to deliver 5 customers in parallel without dying

The first delivery is hand-crafted. The fifth shouldn't be. By
customer #3 you should have:

- A reusable ICP-brief template (Notion)
- Saved Apollo / Crunchbase searches by ICP archetype
- Pre-built Sovereign Matrix `lead-blitz` configs per ICP type
- A Slack auto-responder that asks for context when they ping
  you outside business hours
- A spreadsheet template you duplicate per customer

By customer #5 you should have a **VA running the day-2 sourcing**
($300/mo on Upwork) and yourself only handling Day 1 (kickoff),
Day 4 (outreach review), and Day 7 (delivery + check-in).

That's the leverage point. With a $300/mo VA, 5 customers at
$999/mo nets ~$4.5k/mo recurring + the setup fees on new closes.
That's the bridge to $30k MRR within 60 days.

---

## What to NEVER do (these break the magic)

- ❌ **Send leads without hand-reviewing them.** One bad lead in a
  batch of 50 destroys trust.
- ❌ **Miss the Monday 9am delivery.** Set a calendar block. The
  weekly cadence IS the product.
- ❌ **Reply to Slack messages outside your stated hours.** Train
  the customer that you're a professional, not a chatbot.
- ❌ **Cut corners on outreach copy.** Generic AI-feeling copy is
  the #1 reason customers churn. Better 30 hand-tuned messages
  than 50 generic ones.
- ❌ **Discount when asked.** "$4,999 + $999, money-back guarantee"
  is the offer. If they push for a discount, your offer wasn't
  clear enough on the fit call.
- ❌ **Up-sell in week 1.** They bought lead-gen. Don't pitch them
  on content marketing during week 1 — they need to feel the
  lead-gen working first. Up-sell on day 30 after they've seen
  results.

---

## The compounding asset

By customer #5, you have:

- 5 case studies with real numbers
- 5 referral sources (each one knows 5 founders like them)
- A delivery process so tight you can hand most of it off
- Pricing power to raise to $1,499 + $7,499 setup for customer #6

That's how the $30k month becomes a $50k month becomes a $100k month.
Not by working harder. By delivering customer #5 better than you
delivered customer #1.
