# The Ten — Sovereign Matrix Claude Partner Network Roster

**Prepared for:** Karl Kadon, Head of Partner Experience, Anthropic
**Prepared by:** Christiaan de Wet, Founder, Sovereign Matrix
**Date:** April 2026 (pre-portal launch)

---

## Framing

Sovereign Matrix operates an **agent-augmented delivery model**. We are
not a traditional consulting firm staffing bodies against customer
engagements. We are a product company whose day-to-day engineering,
customer delivery, and strategic work are distributed between **human
leads and specialized Claude-driven agents** running inside our own
platform.

This document identifies the **ten roles** we would anchor a Partner
Network training path around — a mix of the single human founder and
the named production agents that operate as co-delivery nodes.

This is an unconventional answer to "pick your ten," and it reflects
how the company actually functions today. We believe it is closer to
the direction the Partner Network is heading than the traditional
"5 delivery leads, 3 architects, 2 customer engagement" template, and
we make that case explicitly here.

> **To be transparent:** Sovereign Matrix is currently solo. Christiaan
> de Wet is the single human on this roster. The other nine slots are
> filled by production Claude surfaces — named agents that perform
> real work today (reasoning, synthesis, QA, delivery). We would rather
> be honest about this than fabricate a consulting bench.

---

## The Ten

### 01. Christiaan de Wet — Founder · Lead Architect · Customer Lead

The single human on the roster. Responsible for:

- Architecture and all strategic calls on Sovereign Matrix.
- Direct customer relationships — all sales, all onboarding, all
  support until the platform reaches the point where support can be
  credibly delegated to Claude.
- All production incidents.
- External partnership conversations (this document is one).

**Claude training-path readiness:** Already certified on Claude Code
and the Anthropic Messages API. Ready for partner-specific modules
the day registration opens.

**Ready for customer engagement:** yes.

---

### 02. god-brain — Strategic reasoning

`claude-opus-4-7` · extended-thinking mode

The surface we route every high-stakes strategic question through.
Used for board-facing analysis, competitive strategy, legal-context
interpretation, and any case where the answer *has to be right*. Not
cheapened to Sonnet when customers are paying for depth.

**Source:** `src/app/api/_agents/god-brain/route.ts`
**Ready for customer engagement:** yes — deployed in production today.

---

### 03. war-room — Multi-agent debate chair

`claude-sonnet-4-6`

The chairperson in our multi-agent deliberation room. Three open-source
models (Nemotron Ultra, Qwen 3, Mistral Nemotron) propose and critique.
Claude chairs: synthesizes competing views, resolves contradictions,
writes the final position. The judgment-layer role cheaper models
measurably fail.

**Source:** `src/app/api/_agents/collab-room/route.ts`
**Ready for customer engagement:** yes.

---

### 04. nexus — Parallel-model consensus synthesizer

`gemini-2.0-flash` (synthesis) · `claude-sonnet-4-6` (deep-mode
verification)

Our flagship public demo. Four frontier models race in parallel;
Gemini synthesizes. In `deep` mode, Claude reviews the synthesis
against the four transcripts and flags fabrications. This is the
layer that keeps consensus output honest when the models disagree.

**Source:** `src/app/api/_agents/nexus/route.ts`,
`src/app/dashboard/nexus/page.tsx`
**Ready for customer engagement:** yes — live at `/dashboard/nexus`.

---

### 05. output-verifier — Critic gate (L5 safety)

`claude-haiku-4-5`

Layer 5 of the 5-layer safety pipeline. Every agent response passes
through Claude as a critic before reaching the user. Catches
hallucinations, overconfident wrongness, and regressions from the
upstream models. This is the surface that protects customer-facing
quality.

**Source:** `src/lib/output-verifier.ts`
**Ready for customer engagement:** yes — runs on every production
agent call today.

---

### 06. slop-hunter — Defensive codebase auditor

`claude-sonnet-4-6` · read-only

A Claude Code subagent defined in
`.claude/plugins/sovereign-slop-hunter/`. Scans the entire codebase
for fabricated metrics, placeholder copy, LARP-tier naming,
`Math.random` in security primitives, and stale TODOs in production
paths. Reports but never edits. Invoked before every push.

Built specifically to enforce the honesty bar we hold ourselves to
for this Partner Network review. Meta-story: we use Claude to police
our own output quality.

**Source:** `.claude/plugins/sovereign-slop-hunter/agents/slop-hunter.md`
**Ready for customer engagement:** yes — deployable as an agent to
any consulting customer running Claude Code.

---

### 07. code-reviewer — PR + commit security gate

`claude-sonnet-4-6`

Reviews every diff against project conventions, security patterns
(auth, crypto, tenant isolation, rate-limit bypass paths), and API
contract stability. Blocks pushes that would ship regressions.

**Source:** `src/app/api/_agents/code-reviewer/route.ts`
**Ready for customer engagement:** yes — exposed to any customer
who wants code-review automation.

---

### 08. consensus-engine — Multi-model verification

`claude-sonnet-4-6` (one of four nodes)

Our generate → critique → synthesize → verify pipeline. Four
independent models check each other's work. Used for any claim that
leaves the platform into a customer deliverable. Claude holds one
of the four verification slots.

**Source:** `src/lib/consensus.ts`
**Ready for customer engagement:** yes.

---

### 09. trust-gate — Policy + HITL approval router

`claude-haiku-4-5`

Classifies proposed actions by risk tier and routes high-risk ones
through human approval queues. The layer that prevents an agent from
sending an unsanctioned email, making an unsanctioned phone call, or
posting to a customer's public channel without explicit consent.

**Source:** `src/lib/trust-levels.ts`,
`src/app/api/approvals/route.ts`
**Ready for customer engagement:** yes.

---

### 10. TBD — Human partnership coordinator

**Currently unfilled.** This is the role I would hire first with
Partner Network certification revenue: someone whose full-time
responsibility is the Anthropic relationship, customer co-delivery
scheduling, and the partner portal. Today, Christiaan covers all of
this directly.

Ready-date target: Q3 2026.

---

## What this roster means in practice

1. **Everyone is trained.** The nine non-human roles are already
   running in production against real workloads. They don't need
   onboarding — they need the Partner Network modules that let us
   package and sell what they already do.

2. **Christiaan is the single accountable human** for any customer
   engagement until role #10 is filled.

3. **Claude is a first-class contributor**, not a vendor.
   Every one of roles 02–09 is Claude-driven at the judgment layer,
   with cheaper models providing throughput. This is by design.

4. **Our agent-augmented delivery model is the product itself.**
   Customers hire Sovereign Matrix to get access to the same setup
   we're describing here, packaged and re-skinnable.

---

## Signed

**Christiaan de Wet**
Founder, Sovereign Matrix
[christiaan@sovereignmatrix.agency](mailto:christiaan@sovereignmatrix.agency)
[sovereignmatrix.agency/built-with-claude](https://sovereignmatrix.agency/built-with-claude)

---

## For the founder — checklist before sharing

- [ ] Verify every file path cited in roles 02–09 still exists.
      (Run `slop-hunter` first.)
- [ ] Confirm all Claude model IDs match the current Anthropic
      public model names.
- [ ] Decide whether to keep role #10 as "TBD" or reframe as
      "roadmap" before sending.
- [ ] Optional: add a link to a short video walkthrough of the
      platform in the signature block.
