# gtm/ — the demand test

This directory holds one experiment, not a marketing function. The experiment is: take a
written one-page scope for a paid Commerce Agent Readiness Audit to five real mid-market
merchants and find out whether anyone buys it.

No adapter, no demo, no code, and nothing new gets built until the experiment returns an
answer. The experiment is allowed to return no.

## Why this and not more building

The platform this repository contains is real and largely finished, and it has no paying
customers. Every further week of building increases the amount of work that is validated by
nothing. The cheapest available fact is whether a merchant will pay $2,500 for a written
assessment they can read in an afternoon, and that fact is available in about two weeks of
calls. If it comes back no, the larger engagements above it — the integration, the retainer,
the platform seat — do not sell either, and months of building are saved rather than spent.

## The four documents

| File | What it is | When it is used |
|---|---|---|
| `outreach.md` | The first touch, the follow-up cadence, and the conditions for stopping | Week 1, day 1 |
| `qualification-call.md` | The 20-minute call: which pain is real, what price clears, whether a design-partner relationship is possible, and the honest answers to the three objections | Whenever a call is booked |
| `commerce-agent-readiness-audit.md` | The one-page scope the prospect receives. Sendable as-is | Within an hour of a call that qualified |
| `README.md` | This file: the order, the scoreboard, and the kill criterion | Read first, re-read at the end |

## Order of use

1. **Pick five merchants.** Names written down before any email is written. The selection
   rules are in `outreach.md`. Five, not more.
2. **Send touch 1**, hand-written per merchant, and run the cadence: day 0, day 4, day 11.
3. **Run each call** against `qualification-call.md`, and fill the scoreboard at the end of
   that file within ten minutes of hanging up. The scoreboard is the instrument. A call with
   no scoreboard row did not happen.
4. **Send the scope** within an hour of any qualifying call, unchanged, apart from the timing
   phrase in its second section if more than two weeks have passed since the reference
   implementation was published. Ask for a yes or a no by a specific day.
5. **Stop on the fourteenth day** after the first send, and read the scoreboard.

The two documents that must not be edited mid-experiment are the price and the scope. Change
either one and the five calls stop being comparable, which is the only thing they are for.

## The kill criterion

**If five qualified conversations produce no buyer at $2,500, the ladder above it does not
sell and the build stops.**

That sentence only works if the terms are fixed in advance, so they are fixed here:

**A qualified conversation** is a call that actually happened, with a named person at a
merchant that passed the disqualifier list, in which that person heard the price and the scope
and gave a yes or a no. A call that ended early on a disqualifier does not count and must be
replaced. A reply, an email exchange, an expression of interest, and a meeting that was
rescheduled twice and never held are all not conversations.

**A buyer** is money received or a signed order for the audit at $2,500 / R40,000. Not a
verbal yes, not "send me the invoice next month", not a discounted version, not a free pilot.

**The deadline** is 14 calendar days from the first email. If five conversations have not
happened by then, the constraint is reach rather than demand, and that is a different problem
with a different fix. Do not extend the deadline to keep hope alive; write down what actually
blocked it.

## What each outcome means

**One or more buyers.** Deliver the audit properly. It is five days of real work and the
delivery is now the most important thing in the business. Then decide what to build from
what the audit found in a real business, not from what seemed likely.

**No buyer, but the five calls agree on a pain side.** The offer did not sell and the
diagnosis did. Three or more calls landing on merchant-side or shopper-side is worth more
than the $2,500 would have been. The next test is a different offer against that specific
pain, at a different price, and it is a new experiment with its own kill criterion, not a
continuation of this one.

**No buyer and the calls scatter.** No pattern, no pain side, no price that clears. Stop
building. This is the answer the experiment was designed to be able to return, and the whole
point of running it cheaply was to be able to accept it without argument.

**One relist is permitted, once.** If all five nos shared the same structural reason and that
reason was about the list rather than the offer — every merchant too small to have a back
office, every one on a platform with no API — then the list was wrong and five different
merchants is a legitimate second run. It is permitted exactly once, the reason must be
written down before the new list is drawn, and the price and scope do not change. A second
relist is not a relist, it is refusing the answer.

## What is deliberately not here

No pitch deck. No landing page. No case studies, client logos, testimonials or metrics,
because there are none and inventing them would corrupt the only signal this experiment
produces. No pricing tiers beyond the single fixed price. No CRM. No sequence automation:
five hand-written emails do not need tooling.

The audit is a new practice with no reference customers, and all four documents say so in
plain terms. That is not modesty. A prospect who buys after hearing it is a prospect whose
yes means something, which is the entire measurement.
