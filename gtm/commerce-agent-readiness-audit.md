# Commerce Agent Readiness Audit

**$2,500 USD / R40,000 · five working days · fixed price**

A written assessment of whether your systems can support a commerce agent, what it would
take, and whether it is worth doing. The output is four documents. There is no code, no
prototype, and no demo.

---

## Why this is a question worth paying to answer

Anthropic published an open-source reference implementation for commerce agents in the last
two weeks, Apache-2.0. It contains two working agents: a shopping agent customers talk to,
and a merchant agent staff use to run the back office. Both are complete except for one thing.
Each stops at an abstract interface that has to be implemented against real systems:
11 methods on the shopping side (`StorefrontBackend`), 16 on the merchant side
(`MerchantBackend`). The example implementations that ship with it are in-memory mocks.

Shopify's agent tooling covers the buyer's side of the same problem: product search across
merchants, carts, checkout, order tracking, capability discovery.

So the blueprint is public and free, and the part that touches your catalog, your orders,
your inventory, your pricing and your analytics is not written. That gap is where the cost,
the risk and the decision live. This audit measures it before you spend anything on it.

---

## What you get

Four documents, delivered as files you keep. Not slides.

**1. Backend coverage map.** One row for each of the 27 abstract methods, named individually,
mapped against the system that would have to answer it in your business. Each row is marked
as answerable today through an existing API, derivable with work, or not available, with the
named system and the specific gap. This includes the methods people forget: staged writes
(`stage_price_update`, `stage_inventory_action`, `stage_promotion`, `stage_campaign`,
`stage_listing_update`), the change lifecycle (`get_pending_changes`, `apply_change`,
`discard_change`), and the two that decide whether the merchant agent can explain anything
at all (`get_business_snapshot`, `query_metrics`).

**2. Safety-gate assessment.** The reference implementation enforces a specific set of rules
in code rather than in prompts. This document assesses your situation against each of them:

- Fencing of third-party content, and which of your data sources are third-party text
- Provenance gates on cart writes and on staged writes, and whether your ids can carry it
- Caps checked when a change is staged and again when it is applied, and what your safe
  values are for items per change, price move, promotion depth, restock size, campaign budget
- Memory write validation, and which customer facts you must never store
- The host approval gate: every merchant write is staged until a person approves it. This
  is the one that usually fails, because most merchants have no approval surface and no
  written rule about who may change a price. The assessment names who that person is in
  your business, or says that no such person exists yet.

It also covers what the reference explicitly leaves to the deployment: authentication,
credential handling, rate limits, business rules, payment, memory as personal data, log
hygiene, the approval surface, and the fact that every guardrail value in the reference is
a demonstration number, not a recommendation.

**3. Scoped implementation plan with effort.** Per method and per gate, in working days,
sequenced, with the dependencies named. It says what a first version can leave out and what
it cannot, and it separates the work that is integration from the work that is a change to
how your business operates. Effort is stated as a range with the assumption behind it.

**4. A written go/no-go.** One page. A recommendation, the two or three facts it rests on,
and the specific condition that would change it. It is allowed to say do not build this,
and if that is what the evidence says, that is what it will say. You are paying for the
answer, not for a yes.

---

## Timing

Five working days from the kickoff call. Days one and two are the coverage map, day three is
the safety assessment, day four is the plan, day five is the recommendation and a 45-minute
walkthrough. If your documentation arrives late, the clock starts when it arrives, and I
will tell you that on the day rather than at the end.

## Terms

Fixed price. 50% to start, 50% on delivery. If the delivered documents do not contain the
four things listed above, do not pay the second half.

Priced in USD or ZAR at your choice. The ZAR price is fixed for 30 days from the date I send
this; currency movement inside that window is my problem, not yours.

## What I need from you

- A 90-minute kickoff call with someone who knows how your catalog, orders and pricing
  actually work in practice, not just on paper
- API documentation for your commerce platform, or read access to a sandbox. **I do not need
  production credentials and I do not need customer data.** If your documentation is good
  enough, I need nothing else.
- Two 30-minute follow-up calls during the week with the same person
- A straight answer to one uncomfortable question: who is allowed to change a price today,
  and how long does it take from decision to live

## What this does not include

- No code. No adapter, no integration, no prototype, no demo, no agent.
- No deployment, no hosting, no infrastructure work.
- No data migration or catalog cleanup.
- No vendor selection or procurement help beyond naming what your current stack can and
  cannot support.
- No security certification, audit opinion, or penetration test.
- No legal or regulatory advice. The safety assessment is against the reference
  implementation's engineering rules, not against any law.
- No commitment from either of us to work together afterwards. If the recommendation is to
  build, you own the plan and can hand it to anyone, including someone cheaper than me.

---

## Who is doing the work, honestly

I am one person, working from Cape Town (UTC+2). This is a new practice. You would be the
first client for this audit. I have no case studies for it, no reference customers to put
you in touch with, and no client logos to show you, because there are none.

What I can give you instead of testimonials is code you can read before you decide:

- Nine open-source compliance evidence exporters covering EU AI Act Annex IV, ISO/IEC 42001,
  ISO/IEC 23894, NIST AI RMF 1.0, SOC 2, GDPR DPIA and RoPA, the HIPAA Security Rule, the EU
  Cyber Resilience Act, and cryptographic anchoring of AI policy documents.
- A separate receipts library, Apache-2.0, 74 tests, zero runtime dependencies. It is not
  published to a package registry yet, and I am not going to describe it as if it were.

I hold no SOC 2 and no ISO certification. That is the reason the audit is designed to run on
documentation rather than on access to your production systems. I will sign an NDA.

If you want a vendor with staff continuity and an insurance certificate, this is the wrong
engagement, and I would rather you know that now than in week three.

---

## To start

Reply with a date for the kickoff call. I will send an invoice for the first 50% and a
one-page list of the documents I need. If you would rather talk for 20 minutes before
committing to anything, that is the better first step and it costs nothing.
