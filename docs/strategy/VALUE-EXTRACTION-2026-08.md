# Value Extraction & Income Strategy — August 2026

> Written against the code as it stands on 2026-08-26, not against the marketing.
> Every number here was read out of the repos or verified against a live registry.
> Companion to `BACKLOG.md` (what's left to build). This file is *what's worth money and why*.

---

## 0. The one-paragraph answer

Across five repos there is exactly **one asset that nobody else has**, and it is not
the agent platform. It is the **VAOS verifiable-receipt stack**: a CC0 wire spec with
an IETF draft, 24 implementation packages across TypeScript/Go/Python, post-quantum
dual-signing (Ed25519 + ML-DSA-65), a transparency log with independent witnesses,
and eight regulator-mapped compliance packs. It is ~95% built, genuinely
above-market, and **completely invisible** — zero of the 24 packages are published
to npm. The 140-agent platform wrapped around it is, by the repo's own honest
accounting, 1.4% real. The strategy is therefore not "build more agents." It is
**ship the receipt layer as public infrastructure, and sell the scarce human
judgment that installing it requires.**

---

## 1. Asset audit — what is actually in the five repos

### Tier A — defensible, scarce, yours

**The VAOS receipt stack** (`sovereign-v2/packages/`, `docs/specs/`, `src/lib/`)

| Component | Evidence in repo | State |
| --- | --- | --- |
| Wire spec, 9 documents | `docs/specs/vaos-{1,2,3}.0.md`, `vaos-rsa-1.0`, `vaos-trs-1.0`, `vapt-1.0`, `transparency-log.md` | Written, CC0 |
| IETF Internet-Draft | `docs/specs/ietf-draft-vaos-00.md` — expires 19 Nov 2026 | Drafted |
| Reference impl (TS) | `packages/verifiable-receipts` v0.3.0, **22 tests** | Built, unpublished |
| Ports | `verifiable-receipts-go`, `verifiable-receipts-py` | Written, 0 tests |
| Vendor adapters | `anthropic-receipts`, `openai-receipts`, `google-receipts`, `ai-sdk-receipts` | Written, 1 test each |
| Compliance packs (8) | `hipaa-security`, `iso-42001`, `iso-23894`, `nist-ai-rmf`, `eu-cra`, `gdpr-dpia`, `soc2-evidence`, `annex-iv` | Written |
| Verification surface | `packages/cli` (`sovereign-verify`), `packages/verify-action` (GitHub Action, **the only package with a `dist/`**) | Built |
| Post-quantum signing | `src/lib/pq-sign.ts` + `pq-sign.test.ts`, ML-DSA-65 | Real, tested |
| Transparency log + witnesses | `src/lib/transparency-append.ts`, `witness-store.ts`, `merkle-receipt-batch.ts`, `receipt-ratchet.ts`, `multi-party-attestation.ts` | Real |
| Deletion / capability / defense receipts | `deletion-receipts.ts`, `capability-receipts.ts`, `defense-receipts.ts` | Real |

Roughly **30 receipt/audit modules** in `src/lib` alone. `BACKLOG.md` rates the
cryptographic infrastructure at **~95%** and calls it "genuinely above-market.
Bleeding-edge ML-DSA-65 in production is rare." That assessment holds up against
the code.

**Why it is defensible:** the moat is not the code (it's Apache-2.0/CC0 on purpose).
The moat is being *the author of the format* at the moment regulators start asking
for one. EU AI Act Annex IV, ISO 42001, and NIST AI RMF all create demand for
exactly this artifact, and the packs are already mapped to them.

### Tier B — real engineering, commodity value

**The Sovereign Matrix platform** — 274k LOC, 413 API routes, 274 lib modules,
250 test files / ~4,491 passing tests, 140 registered agents, 26 vertical `/for-*`
pages, 7 payment providers, multi-tenant + RBAC + white-label.

This is a serious application. It is also, in market terms, one of thousands of
AI agent platforms. Its honest self-assessment:

- Agent layer, multi-step tool use: **1.4%** (2 of 140)
- Agent layer, memory-aware: **15%** (21 of 140)
- DAG executor for playbooks: **0%** — still a `for` loop; `swarm-protocol.ts` (299 LOC) has zero callers
- Marketing claims vs. actual certifications: **~30%**

**Value here is as proof, not as product.** It is the reference deployment that
shows the receipt layer works under real load, with real payments, in real
regulated verticals. That is worth a great deal — as a demo and a case study.
It is worth much less as "yet another agent marketplace."

### Tier C — real but overlapping

**Umbra-V2** — 33k LOC, 122 API routes, B2B lead-gen agents + ChromaDB RAG loop +
Python daemon. Competent, smaller, and substantially subsumed by sovereign-v2.
Its distinct pieces are the **local vector memory loop** and the **Python agent
daemon** (`nemo_ghost.py`, `nemoclaw_os.py`) — the on-prem story sovereign-v2
lacks. Treat it as a **source of parts**, not a second product to maintain.

### Tier D — not yours

**`skills/`** (17 Anthropic skills) and **`claude-plugins-official/`** (31 plugins +
external) are forks of Anthropic's public repos. Zero proprietary value.
**Their real use is as a packaging template** — they are the canonical example of
how Anthropic expects capability to be shipped, and Section 4 uses that directly.
**`christiaan839-beep/`** is a profile README.

---

## 2. The slop diagnosis — name it precisely

"Generic AI slop" is not a style problem. It has a measurable signature, and this
codebase has it in exactly one place.

**140 agents. 138 of them are a single prompt wrapped in a route handler.**
That is the definition of the thing. The LinkedIn post in the brief — "50 AI agents
for SEO," each "a setup guide, not a loose prompt" — is the same pattern at a
different scale. It is content, not capability. An agent that cannot take a second
step, cannot remember, and cannot prove what it did is a prompt with a URL.

Three tests to apply to anything before building it:

1. **Can it take a second step?** If the output is one model call, it is a prompt.
2. **Would anyone pay if a competitor gave it away free tomorrow?** Prompts fail this. Verification does not.
3. **Does it produce an artifact that survives you?** A signed receipt verifiable in 2040 passes. A chat transcript does not.

The receipt layer passes all three. The agent fleet passes none. **Stop widening
the fleet.** Every hour spent on agent #141 is an hour not spent on the only thing
here that is scarce.

**Corollary — the fleet is not waste, it is the corpus.** 140 agents across 26
regulated verticals is a large, honest test set for the receipt layer. It is the
reason the crypto is battle-tested rather than theoretical. Keep it, run it,
stop growing it.

---

## 3. The single highest-leverage finding

> **`npm view @sovereign-matrix/verifiable-receipts` returns 404.**
> So does `@sovereign-matrix/vaos-verifier`. All 24 packages are unpublished.

`docs/WHY-VAOS.md` is a well-argued adoption pitch that tells an evaluating
engineer to run:

```bash
npm install @sovereign-matrix/verifiable-receipts
```

**That command fails today.** The document also argues the format is durable
because "the npm tarball is immutable" — an argument that is only true once the
tarball exists.

Everything else in this strategy is weeks of work. This is an afternoon:
build the packages (only `verify-action` has a `dist/`), publish the four that
matter, verify the README commands actually run. Until that happens the strongest
asset in five repos has an adoption funnel with a 404 at the top.

**Second-order fixes in the same pass:**

- `verifiable-receipts` has 22 tests. The two ports (Go, Python) and `vaos-verifier`
  have **zero**. A spec whose reference verifier is untested is not a spec anyone
  will stake a compliance filing on. Port the 22 tests as cross-language conformance vectors.
- The IETF draft **expires 19 Nov 2026**. Either resubmit or let it lapse deliberately —
  but do not cite a dead draft in sales material.

---

## 4. What to create — three products, one asset

The receipt layer supports three offers at three price points from one codebase.
Ordered by time-to-first-revenue.

### 4.1 The open standard (free — this is the distribution, not the product)

Publish the packages. Publish the spec site. Publish the GitHub Action.
Nothing here is monetized directly; it is how the other two get found.

The `claude-plugins-official` and `skills` forks are the template: ship a
**`vaos-receipts` Claude Code plugin + skill** that wraps `verifiable-receipts` so
any Claude Code user can add signed receipts to their agent in one command. That is
the distribution channel that already exists for exactly this shape of capability,
and it is currently unused.

**Success metric:** installs and third-party verifiers, not revenue.

### 4.2 Verification-as-a-service (recurring, self-serve)

The one thing an adopter genuinely cannot self-host is the part that must be
**independent of them**: the transparency log, the witness set, and the public
verification endpoint. A receipt you sign and store yourself proves nothing to a
regulator. `witness-store.ts` and `transparency-append.ts` already implement this.

This is the honest SaaS line, and it is a much better business than agent runs:
the customer is buying third-party attestation, which by definition cannot be
in-sourced.

**Price on receipts anchored and witness count, not "agent runs."**

### 4.3 Compliance implementation engagements (the income, near-term)

This is where fair money actually comes from in the next two quarters, and it is
the offer the Claude Partner Network is built to route.

An EU AI Act Annex IV technical file, an ISO 42001 evidence pack, or a NIST AI RMF
mapping is a **£15k–60k consulting engagement** at any firm. You have the eight
packs pre-built and a reference implementation that generates the evidence
automatically. The work is judgment: scoping the system, mapping the controls,
signing off. The artifact generation is already done.

**This is the anti-slop business model.** The commodity part (document generation)
is automated and given away. The scarce part (a named human who understands both
the regulation and the cryptography, and will put their name on the file) is what
gets billed. That is fair income in the exact sense — paid for judgment and
accountability, not for tokens.

---

## 5. Fair income — concrete lines, honest numbers

| Line | Mechanism | Realistic 6-month | Confidence |
| --- | --- | --- | --- |
| Compliance engagements | 2–4 Annex IV / ISO 42001 files at £15–40k | £30k–120k | Medium — needs 1 reference client |
| CPN inbound (directory) | Partner Directory listing → qualified leads | Feeds the line above | Medium — listing is free, gated on Select tier |
| Verification-as-a-service | Witness + transparency-log subscriptions | £0–2k MRR | Low — needs the standard adopted first |
| Platform SaaS (existing tiers) | $19/$49/$199/$499 self-serve | Marginal | Low — undifferentiated |
| Sponsored / grant funding | `docs/darpa-sbir.md`, `docs/grants` already drafted | Lumpy, non-dilutive | Medium — the PQ-crypto angle is genuinely fundable |

**The ordering matters.** Services fund the standard; the standard makes the
services defensible; the SaaS only works after both. Trying to lead with SaaS is
what produces slop, because it pressures you to widen the agent fleet to justify
the subscription.

### Fix the ZAR pricing before selling anything

`src/lib/plans.ts` prices the same plans inconsistently by currency:

| Plan | USD | ZAR | Implied rate |
| --- | --- | --- | --- |
| Starter | $19 | R349 | ~R18/$ — correct |
| Array | $49 | R4,997 | **~R102/$ — 5.5x** |
| Node | $199 | R9,997 | **~R50/$ — 2.8x** |
| Enterprise | $499 | R49,997 | **~R100/$ — 5.5x** |

A South African customer on Array pays roughly **$270 for a $49 plan**.
`BACKLOG.md` correctly flags this as needing an operator decision — but note this
is a home-market fairness problem, not just a pricing bug. Decide deliberately
and document the decision. Charging your own market 5x is the opposite of the
mission in Section 6.

---

## 6. The mission — worth stating plainly

The AI industry is about to be asked, by regulators and by customers, to prove what
its systems did. Most vendors will answer with internal logs, which is a request to
be trusted. The alternative is an artifact that a third party can check without the
vendor's cooperation, and that still verifies in 2040 when the vendor may not exist.

**Build the public format that makes AI decisions checkable by the people they
affect — and make the format free, so nobody has to trust us either.**

The commercial model follows from the mission rather than fighting it:
give away the spec, the code, and the document generation; charge for independent
attestation and for expert human sign-off. Both are things that *should* cost
money, because both consume something genuinely scarce.

This is also why the agent fleet has to stop growing. Every generic agent added
dilutes the claim that this is an infrastructure company and reinforces the read
that it is an AI content farm with good crypto attached.

---

## 7. The next five weeks (CPN tier review is 1 October)

The Claude Partner Network newsletter sets three real dates. Working backwards:

**By 31 August (5 days)**
- [ ] **Publish the 4 core npm packages** — `verifiable-receipts`, `vaos-verifier`, `anthropic-receipts`, `cli`. Verify every README command runs. *This is the single highest-value afternoon available.*
- [ ] Complete the **Voice of the Partner survey** (Partner Hub → Flows) — deadline 31 Aug.
- [ ] Complete the **Partner Directory profile**. Lead with the receipt/compliance practice, not the agent platform.

**By 15 September**
- [ ] Port the 22 `verifiable-receipts` tests to Go + Python as **cross-language conformance vectors**. This is what makes it a spec rather than a library.
- [ ] Ship the **`vaos-receipts` Claude Code plugin + skill**, using `claude-plugins-official/` as the structural template.
- [ ] Decide and document the **ZAR pricing** question.
- [ ] Resubmit or deliberately retire the **IETF draft** (expires 19 Nov).

**By 1 October (tier review)**
- [ ] **Nominate one customer story.** Approvals take weeks and public stories are one of three tier criteria. One real deployment of the receipt layer, named, beats any amount of platform breadth.
- [ ] Register every client Services engagement in the Partner Hub — these count toward tier.
- [ ] Sign up for the **certification SME network**. Low cost (five minutes, no commitment), and being on the panel that defines what Claude practitioners are tested on is precisely the positioning this strategy needs.

**Explicitly not doing:** agents #141+, the DAG executor, memory opt-in for the
remaining 119 agents. All three are real backlog items. None of them move tier,
revenue, or the moat before 1 October.

---

## 8. What to do with the other repos

| Repo | Decision |
| --- | --- |
| `sovereign-v2` | Primary. Freeze agent-fleet growth; all effort to `packages/` + publishing. |
| `Umbra-V2` | Harvest the ChromaDB memory loop and the Python daemon into sovereign-v2 as the on-prem story. Then archive — do not maintain two platforms. |
| `skills` | Reference only. Use as the template for the VAOS skill. |
| `claude-plugins-official` | Reference only. Use as the template for the VAOS plugin. |
| `christiaan839-beep` | Profile README — point it at the spec, not the platform. |

---

## 9. The one-line test for every future wave

> **Does this make an AI decision checkable by someone who does not trust us?**

If yes, build it. If no, it is agent #141.
