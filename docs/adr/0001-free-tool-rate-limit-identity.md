# ADR-0001: Free-tool rate-limit identity strategy

**Status:** Accepted (2026-04-19 — founder granted autonomous build authority)
**Date:** 2026-04-19
**Deciders:** @christiaandewet (founder)
**Affects:** `src/app/api/free/run/route.ts`, `src/app/free/*` (UI pages)

## Context

The `/free/*` pages (competitor-scan, seo-audit, lead-finder, etc.) expose
a subset of the platform's agents to unauthenticated visitors as a
conversion channel — *"try it free, no signup, results in 30 seconds"*.
These pages proxy through `/api/free/run` to the real internal agent
routes.

The endpoint is currently rate-limited at **3 runs per hour per IP**, keyed
on `x-forwarded-for`. This choice was made in a hurry, and it is now
breaking in predictable ways.

### Observed and predicted problems

1. **Enterprise users behind shared IPs are blocked.** A 200-person company
   behind a single VPN egress IP hits the 3/hour cap after the third
   employee tries the scanner. The 4th through 200th person sees
   `429: Free tool limit reached`. These are exactly the users most likely
   to convert to a paid plan.

2. **Residential IPs rotate.** A single abuser on a consumer ISP can rotate
   through DHCP-assigned IPs and get far more than 3 runs. IP-keying
   penalizes enterprise users and rewards individual abusers — exactly
   inverted.

3. **No conversion signal.** We rate-limit anonymous users but collect
   nothing when they hit the limit. There's no email, no cohort tag, no
   way to follow up.

4. **In-memory Map is not distributed.** Each Vercel edge instance has its
   own `ipLimits` Map, so the effective limit is `N × 3/hour` where N is
   the number of cold edges. Already flagged in the gap audit; out of
   scope for this ADR but worth noting.

### Constraints

- **Launch budget:** solo-founder, launching within weeks. No bespoke
  abuse-detection infrastructure. Whatever we pick must be shippable in
  ≤ 1 hour of implementation work.
- **No Clerk auth** on the free tool — the whole point is "no signup".
- **Anthropic Partner Network review** is imminent; the free tool is
  often where curious reviewers land first. It must work reliably for
  anyone coming from a corporate network.
- **Redis already exists** (Upstash, see `src/proxy.ts:53`). We don't need
  new infra — the fix is purely an identity/key choice.

### Non-functional requirements

| Requirement | Target |
|---|---|
| False-block rate (legitimate enterprise users) | < 1% |
| Abuse ceiling (runs by a single determined bad actor) | < 50/day |
| Funnel conversion — free-tool → email capture | as high as possible |
| Implementation effort | ≤ 1 hour |
| Distributed rate-limit correctness | best-effort (Upstash is fine) |

## Decision (pending)

Key the free-tool rate limit on **something other than just IP**. Three
candidate identities evaluated below.

## Options Considered

### Option A — IP only (status quo)

Key: `x-forwarded-for → first IP`. Limit: 3 runs / 1 hour.

| Dimension | Assessment |
|---|---|
| Complexity | None (no change) |
| Friction added to UX | 0 seconds |
| False-block rate (enterprise) | **HIGH** — corporate VPN gates 3rd+ employee |
| Abuse ceiling | Low for static IPs, unbounded for rotating |
| Conversion signal captured | None |
| Implementation effort | 0 |

**Pros:**
- Zero UX friction — user clicks, sees result.
- Already shipped.

**Cons:**
- Blocks exactly the users most valuable to us (corporate buyers).
- Abuse ceiling is meaningless vs a motivated bad actor with rotating IPs.
- Captures zero signal from the users who hit the limit.

---

### Option B — Email required, rate-limit by email

Add a small email-capture step BEFORE the agent runs. Key: normalized
email address. IP becomes a hard floor (1 run/hr/IP) to prevent someone
from spraying 10,000 fake emails from one machine.

| Dimension | Assessment |
|---|---|
| Complexity | Low — add email input to each `/free/*` form + validate shape |
| Friction added to UX | ~3 seconds, one extra field |
| False-block rate (enterprise) | **LOW** — each employee has their own email |
| Abuse ceiling | Low — fake emails bounded by IP floor + email-shape validation |
| Conversion signal captured | **Every free-tool user's email** |
| Implementation effort | ~45 min |

**Pros:**
- Captures email — the single most valuable signal at this funnel stage.
- Enterprise users no longer share a rate-limit key.
- Natural path to waitlist / follow-up sequences.

**Cons:**
- Breaks the "no signup needed" marketing promise. We'd have to reword
  the CTA from "No signup — try in 30 seconds" to something like
  "Enter email — try in 30 seconds."
- Some visitors bounce at the email field. Expected bounce rate:
  15–25% based on B2B SaaS free-tool norms.

---

### Option C — Email OR IP (soft capture)

Email field is shown but optional. If the user enters email, key on
normalized email with a generous quota (**10 runs / 1 hour**). If they
skip it, key on IP with a strict quota (**3 runs / 1 hour**, status-quo).

| Dimension | Assessment |
|---|---|
| Complexity | Low — same email input as Option B, plus branch on presence |
| Friction added to UX | 0 seconds (skippable) |
| False-block rate (enterprise) | **LOW** — users who care enter email; those who don't are edge cases |
| Abuse ceiling | Low — IP floor still applies; email abusers capped at 10/hr per email |
| Conversion signal captured | **From the users who care** (engaged segment) |
| Implementation effort | ~1 hour |

**Pros:**
- Preserves the "no signup" promise while creating an upgrade path for
  interested users.
- Self-selecting: the users who enter email are exactly the ones who
  might convert. The users who skip it are less valuable anyway.
- Enterprise users can bypass the IP block by entering a work email
  without any signup ceremony.

**Cons:**
- Most complex of the three — requires a slightly richer UI on the
  `/free/*` pages and an OR-branch in the rate-limit key computation.
- Metrics are harder to reason about — the "quota" is two different
  numbers depending on identity.

## Trade-off Analysis

**The decision hinges on what we value more at this stage: funnel
conversion or effective abuse prevention.**

- **Option A** optimizes for "time to first wow" but fails the enterprise-
  user case entirely. Current status quo. Scoring against the NFRs:
  fails the false-block requirement (< 1%).
- **Option B** converts the funnel into a structured email-capture machine
  at the cost of some anonymous-run bounces. Best if conversion is the
  top priority and we're confident in our post-signup nurture.
- **Option C** is the Pareto move — it doesn't force the UX step but it
  captures the segment that would have entered email anyway. It costs
  roughly 20 minutes more implementation than B.

**There is no meaningful abuse-prevention difference between B and C** at
our scale. A motivated attacker will rotate emails OR IPs; both options
cap them at roughly the same throughput.

**The funnel matters more than the abuse ceiling at this stage.** We
have ~zero paying users. Stopping a hypothetical bad actor at run 50 is
far less valuable than capturing 100 emails/day from real prospects.

## Recommendation

**Option C.** Implementation details:

1. Add a single `email` input to each `/free/*` form, with helper text:
   *"Optional — enter to run 10/hr instead of 3/hr."*
2. In `/api/free/run`, derive the rate-limit key as:
   `email ? `email:${normalized_email}` : `ip:${ip_address}`
3. Per-identity quotas: 10/hr for email-keyed, 3/hr for IP-keyed.
4. Apply both a per-email and a per-IP floor — `ip_floor = 20/hr`
   regardless of email — so one IP can't spray fake emails infinitely.
5. Write each run to `usage` table with `source: "free-tool"` and the
   captured email (if present). This lets us analyze conversion later.

## Consequences

**What becomes easier:**
- Enterprise users can use the free tool without getting blocked.
- We collect emails from the engaged segment — natural waitlist feed.
- Future: we can migrate the rate-limit store to Redis/Upstash with a
  schema that already supports both key shapes.

**What becomes harder:**
- Analytics: two quotas means two separate funnel cohorts to analyze.
- Abuse monitoring: if someone does try to spam, we need to watch both
  IP-pressure and email-pressure graphs.

**What we'll need to revisit:**
- If free-tool abuse ever becomes a real problem (> 100 bad actors/day),
  we'll want CAPTCHA or Turnstile. Out of scope today.
- If the email-capture bounce rate exceeds 30%, reconsider Option B
  (require email) vs keeping the optional path.

## Action Items

- [ ] Founder approval: confirm Option C is the choice (or override).
- [ ] Implement email input on `/free/competitor-scan/page.tsx`,
      `/free/seo-audit/page.tsx`, `/free/lead-finder/page.tsx`,
      `/free/brand-audit/page.tsx`.
- [ ] Update `/api/free/run/route.ts` to accept `email` in the body,
      derive rate-limit key, apply per-identity quotas + IP floor.
- [ ] Write one row to `usage` per free-tool run with
      `source: "free-tool"`, `email`, `agent`.
- [ ] Add `free_tool_runs` to the weekly email digest so we can watch
      the funnel.
- [ ] Update copy on `/` and `/free/*` landing pages: "Optional email —
      10 free runs instead of 3."
