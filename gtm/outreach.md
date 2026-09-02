# First touch: five merchants

The goal of outreach is one thing only: a 20-minute call. Not a reply, not interest, not a
download. Five calls with qualified people is the entire target, and it is small enough that
every message should be written by hand.

---

## The wedge

Two commerce-agent blueprints were published in the last week, and both stop at the same
place.

**Anthropic's** reference implementation is Apache-2.0 and contains two working agents: a
shopping agent for customers and a merchant agent for staff. Both are complete except for
the interface that touches real systems. `StorefrontBackend` has 11 abstract methods,
`MerchantBackend` has 16. The implementations shipped alongside them are in-memory mocks.
The catalog, order, inventory, pricing and analytics side of it is the adopter's to write.

**Shopify's** agent tooling and its `ucp-cli` cover the buyer's side of the same problem:
product search across merchants, building carts, completing checkout, tracking orders,
discovering what a merchant supports. It is a shopping skill for agents. Nothing in it runs
a back office.

So a merchant who saw either announcement has a concrete question they cannot answer from the
announcement: **can my systems actually feed this, and what would it cost to find out?**
That is the question the audit answers, and it is the only thing the first email should be
about.

### Verify before you send

Two things in the paragraph above have a shelf life. Check them the morning you send, and fix
the wording if they have moved:

1. **The date.** The copy below says "this week." The Anthropic repository's commit is dated
   Monday 31 August 2026. If more than about ten days have passed, change it to a month or
   drop the timing entirely, because a merchant who checks will notice.
2. **The Shopify quote you may have heard.** There is a line going around that Shopify's repo
   says the merchant app "is yours to build." **I could not find that sentence in the
   `Shopify/ucp-cli` README and you should not put it in an email.** The accurate and equally
   strong version is the one above: the tooling is buyer-side. If you find the exact sentence
   on a Shopify page, quote it with the URL. Otherwise describe what the tooling does.

Nothing else in the email is time-sensitive. The 11, the 16 and the 27 are properties of the
code and will not change without a release.

---

## Who counts as a prospect

Five, not fifty. Each one has to clear all of these before you write anything:

- A real catalog with real variants. Enough SKUs that pricing and stock are somebody's job.
- Someone whose week is spent in the back office. If the owner does everything, there is no
  operational pain to assess, only a shortage of hours.
- On a platform you can name. Shopify, BigCommerce, a custom stack, a marketplace. If you
  cannot tell what they run, you cannot write the second paragraph.
- A named human with a findable address, and a plausible reason for that person to be the one
  who cares. Not `info@`.
- Somewhere you can plausibly do business: same timezone band, or a market you can serve.

Write the five names down before writing any email. Sending to a sixth because the first five
went quiet is how a demand test turns into a numbers game and stops being a test.

---

## The email

One version, adapted per merchant. Keep it under 150 words. The `[ ]` slots are mandatory and
the one marked OBSERVATION is the one that decides whether this reads as written to them.

**Subject** (pick one, do not A/B test across five sends):

- `the merchant half of the new commerce-agent code`
- `question about [Store]'s back office`

**Body:**

> Hi [Name],
>
> [OBSERVATION: one true, specific sentence about their store that took you two minutes to
> find and that shows you looked. See the rules below.]
>
> Anthropic published an open-source commerce-agent reference implementation this week, and
> Shopify shipped agent tooling for the buyer's side around the same time. The agents are
> free. What neither of them includes is the layer that reads your catalog, orders, stock and
> prices: 11 abstract methods on the shopping side, 16 on the merchant side, all of them
> yours to implement.
>
> I do a five-day paid assessment of exactly that: which of those 27 your systems can already
> answer, which need work, what the work is, and a written go/no-go that is allowed to say
> don't build this. Fixed price, no code, no demo.
>
> Worth 20 minutes? I'm in Cape Town, UTC+2 — [day] or [day] at [time] your time both work
> for me.
>
> [Your name]
> [one link: the repository, or your compliance exporters. One.]

### Rules for the OBSERVATION line

It is the only part that cannot be templated, and a bad one is worse than none.

**Good, because they are checkable and specific:**

- "You've got 40-odd variants under [product family] and the size chart on the collection
  page disagrees with the one on the product page."
- "Your returns policy says 30 days and the FAQ says 14."
- "[Category] has [n] products and no filters, so finding a [specific thing] takes eleven
  clicks."

**Not good:**

- Anything complimentary. "Love what you're building" is filler and reads as a template.
- Anything you inferred rather than saw. "I imagine stock must be a headache at your scale."
- Anything about their traffic or revenue that you got from a tool. It is guesswork and they
  know their real number.
- Anything that reads as an insult rather than an observation. You are showing you looked,
  not auditing them for free.

If you cannot find one in five minutes, the prospect is probably too small or too opaque to
be one of your five.

### What is not in this email, on purpose

No attachment. No deck. No calendar link on the first touch, because it asks them to do the
work of choosing. No "as you may have seen." No mutual connection unless there genuinely is
one and you can name how. No deadline, no cohort, no "taking on three clients this quarter."
No price in the first email either: the price belongs in the call, where question 13 in
`qualification-call.md` can do its job.

---

## Follow-up cadence

Three touches, then stop. Spread over eleven days.

| | When | What |
|---|---|---|
| **Touch 1** | Day 0 | The email above. Tuesday to Thursday, morning in their timezone. |
| **Touch 2** | Day 4 | Four sentences. One new fact, not a repeat. Add the calendar link here. |
| **Touch 3** | Day 11 | Two sentences. Close the loop and say you will stop. |

**Touch 2:**

> Hi [Name] — one thing I left out. The part of that reference implementation most merchants
> fail isn't the integration, it's the approval gate: every write the merchant agent makes is
> staged until a person approves it, and most stores have no written rule about who that
> person is for a price change. That question alone is usually worth the twenty minutes.
> [calendar link] if it's easier than replying.

**Touch 3:**

> Hi [Name] — I'll assume the timing's wrong and stop here. If the catalog-and-systems side
> of this comes up later, reply to this and I'll pick it back up.

Then stop. Genuinely stop.

---

## When to stop contacting someone

Stop immediately, no further touches, on any of:

- **An explicit no**, in any wording. Reply once with thanks and one sentence of something
  useful. Do not ask why unless they have invited the question.
- **A request to stop, unsubscribe, or "please remove me."** Immediate and permanent.
- **No reply after touch 3.** Silence after three is an answer.
- **A hard bounce**, or an auto-reply saying they have left the company.
- **"Not now" with no date.** Log it, stop, and do not chase. If they name a month, put it in
  the calendar and contact them then, once.
- **Wrong person.** Ask once for the right name. If they give it, that is a fresh sequence to
  a new person. If they do not answer, stop.
- **Any reply that is annoyed.** One apology, no defence, no second attempt.

And one that is easy to talk yourself out of: **stop when the sequence is done even if you
have no other prospects.** Chasing a sixth touch to keep the pipeline feeling alive
contaminates the only measurement you are running.

---

## The pre-send checklist

Run it on each of the five, the morning you send.

- [ ] Name spelled correctly, and it is a person rather than a role account
- [ ] The store loads and is actually trading
- [ ] The OBSERVATION line is true today, checked on their live site, not from a cached tab
- [ ] The timing word ("this week") is still accurate, per the verify section above
- [ ] No quote you have not read at its source
- [ ] Two call slots named in *their* local time, converted correctly from UTC+2
- [ ] One link, and it resolves
- [ ] Under 150 words
- [ ] Nothing in it that would embarrass you if they forwarded it to someone who knows the
      reference implementation better than you do

---

## Tracking

| # | Merchant | Person | Sent | T2 | T3 | Reply | Call booked | Outcome |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | | | | | | | |

Outcome is one of: `call held`, `no`, `no reply`, `wrong person`, `deferred to [month]`.
"Interested" is not an outcome. The kill criterion in `README.md` counts calls held and money
received, and nothing else.
