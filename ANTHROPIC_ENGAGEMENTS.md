# Sovereign Matrix — Anthropic Engagement Ledger

**Prepared for:** Karl Kadon, Head of Partner Experience, Anthropic
**Prepared by:** Christiaan de Wet, Founder, Sovereign Matrix
**Last updated:** April 2026

---

## Framing

This ledger inventories the real work Sovereign Matrix has shipped
**on top of Anthropic's platform** — the scope, the technical surface
area, and the outcomes. It is not aspirational.

Where engagements are not yet customer-paying, we say so directly. We
would rather submit a short, true list than a padded one.

---

## Primary engagement — Sovereign Matrix itself

This is our flagship Anthropic engagement. It is the product.

### Scope

Sovereign Matrix is a **multi-tenant agent operating system** that lets
a single operator deploy 131 production AI agents, orchestrated into
multi-step playbooks, backed by a 5-layer safety pipeline and
multi-model consensus verification.

### Customer value prop

Replaces ~8 SaaS tools (Apollo + Clay + Jasper + SEMrush + Zapier +
Outreach + Clearbit + n8n — typical stack ~$715/mo) with a single
flat-rate agent platform starting at $19/mo.

### Claude surface area

| Surface | Claude model | Workload |
|---|---|---|
| `god-brain` | `claude-opus-4-7` + extended thinking | Strategic / legal / competitive reasoning. Deep-thinking mode when `depth: "deep"`. |
| `war-room` chairperson | `claude-sonnet-4-6` | Synthesizes 3-way debate into authoritative position. |
| `nexus` deep-mode verifier | `claude-sonnet-4-6` | Cross-checks the Gemini synthesis against 4 raw model transcripts; flags fabrications. |
| `output-verifier` (L5 safety) | `claude-haiku-4-5` | Critic gate on every agent response before it reaches a user. |
| `code-reviewer` | `claude-sonnet-4-6` | Reviews every commit diff against security patterns. |
| `consensus-engine` | `claude-sonnet-4-6` | One of four verification nodes. |
| `trust-gate` | `claude-haiku-4-5` | Action-risk classifier for HITL approval routing. |

### Non-Claude models in the stack

- NVIDIA NIM: Nemotron Ultra 253B, Nemotron 3 Super 120B, DeepSeek V3,
  Qwen 3 235B, Mistral Nemotron, Llama 4 Maverick — used for throughput
  tasks where Claude's judgment isn't required.
- Google: Gemini 2.0 Flash (synthesis), Gemini 3.1 Pro (grounded search).
- Groq: fast inference fallback.
- Ollama: customer-side local execution (privacy-sensitive deployments).

**39+ models total, routed per task by `src/lib/llm-router.ts`.**

### Technical surface

- 131 production agents (`src/app/api/_agents/*/route.ts`)
- 25 multi-agent playbook workflows (`src/lib/playbooks.ts`)
- Multi-tenant auth via Clerk; tenant-scoped DB queries via
  `src/lib/tenant-scope.ts`
- 5-layer safety pipeline: jailbreak detection → PII scan →
  content policy → quality score → Claude critic gate
- Immutable audit log (`src/lib/execution-audit.ts`)
- Playbook orchestration with step-by-step DB persistence
- Real-time streaming via SSE (see Nexus)
- Stripe subscription billing, usage metering against the `usage` table
- Live at [sovereignmatrix.agency](https://sovereignmatrix.agency)

### Built by

One human (Christiaan de Wet) + Claude Code, in a ~6-month build
cycle. The commit history is public to anyone inside Anthropic who
wants to see how a partnership-grade product actually gets shipped
with Claude as the engineering partner.

### Status

**Live in production.** Preparing for public launch.

### Outcomes so far

- Zero security vulnerabilities in public audit (Aikido scan).
- 131 agents typecheck clean on every push.
- Zero "AI slop" fabrications in user-facing surfaces (enforced by
  the `slop-hunter` Claude Code agent we built for this review).
- Editorial design language committed across 4 surfaces
  (`/`, `/dashboard/nexus`, `/built-with-claude`, `/pricing`).

---

## Co-sell — in flight

_No active co-sells with Anthropic sellers yet._ This section exists
to be populated once the Partner Network portal opens and co-sell
introductions are possible. Karl — explicit ask: we'd benefit from
an introduction to your customer team for any deal where a customer
is looking for an **agent operating system** rather than a chat
wrapper, or where a customer wants **multi-model consensus** as a
trust feature.

---

## Paying customers

_Pre-launch. We are not yet signing paying customers outside the
Founder Access program (first 10 users granted enterprise tier free,
see `src/app/api/_misc/founders/route.ts`)._

Committed design partners will be listed here when they are confirmed.
We won't list prospects as engagements.

---

## Open-source contributions to the Claude ecosystem

### `sovereign-slop-hunter` — Claude Code plugin

A defensive agent (defined as a Claude Code subagent) that audits any
codebase for fabricated data, placeholder content, and AI-generated
slop. Used internally at Sovereign Matrix; available as a standalone
plugin.

- **Location:** `.claude/plugins/sovereign-slop-hunter/`
- **Scope:** read-only scanner; seven categories of fabrication
  patterns encoded from real fabrications we cleaned up while building
  Sovereign Matrix (e.g., the "Claude Mythos TBD Q2 2026" model-name
  fabrication — 10 files affected, all cleaned, pattern captured).
- **Why it matters to Anthropic:** a working example of Claude Code
  subagents used as a quality gate. Demoable.

### Editorial design language for Claude-native products

A two-mode design system (`.editorial-light` / `.editorial-dark`) that
deliberately rejects the dark-matrix-emerald-glow aesthetic common to
AI-agent products, in favor of editorial typography (Instrument Serif,
Inter Tight, JetBrains Mono) with a burnt-copper accent tonally
adjacent to the Anthropic wordmark.

- **Location:** `src/app/_editorial.css` + the four redesigned surfaces
  at `/`, `/dashboard/nexus`, `/built-with-claude`, `/pricing`.
- **Status:** shipped. See `/built-with-claude` as the canonical
  example.

---

## Technical references

For Anthropic engineers who want to verify the claims in this document:

- **Landing:** [sovereignmatrix.agency](https://sovereignmatrix.agency)
- **Partner narrative:** [sovereignmatrix.agency/built-with-claude](https://sovereignmatrix.agency/built-with-claude)
- **Flagship demo:** [sovereignmatrix.agency/dashboard/nexus](https://sovereignmatrix.agency/dashboard/nexus) (auth-gated; happy to provide a walk-through login on request)
- **Pricing:** [sovereignmatrix.agency/pricing](https://sovereignmatrix.agency/pricing)
- **Repo:** private; available for review under NDA.

---

## Signed

**Christiaan de Wet**
Founder, Sovereign Matrix
[christiaan@sovereignmatrix.agency](mailto:christiaan@sovereignmatrix.agency)

---

## For the founder — checklist before sharing

- [ ] Verify current Claude model IDs match what's live in production.
- [ ] Confirm the "131 agents" count — run `ls src/app/api/_agents/ | wc -l`
      and update if drift.
- [ ] Decide whether the "No paying customers yet" section stays verbatim
      or softens once any design partner is confirmed.
- [ ] Decide whether to attach a screencast of the Nexus demo.
- [ ] If any Anthropic engineer has already seen the platform, add a
      "Prior Anthropic reviewers" section with their names.
