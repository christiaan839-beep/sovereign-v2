# Standards

The bars Sovereign Matrix holds itself to. Internal commitments,
not marketing claims. Every line below is something we measure and
something we want a customer (or a future hire) to call us on if we
miss it.

This file is the cultural ground-truth. It overrides anything in
LAUNCH-30K.md, the FAQs, the pricing page, or anywhere else if
they contradict.

---

## The shape of a Sovereign standard

Each standard below has the same five-part structure. If we ever
add a new one, it has to fit this shape. If a candidate "standard"
can't, it's actually a feature ask in disguise — keep it out.

1. **The bar.** A single, falsifiable sentence.
2. **How we measure it.** What query, log, or human check tells us
   we hit or missed.
3. **Who is responsible.** A name (or "the operator on call" while
   the team is one person).
4. **What happens when we miss.** The customer-facing remedy and
   the internal post-mortem trigger.
5. **Why this bar, not a higher or lower one.** The honest tradeoff.

If the "what happens when we miss" is "we feel bad," it isn't a
standard. It's a wish.

---

## 01 — Every lead is hand-reviewed before it ships

**The bar.** Every prospect in every weekly delivery has been read by
a human eye before the customer sees it. No machine-only deliveries.

**How we measure it.** Every delivery has a `reviewed_by` and a
`reviewed_at` field stamped against each lead row before the Slack
delivery message is sent. If either is null, the delivery script
refuses to ship.

**Who is responsible.** The operator running that customer's account.

**What happens when we miss.** If a customer flags a lead as
clearly machine-typed (wrong vertical, hallucinated company,
ICP-disqualified), we replace the row within 24 hours and credit
$50 toward next month. Three of these in a single delivery and the
month is on us.

**Why this bar, not a higher or lower one.** Per-lead automated QA
catches the obvious cases but misses the merely-bad ones. A human
catches both. We're paying for the difference because the customer
is paying for the difference.

---

## 02 — Slack reply within 1 hour during business hours

**The bar.** Every customer Slack message lands a reply (not just
a reaction) within 60 minutes during weekdays 8am–6pm in the
operator's timezone.

**How we measure it.** Slack's analytics export, plus a manual end-
of-week sweep. We track median + p95 + count of >60-min misses.

**Who is responsible.** The operator on call.

**What happens when we miss.** If a customer posts and we don't
reply within 60 minutes during business hours, we open the next
reply with "I missed your one-hour window — apologies, here's what
I see…" and call it explicitly. After 3 misses in a 30-day window
we offer a $200 credit, unprompted.

**Why this bar, not a higher or lower one.** 30-min would force
constant pinging and degrade the work. 4-hour wouldn't earn the
trust we're trying to build. 1-hour is the bar where customers
notice — most platforms reply in days.

---

## 03 — Monday 9am delivery is sacred

**The bar.** Every active customer's weekly batch lands in their
Slack channel by 9:00am their timezone, every Monday, every week.

**How we measure it.** A scheduled job in Sovereign Matrix that
verifies each customer's most recent `playbook_runs.completed_at`
and `delivery_sent_at` are inside the Sun 5pm — Mon 9am window. The
operator gets a Slack ping at Monday 8:30am if any are missing.

**Who is responsible.** The operator on call.

**What happens when we miss.** If a customer's delivery doesn't
land by 9am their timezone, that customer's full month is refunded
— no support ticket, no questions. We trigger the refund within the
same business day.

**Why this bar, not a higher or lower one.** A monthly delivery is
too long a feedback loop; daily creates noise customers can't
process. Monday 9am is the moment a B2B SaaS founder sits at their
desk with coffee, ready to act. Hitting it is the whole product.

---

## 04 — Hand-reviewed outreach copy, not generic SDR voice

**The bar.** Every outreach message in every delivery has been
edited by a human after the agent drafted it. Pronouns and titles
verified. Recent-event references checked. Customer's voice (not
ours, not generic-SDR) preserved.

**How we measure it.** Every message row has a `final_edit_at`
field. The delivery script refuses to ship messages where the
agent draft and the final text are byte-identical (which would
mean no human edit happened).

**Who is responsible.** The operator running that customer's account.

**What happens when we miss.** Same remedy as standard 01 — replace
within 24h, credit $50. If a customer's outreach gets a reply
calling out AI-feeling copy, we own it publicly in the customer's
Slack channel and refund the offending row.

**Why this bar, not a higher or lower one.** AI-generated SDR
copy is the single most-spotted ship-killer in this category.
Every customer has seen 100 cold pitches a month and can identify
"this is from a machine" inside 5 seconds. We don't ship that.

---

## 05 — Money back, no friction, same day

**The bar.** When a customer's first month misses the 50-lead
guarantee, the setup-fee refund hits their account within 24 hours
of them asking. Or sooner — we offer it before they ask if we know
we missed.

**How we measure it.** Refund timestamps in Stripe / PayPal vs the
trigger event (customer message, internal review). p95 < 24 hours.
Zero refunds requiring more than one customer message to process.

**Who is responsible.** The operator running the account.

**What happens when we miss.** A customer who has to ask twice for
their money back gets a public apology in the next Friday Letter
and a personal phone call. After two of these in a year we shut
down new customer acquisition for a full week to fix the process.

**Why this bar, not a higher or lower one.** Most companies make
refunds painful by design. We chose the opposite extreme to make a
point: the guarantee is real. The reputation it builds across the
network outlives any single $4,999.

---

## 06 — Friday Letter every Friday

**The bar.** A Friday Letter ships every Friday at 5pm operator
timezone, no exceptions. Four sections: shipped, didn't ship,
customer story, lesson. Always under one page.

**How we measure it.** A weekly cron checks `LETTERS` array for an
entry dated within the trailing 7 days. Missing letter = Slack
ping to the operator + a self-imposed 50% discount on next setup
fee for one new customer.

**Who is responsible.** The founder.

**What happens when we miss.** The next letter opens with what
got in the way of last week's. No skipping ahead to "make up
ground" — every letter is its own week.

**Why this bar, not a higher or lower one.** Daily turns into
content marketing. Monthly is forgettable. Weekly is the rhythm
that turns a vendor into a person.

---

## 07 — Honest copy, no comparative framing

**The bar.** No public-facing surface (homepage, pricing, docs,
emails, Looms) names a competitor or uses comparative claims
("better than", "faster than", "unlike X"). We describe the
customer's actual experience, the tradeoffs we made, and the
standards above. That's it.

**How we measure it.** A weekly grep across `src/app/`,
`src/components/`, public emails, and recent letters for the
following terms: any competitor brand name we've encountered, the
words "better than", "faster than", "unlike", "vs.", "compared to".
Each hit is an issue.

**Who is responsible.** The founder.

**What happens when we miss.** If a copy review finds a competitor
name or comparative claim, we ship a fix the same day and note it
in the next Friday Letter under "what didn't ship — until now."

**Why this bar, not a higher or lower one.** Companies that
compete on comparison age badly — competitor list grows, claims
get stale, lawsuits get filed. Companies that describe the
customer's life age into infrastructure. We're betting on the
second outcome.

---

## 08 — A real human owns every customer

**The bar.** Every customer has a single named owner on our side.
That owner's first name and face appear on the customer's welcome
page, in their Slack channel, on every delivery, and on every
invoice.

**How we measure it.** Every `tenants` row has a populated
`welcome_first_name` and the operator's name appears in every
weekly delivery message as the sender.

**Who is responsible.** The operator who closed the customer.

**What happens when we miss.** If a customer ever has to ask "who
am I working with on your team," we're failing this standard.
The next welcome touch must include a 30-second Loom from the
named owner, no exceptions.

**Why this bar, not a higher or lower one.** The current platforms
in this category default to generic "team" branding because it
scales. We're not optimising for scale yet; we're optimising for
a customer who closes their laptop on Friday thinking "I'm glad
I'm working with this person." That's the moat.

---

## What this file does NOT contain

These are real things we care about that aren't in this file
because they're features, not bars:

- "We use multi-model consensus for high-stakes outputs." (Feature.)
- "Per-tenant memory makes the agent get smarter over time." (Feature.)
- "We run on the most cost-efficient model for each task." (Feature.)
- "All payment data is PCI-compliant via PayPal/Yoco." (Table-stakes.)

If a candidate "standard" reduces to "we shipped feature X," it
goes in the changelog, not here.

---

## Adding a new standard

The bar to add a new standard is high on purpose. A standard is
a debt — every one obligates the operator until it's removed. To
add one, the case must include:

1. A specific customer behaviour we want to produce ("I'd recommend
   them without thinking about it" / "I'd defend them publicly").
2. The bar that produces it (the falsifiable sentence).
3. The instrument that measures it.
4. The remedy when we miss.
5. The tradeoff being accepted.

If any of those are missing, the candidate is an idea, not a
standard. Park it in `docs/ideas/` and revisit it the following
quarter.

---

## How standards retire

A standard retires when it has been hit consistently for 90+ days
and the bar has become floor, not ceiling. At that point we either
raise the bar or remove the standard entirely (because hitting it
is now muscle memory and tracking it adds friction).

A standard is never retired because hitting it is hard. Hard means
it matters.
