# Anthropic Partnership Application — Sovereign Matrix

**Drafted:** May 1, 2026
**Application target:** Anthropic Partner Program / Trust & Safety lane
**Lead applicant:** Sovereign Matrix
**Submission portal:** anthropic.com/partners (or whatever the current
intake URL is — verify before submission)

> **Read this before submitting.** This is a *narrative draft*, not the
> final form. Every claim cites a verifiable artifact (commit hash, file
> path, public URL). Before sending, replace placeholders, attach the
> reference manifest as a JSON example, and make sure the lead reviewer
> can complete the procurement-grade verification flow in §6 in under
> 10 minutes.

---

## §1. One-line pitch

**We are publishing the open Sovereign Trust Manifest 1.0 — the
verifiable trust substrate for agentic AI. Our reference implementation
runs 222 production agents on top of Claude (and other models). The
spec aligns directly with Anthropic's posture on responsible deployment.
We're applying because Anthropic uniquely benefits from being the
frontier-model partner referenced in the spec from day one.**

---

## §2. What we've shipped (verifiable today)

Every item below is at a public URL or git path. Procurement officers
verify in 30 seconds via curl.

### Public infrastructure surfaces (curl-verifiable now)

| Surface | URL |
|--|--|
| Trust manifest (federation root) | `https://sovereignmatrix.agency/.well-known/sovereign-trust` |
| Google A2A v1.0 Agent Card | `https://sovereignmatrix.agency/.well-known/agent.json` |
| Public AIBOM (supply-chain manifest) | `https://sovereignmatrix.agency/.well-known/aibom.json` |
| JSON Schema for the manifest | `https://sovereignmatrix.agency/.well-known/sovereign-trust.schema.json` |
| Public verifier endpoint (6 surfaces) | `https://sovereignmatrix.agency/api/v1/verify/index` |
| Pinable audit-chain head | `https://sovereignmatrix.agency/api/v1/audit/head` |
| A2A request handler with R162 bridge | `https://sovereignmatrix.agency/api/v1/a2a/[peer]` |
| Wiring transparency page | `https://sovereignmatrix.agency/trust/wiring-status` |

### Open-source artifacts

| Asset | Status |
|--|--|
| Spec: `Sovereign Trust Manifest 1.0` (CC BY 4.0) | Published in repo at `/spec/SPEC.md` |
| JSON Schema (MIT) | Published at `/spec/schema/sovereign-trust.schema.json` |
| Inspector CLI: `@sovereign/inspector` (MIT, 0 deps) | npm-publish-ready (v1.1.0); operator publishes |
| Anti-drift gate | 812 CI invariants in `scripts/weekly-health.mjs` |
| Threat model | `docs/THREAT_MODEL.md` (STRIDE-based, every claim cites a file) |
| Defenders' ledger | `https://sovereignmatrix.agency/trust/defenders` (vulns we found in our own code, with commit hashes) |

### Wired runtime trust primitives (firing per request)

| Primitive | Audit action | Source file |
|--|--|--|
| R26 SHA-256 audit chain | (every action) | `src/lib/audit-log.ts` |
| R34 capability-attenuated delegation | various | `src/lib/agent-capability-tokens.ts` |
| R37 Macaroon-pattern tokens | `api_key.create` | (same file) |
| R100 declared policy gate | `agent.policy_gate.deny` | `src/lib/agent-factory-policy-gate.ts` |
| **R142 Pre-Action Governance Loop (PAGRL)** | `agent.governance_consult` | `src/lib/control-plane/governance.ts` |
| **R145 Memory payload guard** | `agent.memory_payload_blocked` | `src/lib/memory/payload-guard.ts` |
| **R150 Agentic Bill of Materials** | `agent.sbom_generated` | `src/lib/supply-chain/aibom.ts` |
| **R155 HITL confidence routing** | `agent.governance_consult` (phase=hitl-routing) | `src/lib/control-plane/hitl-routing.ts` |
| **R162 Cross-protocol privilege bridge** | `agent.cross_protocol_block` | `src/lib/protocols/cross-protocol-bridge.ts` |
| PII output guard (regex + Luhn + IBAN + SWIFT) | (mask/flag mode) | `src/lib/pii-guard.ts` |
| API-key scoping (CIDR + per-agent) | `api_key.delete` | `src/lib/api-key-scopes.ts` |
| Cost-runaway auto-pause | `cost.cap_hit` | `src/lib/cost-runaway.ts` |
| Free-first router (data sovereignty mode) | (provider strip) | `src/lib/ai.ts` |

The bolded rows shipped within 24 hours of this application date.
We're at the front of the agentic-trust-substrate curve, not just
implementing primitives others spec'd.

---

## §3. Why this fits Anthropic specifically

Reading Anthropic's public posture, three themes recur consistently:
**responsible scaling, interpretability, and alignment with regulatory
trajectories** (EU AI Act, NIST CAISI, OWASP ASI). Sovereign's
substrate is exactly this story made operational:

1. **Responsible deployment requires verifiable claims.** Most agent
   platforms claim safety in marketing. Sovereign publishes a wiring-
   status page (`/trust/wiring-status`) where every claim cites a file
   and a test count. Drift is structurally impossible — CI breaks on it.

2. **Interpretability requires audit traces.** Sovereign's R142 PAGRL
   produces a structured 4-layer governance trace for every action.
   Procurement reviewers don't ask "did this proceed?" — they ask
   "which layer's rule fired and why?" Sovereign answers both.

3. **Regulatory alignment compounds with each enforcement event.**
   EU AI Act Aug 2026 (GPAI) and Aug 2027 (high-risk) make the
   substrate mandatory. NIST CAISI is operational. OWASP ASI Top 10
   is published. Sovereign's primitives map 1:1: ASI04 → AIBOM,
   ASI03 → cross-protocol bridge, ASI06 → memory payload guard.

**Anthropic uniquely benefits from being the cited frontier-model
partner.** When the spec gets adopted, "powered by Claude" appears
in the reference implementation. Vendors implementing
`/.well-known/sovereign-trust` will see Anthropic as the safety-first
choice for the substrate underneath them. That's a structural
positioning win Anthropic can't get from any individual customer
deployment.

---

## §4. Specifically what we're asking for

We're applying with three asks, listed in order of strategic value
(not direct $):

### Ask 1 — Trust & Safety working-group seat

The single highest-value ask. We want a recurring conversation with
Anthropic's responsible-deployment team about:

- Spec evolution priorities (which capabilities to standardize next)
- How Claude's safety roadmap composes with verifiable substrates
- Co-publishing case studies of safety primitives in production

This is bidirectional. We bring real-world data on how the substrate
behaves at scale; Anthropic brings safety-research depth that informs
spec direction.

### Ask 2 — Compute credits ($50K-$500K equivalent)

Routine for Anthropic for Startups / Build with Claude. Used to:

- Power the Procurement Verifier SaaS at $1-5K/mo per F500 customer
- Run high-stakes reasoning where Claude's depth is the right tool
  (currently we route to Claude for ~30% of policy + governance
  reasoning paths; could be 80% with budget)
- Stress-test the substrate at scale before pricing tier 3 enterprise

### Ask 3 — Co-marketing / case study within 90 days

A published joint case study cites:
- Sovereign Trust Manifest 1.0 spec by name
- Anthropic Claude as the safety-grade reasoning layer
- Specific procurement contract or compliance outcome

Anthropic gets a "responsible deployment in production" story.
Sovereign gets the credentialing event that converts the spec from
"vendor's manifest" to "the manifest cited by Anthropic."

---

## §5. What Anthropic gets in return

Concrete value we deliver to Anthropic, not just to ourselves:

1. **First-party reference implementation of the spec** that Anthropic
   can point to in regulatory filings or analyst briefings.
2. **A spec author who cites Claude as the safety-grade reasoning
   model** — distinct from generic "powered by AI" positioning.
3. **Real-world safety telemetry from production deployments** —
   how often R142 escalates, what R145 catches, how R162 blocks
   privilege escalations across vendors.
4. **A partner that implements Anthropic's MCP and A2A primitives
   correctly** — Sovereign's R161 (MCP descriptor + scope grammar)
   and R162 (cross-protocol bridge) are implementations of what
   Anthropic and Google specify.
5. **Long-term spec stewardship** — the spec persists past Sovereign
   the company; Anthropic's name on the byline of the v1.0 reference
   implementation persists with it.

---

## §6. The 10-minute verification flow (do this before reviewing further)

If you read nothing else in this application, do this:

```bash
# 1. Verify the manifest exists and validates
curl https://sovereignmatrix.agency/.well-known/sovereign-trust | jq .

# 2. Verify the Agent Card exists and has a fingerprint
curl https://sovereignmatrix.agency/.well-known/agent.json | jq .fingerprint

# 3. Verify the AIBOM exists with a document hash
curl https://sovereignmatrix.agency/.well-known/aibom.json | \
  jq '{hash: .documentHash, components: (.components | length)}'

# 4. Verify the audit chain head is pinable
curl https://sovereignmatrix.agency/api/v1/audit/head | \
  jq '{rowHash, rowN, signedAt}'

# 5. Verify the verifier endpoint accepts and replays
curl -X POST https://sovereignmatrix.agency/api/v1/verify/index | jq .

# 6. Run the offline inspector (npm publish pending — repo path works today)
git clone https://github.com/christiaan839-beep/sovereign-v2.git
cd sovereign-v2/packages/inspector
node src/cli.mjs verify-agent-card https://sovereignmatrix.agency
```

If any of those return unexpected output, the spec is mis-implemented
and we want to know. If all return as expected, the substrate is
real.

---

## §7. What we don't claim

Honesty per our own discipline:

- **We are not a frontier lab.** We use Claude (and 38 other models).
  We're an integration + trust-substrate layer, not a competitor to
  Anthropic on model capability.
- **We don't claim 100% of trust primitives are wired.** R140 (IML
  drift), R141 (viability), R143 (ODTA), and R161 (MCP HTTP transport)
  are library-only as of submission date. We say so on
  `/trust/wiring-status` — drift between marketing and reality is
  structurally impossible (CI breaks on it).
- **We don't claim spec adoption.** Today there is exactly 1
  implementor of `/.well-known/sovereign-trust`: us. Spec stewardship
  goes to a multi-vendor working group when 3+ implementors are live
  (see `spec/GOVERNANCE.md`).
- **We don't claim SOC 2 Type II yet.** External auditor engagement
  in progress; ETA Q3 2026.

---

## §8. About the team

[Operator: fill this section in directly. Do not delegate. Anthropic
will read founder/team character closely. Honest, concrete, with
links to prior work.]

Lead engineer: [name + 1-line credibility statement + GitHub URL]

Engineering principles practiced (visible in commit history):
- Audit-vocabulary-first
- Default-OFF for behavioral changes
- Pure-function cores; thin DB adapters
- Anti-drift CI gate (812 invariants and growing)
- Transparency page at `/trust/wiring-status` enforced by conformance test

---

## §9. Timeline

If accepted:

| Week | Action |
|--|--|
| 0 | Acceptance acknowledged |
| 1-2 | Onboard with assigned partnership engineer; align on credit usage |
| 3-4 | Joint case study target identified |
| 4-8 | First procurement-tier customer signed using credits + Claude routing |
| 8-12 | Joint case study drafted |
| 12 | Public announcement; case study on Anthropic + Sovereign blogs |
| 12-16 | Trust & Safety working-group seat begins meeting cadence |
| 24 | First 90-day review |

---

## §10. Contact + supporting artifacts

- **Lead contact:** [operator email]
- **Repository:** https://github.com/christiaan839-beep/sovereign-v2
- **Reference manifest:** see `/spec/examples/reference-manifest.json`
- **Threat model:** `docs/THREAT_MODEL.md`
- **Wiring transparency:** https://sovereignmatrix.agency/trust/wiring-status
- **Defenders' ledger:** https://sovereignmatrix.agency/trust/defenders
- **Inspector CLI:** `packages/inspector/` (npm publish pending)
- **Open spec:** `spec/SPEC.md`
- **Governance commitments:** `spec/GOVERNANCE.md`

---

## Submission checklist (operator)

Before sending:

- [ ] Replace `[operator email]` and `[name]` placeholders in §8 + §10
- [ ] Verify all curl examples in §6 return expected output (do this YOURSELF — every one — within 24h of submission)
- [ ] Attach `spec/examples/reference-manifest.json` if the application portal allows file attachments
- [ ] Verify `npm publish --access public` was run for `@sovereign/inspector` (so the npm install instruction in §6 works)
- [ ] Verify `/trust/wiring-status` deployed to production and matches local
- [ ] Verify weekly-health gate passes (`node scripts/weekly-health.mjs`)
- [ ] Submit. Wait 7-14 days for first-pass response.

---

## After submission

Three followups every Friday:

1. Anthropic responsible-AI team mention or RT of any Sovereign release → respond within 4 hours.
2. Any inbound question about the spec or substrate → respond within 24 hours with a concrete code-cited answer (don't promise a follow-up call before answering directly).
3. Weekly progress note: 1-2 sentences on what shipped, sent to the assigned partnership engineer (not as a status update — as a courtesy that the substrate is alive and growing).

If no response after 14 days: send one polite ping with one new piece of evidence (e.g., a peer implementor signing on, a customer announcing usage, a new R-numbered primitive wired). Do not ping more than that.
