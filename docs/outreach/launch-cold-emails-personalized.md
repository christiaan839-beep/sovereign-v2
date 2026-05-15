# Launch — 5 personalized cold emails (SA compliance buyers)

Specific named targets, real signal slots, ready to send Monday morning.

**These are STARTING POINTS, not finished sends.** Each requires you to:

1. Confirm the recipient is still in the role (LinkedIn check, ~30 sec)
2. Update the `[SPECIFIC SIGNAL]` slot with something the recipient
   actually said/posted in the last 60 days
3. Sign off with your name

If a recipient has moved companies, replace with someone in the same
seat at a peer firm — the template works for any SA mid-market
compliance / risk / legal-tech CTO.

---

## #1 — Allan Gray (asset management, Cape Town)

**Why this target:** R1.1 trillion AUM. Heavy SA financial-services
regulator scrutiny. Public AI investments in 2025 mean their tech
team is sourcing AI compliance answers RIGHT NOW.

**Find:** LinkedIn search `"Allan Gray" + ("Head of Technology" OR "CTO" OR "Head of Risk Tech" OR "Chief Information Officer")`. Cross-reference against `allangray.co.za/about-us`.

**Subject:** `[FIRST NAME] — POPIA s.71 + AI agents (90s walkthrough)`

**Body:**

```
Hi [FIRST NAME],

[SPECIFIC SIGNAL — e.g. "Saw your panel at AI for Financial
Services SA last month — the part where you said 'my audit team
won't sign off until they can see what the model decided' is
exactly the wall I built this for."]

Most SA financial-services teams I talk to hit the same blocker:
POPIA s.71 + the FAIS Code of Conduct require explainability +
audit trail for any automated decision affecting a client. Most
AI vendors can't satisfy either.

We built Sovereign Matrix to solve specifically that. Every agent
run produces an HMAC-SHA256-signed receipt, anchored in a Merkle
chain, optionally notarized via Bitcoin (OpenTimestamps). Third-
party verifiable. POPIA + EU AI Act native. Format is open
(VAOS 1.0, public domain).

Live demo (no signup): https://sovereignmatrix.agency/verified
Spec: https://sovereignmatrix.agency/spec
90s Loom: [LOOM URL]

Worth 20 minutes? Happy to show a real agent run + the auditor
workflow end-to-end.

[YOUR NAME]
Sovereign Matrix
```

---

## #2 — Stitch (B2B payments infra, Cape Town)

**Why this target:** Y Combinator W19 grad, $4M+ ARR fintech infra,
Series B $46M closed mid-2024. They're a case study for SA
fintech that scales — and they hire AI engineers actively. Their
compliance team is the gatekeeper between AI experimentation and
prod payments flow.

**Find:** LinkedIn `"Stitch" + ("Head of Engineering" OR "VP Engineering" OR "Head of Compliance" OR "Risk")`. Founders Junaid Dawjee + Kiaan Pillay are reachable on Twitter; their head of compliance / engineering is the actual buyer.

**Subject:** `Stitch + audit-grade AI receipts (open spec, MIT verifier)`

**Body:**

```
Hi [FIRST NAME],

[SPECIFIC SIGNAL — e.g. "Your engineering blog post on payment
agent automation was excellent — particularly the part about
needing 'tamper-evident decision logs.'"]

If you're considering deploying AI agents anywhere near payment
flows, the SARB and the FSCA are going to ask the same question
in 2026: "show me the audit trail." Most agent platforms can't.

We open-sourced VAOS 1.0 (Verifiable Agent Output Spec) — every
receipt is HMAC-signed + Merkle-chained, with an Ed25519 v2
extension for non-repudiation. The reference verifier is
@sovereign-matrix/vaos-verifier (MIT, zero deps, Node + browser
+ edge). You can verify any signed receipt without us.

Live demo: https://sovereignmatrix.agency/verified
Spec: https://sovereignmatrix.agency/spec

Quick chat? 20 min. I can walk through the SARB/FSCA-aligned
audit workflow + show how you'd embed the verifier in a payment
agent.

[YOUR NAME]
Sovereign Matrix
```

---

## #3 — Bowman Gilfillan / ENS / Webber Wentzel (top-3 SA law firms)

**Why this target:** 1000+ attorneys each. Already deploying AI
for legal research / document review. POPIA + LSSA professional-
conduct rules require auditable decision trails in any tool a
lawyer uses for client-affecting work. They're the wedge buyer
because they have hard regulatory requirements + budget.

**Find:** LinkedIn `("Bowman Gilfillan" OR "ENSafrica" OR "Webber Wentzel") + ("Head of Innovation" OR "Director of Technology" OR "Knowledge Management Director" OR "AI" OR "RegTech")`. Look for names in their published 2025 AI policy / sustainability reports.

**Subject:** `[FIRST NAME] — verifiable AI for legal research engagements`

**Body:**

```
Hi [FIRST NAME],

[SPECIFIC SIGNAL — e.g. "I noticed [FIRM]'s 2025 AI policy
emphasized the need for audit trails on AI-assisted research.
Most firms are still treating that as policy aspiration —
the technical primitives haven't existed yet."]

Sovereign Matrix is the first agent platform that satisfies
the LSSA and POPIA s.71 audit-trail requirements out of the
box. Every AI run produces a cryptographically signed receipt
(HMAC v1, Ed25519 v2). Merkle-chained across the firm's full
history. Optionally Bitcoin-notarized for legal-grade temporal
proof.

For your use case specifically: every research query, every
document-review pass, every brief draft can be linked to a
permanent receipt URL. When opposing counsel asks "how did
you arrive at this conclusion?" — you produce the receipt.

Live demo: https://sovereignmatrix.agency/verified
The spec is open + public domain: https://sovereignmatrix.agency/spec
We're not asking [FIRM] to lock in to a proprietary format.

20 min next week to show the firm-side audit dashboard?

[YOUR NAME]
Sovereign Matrix
```

---

## #4 — Discovery / Momentum / Old Mutual (insurance + healthtech)

**Why this target:** Discovery Health alone covers 4M+ lives.
Vitality has been running ML risk-scoring for years. They have
a hard regulatory wall: POPIA + the Council for Medical Schemes

- the new AI in Healthcare draft regulations. They cannot deploy
  black-box AI. They WILL pay for compliance substrate.

**Find:** LinkedIn `("Discovery" OR "Momentum" OR "Old Mutual") + ("AI Ethics" OR "Head of Data Science" OR "Chief Risk Officer" OR "Head of Healthtech")`. Adrian Gore (Discovery CEO) is the wrong target — find the engineering head.

**Subject:** `Audit-grade AI for SA healthtech — POPIA + draft AI-in-healthcare regs`

**Body:**

```
Hi [FIRST NAME],

[SPECIFIC SIGNAL — e.g. "Your work on ML risk-scoring at
Discovery is the gold standard in SA. The 2026 draft AI in
Healthcare regulations are going to require everything you
already do — plus tamper-evident audit trails on every
automated decision affecting a covered life."]

We built Sovereign Matrix to make those audit trails possible.
Every AI agent decision produces a cryptographically signed
receipt. POPIA s.71 + the draft AI-in-Healthcare's Section 4
(automated decision explainability) compliance is the design
target.

Specifically for healthtech: the receipt format (VAOS 1.0)
records inputs, model class, safety check results, output —
without exposing PHI, because the canonical projection respects
Section 23 right-of-access boundaries.

Live demo: https://sovereignmatrix.agency/verified
Open spec: https://sovereignmatrix.agency/spec
Receipt diff (regression-test for AI clinical decisions):
  https://sovereignmatrix.agency/r/<id>/diff/<other>

Worth 30 minutes? I can show how a Discovery-style risk-scoring
model integrates with the receipt layer + the audit-bundle
export your regulator would receive.

[YOUR NAME]
Sovereign Matrix
```

---

## #5 — Standard Bank / Nedbank / Investec (banking — AI for KYC + AML)

**Why this target:** Top SA banks are mid-deployment of AI for
KYC + AML. The Banks Act + POPIA + FIC Act all require
auditable decision trails. The SARB has an active 2026 review
of "AI in financial services governance" — banks moving early
will either set the standard or chase it.

**Find:** LinkedIn `("Standard Bank" OR "Nedbank" OR "Investec") + ("Head of AI" OR "Chief Data Officer" OR "Head of Financial Crime" OR "Head of RegTech")`.

**Subject:** `For [BANK]'s KYC/AML AI — verifiable decision receipts (open spec)`

**Body:**

```
Hi [FIRST NAME],

[SPECIFIC SIGNAL — e.g. "Saw [BANK]'s recent SARB submission
on AI governance — the section on 'auditable inference' is
exactly the gap the industry hasn't solved technically."]

We solved it. Sovereign Matrix produces a cryptographically
signed receipt for every AI agent decision. The format is open
(VAOS 1.0, public domain) so [BANK] doesn't lock into a vendor.
POPIA + FIC Act + the Banks Act audit-trail requirements are
the design target.

For KYC/AML specifically: every model decision (high-risk
flag, customer risk band, transaction-monitoring trigger)
produces a receipt that includes inputs, model used, safety
check results (PII detection, content policy, jailbreak guard,
quality score), and output. Receipts are Merkle-chained across
the bank's history — silent record tampering is mathematically
detectable.

Live demo: https://sovereignmatrix.agency/verified
Open spec: https://sovereignmatrix.agency/spec
Audit-bundle export (the artifact for SARB on-site reviews):
  https://sovereignmatrix.agency/api/me/audit-bundle

Happy to schedule 30 minutes with your AI governance team.
We have one SA financial-services design partner already and
can introduce.

[YOUR NAME]
Sovereign Matrix
```

---

## Send sequencing (apply to all 5)

| Day       | Action                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| Mon       | Send all 5 emails. Send LinkedIn connection + 200-char DM mirroring email opener.      |
| Thu       | Forward each unread email with one line: "Bumping — open to a 15?"                     |
| Mon+1 wk  | Final follow-up linking to a NEW asset (blog post, customer case, etc). Then stop.     |
| Mon+3 wks | Move non-responders to "no-signal" bucket. Don't email same person again for 6 months. |

## Tracking template (single spreadsheet column per send)

```
Sent      | Name      | Role          | Company      | Industry   | Loom views | Email opens | LinkedIn views | Reply  | Demo? | Notes
2026-05-12| J. Doe    | Head of Risk  | Allan Gray   | Asset mgmt | (auto)     | (auto)      | (manual)       | Y/N    | Y/N   | "Asked for SOC2 timeline"
```

## After 30 sends — calculate

- **Open rate.** <30% = subject line problem. Iterate.
- **Loom view rate.** <40% of opens = thumbnail/curiosity gap. Iterate.
- **Reply rate.** <2% = wrong target persona OR pitch is off. Pivot ICP.
- **Demo conversion.** <30% of replies = ask is unclear. Tighten CTA.

## What if none of these reply

The most common cause is target mismatch, not message mismatch.
After 30 sends with 0 replies: drop SA-specific framing and try
the same 5 templates with **EU mid-market regulated industries**
(insurance, pharma, banking) where EU AI Act enforcement is the
binding constraint instead of POPIA. Use LinkedIn with `"Head of
AI Governance"` + EU country filters.

If THAT also returns nothing after 30 more sends, the wedge is
genuinely wrong — pivot to a different ICP entirely (e.g.
agentic AI infra for AI insurance underwriters, or audit firms,
not end customers).
