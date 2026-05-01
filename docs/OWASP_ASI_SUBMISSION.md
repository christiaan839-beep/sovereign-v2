# OWASP Agent Security Initiative — Reference Implementation Submission

**Submitting:** Sovereign Matrix
**Submission target:** OWASP ASI Top 10 working group
**Reference: ASI04 (Agentic Supply Chain Vulnerabilities) + ASI03 (Cross-Protocol Privilege Escalation) + ASI06 (Mnemonic Sovereignty / Memory Payload Injection)
**Date:** May 1, 2026
**Spec proposed for citation:** Sovereign Trust Manifest 1.0 (CC BY 4.0)

---

## Abstract

Sovereign Matrix has shipped a production-deployed reference
implementation covering at minimum three OWASP ASI Top 10 categories:
ASI04 (supply chain), ASI03 (cross-protocol privilege escalation),
and ASI06 (memory-payload injection). Every defense primitive is
backed by:

1. A pure-function library with unit tests
2. A runtime call site firing a structured audit-chain entry
3. An offline verifier (npm package: `@sovereign/inspector`) that
   reproduces verification math without contacting any server
4. A public discovery surface (`/.well-known/sovereign-trust`) that
   advertises the implementation in machine-readable form

We propose Sovereign Trust Manifest 1.0 as a candidate reference
specification for the ASI working group, and Sovereign Matrix's
production deployment as the worked example. The spec is published
under CC BY 4.0; the schema under MIT. Stewardship transitions to a
multi-vendor working group when 3+ independent implementors are live
(per `spec/GOVERNANCE.md`).

---

## §1. ASI04 — Agentic Supply Chain Vulnerabilities

### The threat

Per ASI04: agentic systems compose models, tools, training data,
runtime libraries, and prompts. A vulnerability in any component
propagates to every agent that depends on it. Today, most agent
platforms cannot enumerate their own supply chain — there is no
SBOM-equivalent for the agentic stack.

### Sovereign's reference implementation

**R150 — Agentic Bill of Materials (AIBOM).** Public document
auto-generated per deploy at `/.well-known/aibom.json`.

Properties verified:

- **Component fingerprints.** Every model, tool, dependency, and agent
  is hashed via SHA-256 over (id | kind | name | version | license |
  supplier). Tampering with any field breaks the fingerprint.
- **Document hash anchor.** The document itself carries a hash over
  all components + relationships. Tampering with one component breaks
  this top-level hash.
- **SPDX-style relationships.** 6 relationship kinds: DEPENDS_ON,
  CONTAINS, INVOKES, READS_FROM, TRAINED_ON, PROVIDED_BY.
- **CVE/AVE blocklist check.** `checkVulnerabilityBlocklist({doc,
  blocklist})` validates the document against an external vulnerability
  list — pure function; runs offline.

### How an auditor verifies

```bash
# 1. Fetch the AIBOM
curl https://sovereignmatrix.agency/.well-known/aibom.json > aibom.json

# 2. Validate offline
sovereign-inspect verify-aibom < aibom.json

# 3. Check against a CVE blocklist
sovereign-inspect verify-aibom --blocklist=CVE-2026-1,AVE-001 < aibom.json
```

Source: `src/lib/supply-chain/aibom.ts` (~430 LOC) +
`src/lib/aibom-builder.ts` (~150 LOC) + 32 unit tests.
Audit action emitted: `agent.sbom_generated` (R26 hash chain).

---

## §2. ASI03 — Cross-Protocol Privilege Escalation

### The threat

Per ASI03: an agent authenticated via one protocol (e.g., A2A with a
"user" claim) gains privileges intended only for another protocol's
caller (e.g., MCP with an "internal" scope). Real exploit class —
Anthropic's MCP and Google's A2A do not natively share an
authorization vocabulary.

### Sovereign's reference implementation

**R162 — Cross-Protocol Bridge.** `bridgeAuthorization({ peer, tool,
policy })` evaluates a peer's A2A claims against an MCP tool's
required scopes via a least-privilege scope-translation policy.

Properties verified:

- **REFUSE_ALL default.** With no policy, every A2A → MCP request is
  refused with `no_mapping`.
- **Multi-rule grant aggregation.** Multiple matching rules union
  their grants (deduped) before the scope evaluation.
- **Scope-missing detection.** A matched rule grants scopes; if the
  tool requires more, the bridge refuses with `scope_missing`.
- **Privilege-escalation defense (the canonical test):** a peer with
  a "user" claim tries to invoke a tool requiring
  `finance:write:reconciliation`; the user-rule fires, granting only
  `finance:read`; the bridge refuses with `scope_missing`. Verifiable
  unit test in `src/lib/protocols/__tests__/cross-protocol-bridge.test.ts`.

### How an auditor verifies

```bash
# Replay any claimed bridge decision against the platform's policy
echo '{"input": {...}, "claimed": {"ok": false, "reason": "scope_missing"}}' \
  | curl -X POST https://sovereignmatrix.agency/api/v1/verify/bridge-authorization \
      -H 'Content-Type: application/json' -d @-
```

Source: `src/lib/protocols/cross-protocol-bridge.ts` (~290 LOC) +
`src/app/api/v1/a2a/[peer]/route.ts` (live request handler) +
19 unit tests including the privilege-escalation scenario.
Audit action emitted: `agent.cross_protocol_block` (R26).

---

## §3. ASI06 — Mnemonic Sovereignty / Memory Payload Injection

### The threat

Per the Mnemonic Sovereignty survey (April 2026, cited in current ASI
working draft): an agent reads a poisoned source while completing a
benign task and writes the malicious payload into long-term memory
through normal update; later retrieval by ANY agent triggers the
payload. Cross-agent contagion.

### Sovereign's reference implementation

**R145 — Memory Payload Guard.** `scanMemoryWrite({ agentName,
content })` runs a 5-detector scanner before every memory write.

5 detector classes:

1. **role-marker-injection** — `system:` / `user:` / `<|im_start|>`
   markers in narrative content where they shouldn't appear
2. **direct-instruction** — "ignore previous instructions" /
   "you are now" / "from now on you" patterns
3. **tool-call-hijack** — fake `<invoke>` tags or function-call
   syntax embedded in narrative payloads
4. **propagation-marker** — explicit "share with other agents" /
   "propagate this to" / "remember to tell every agent"
5. **encoded-payload** — base64/hex sequences that decode to
   suspicious patterns (configurable length threshold to reduce
   false positives)

Properties verified:

- **SHA-256 content hash.** Refused payloads' content hashes are
  recorded so SOC reviewers can correlate the same poisoned source
  hitting multiple agents — single recurring hash, not 50 different
  excerpts.
- **Cross-agent contagion correlation.** Test in
  `src/lib/__tests__/memory-payload-guard-wiring.test.ts` confirms
  same content yields identical hash across agents.
- **Fail-OPEN posture.** Scanner exception MUST NOT block legitimate
  memory writes. Defense-in-depth, not the primary defense.

### How an auditor verifies

```bash
# Replay any claimed memory_payload_blocked audit entry
echo '{"content": "...", "agentName": "x", "claimed": {...}}' \
  | curl -X POST https://sovereignmatrix.agency/api/v1/verify/memory-payload \
      -H 'Content-Type: application/json' -d @-

# Or: run the scanner offline
echo '{"content": "..."}' | sovereign-inspect verify-memory-payload
```

Source: `src/lib/memory/payload-guard.ts` (~430 LOC) wired into
`src/lib/memory.ts` 3 write surfaces. 42 unit tests including the
cross-agent contagion scenario.
Audit action emitted: `agent.memory_payload_blocked` (R26).

---

## §4. Cross-cutting: the full Sovereign Trust Manifest

The 3 ASI categories above are part of a broader spec covering
agentic-AI trust primitives. Full vocabulary:

| Capability | OWASP ASI mapping (proposed) | Status |
|--|--|--|
| `auditChain` | (cross-cutting — every ASI category benefits) | Wired |
| `policyGate` | ASI01 (input-prompt manipulation), ASI09 (insufficient sandboxing) | Wired |
| `governanceLoop` (R142) | ASI09, ASI10 (over-reliance) | Wired |
| `memoryPayloadGuard` (R145) | **ASI06** (mnemonic sovereignty) | Wired |
| `aibom` (R150) | **ASI04** (supply chain) | Wired |
| `hitlConfidenceRouting` (R155) | ASI02 (over-empowerment), ASI09 | Wired |
| `agentCardA2A` (R160) | ASI05 (insecure agent communication) | Live |
| `mcpToolGateway` (R161) | ASI05, ASI09 | Library |
| `crossProtocolBridge` (R162) | **ASI03** (cross-protocol privilege) | Wired |
| `behavioralInvariantIml` (R140) | ASI07 (objective drift), ASI10 | Library |
| `viabilityRiskgate` (R141) | ASI07, ASI10 | Library |
| `odtaRuntimeGate` (R143) | ASI09 | Library |

This mapping is proposed, not authoritative. The ASI working group
should review and refine.

---

## §5. Why ASI should consider this for citation

1. **Production-deployed.** Not academic research. Real workloads run
   on Sovereign Matrix today across 222 agents in 14 industries.
   Audit chain, governance loop, payload guard, AIBOM, cross-protocol
   bridge — all firing on the live request path with anti-drift CI
   guards (812 invariants).

2. **Open-licensed.** Spec under CC BY 4.0. Schema under MIT. Inspector
   CLI under MIT (zero dependencies, pure node:crypto + global fetch).
   No commercial commitment required to adopt.

3. **Vendor-neutral by construction.** Spec governance commits to
   working-group transition at 3+ implementors. Founder seat persists
   without veto. Sovereign Matrix is "primary author + reference
   implementor," not "sole authority."

4. **Verifiable, not aspirational.** Every claim cites a file. Anti-
   drift gate breaks CI on any drift. Wiring transparency page at
   `/trust/wiring-status` distinguishes wired from library-only.
   Sovereign explicitly publishes which primitives are NOT yet wired
   so adopters know exactly where the gaps are.

5. **Composable with existing standards.**
   - Builds on RFC 8615 (Well-Known URIs)
   - Mirrors `/.well-known/security.txt` (RFC 9116) discovery pattern
   - Aligns with Google A2A v1.0 (Agent Card)
   - Aligns with Anthropic MCP (Model Context Protocol)
   - Compatible with NIST CAISI evidence patterns
   - Compatible with EU AI Act Art. 13 + Annex IV (transparency)

---

## §6. What we're requesting

| Request | Strength |
|--|--|
| Acknowledgment of receipt | Required |
| Working-group review of the spec | Strongly requested |
| Working-group consideration of citation in the next ASI Top 10 revision | The strategic ask |
| Liaison with the working group during reference-implementation maturation | Welcomed |

We do not request that ASI endorse the specific spec text without
review. We request that the spec be evaluated against its peers
(if any) and either cited as a candidate reference or sent back
with concrete improvement suggestions.

---

## §7. Timeline + commitments

| Milestone | Commitment |
|--|--|
| 30 days from receipt | We respond to any working-group questions within 7 days |
| 90 days | We commit to maintaining the reference implementation at sovereignmatrix.agency with passing conformance tests |
| 180 days | If the spec is cited or referenced by ASI, we publicly acknowledge ASI feedback in the v1.1 release notes |
| 12 months | We commit to the working-group governance transition trigger (3+ implementors → multi-vendor working group) |

---

## §8. Materials for working-group review

| Artifact | URL / path |
|--|--|
| Spec text (CC BY 4.0) | `/spec/SPEC.md` in the source repo (see contact) |
| JSON Schema (MIT) | `/spec/schema/sovereign-trust.schema.json` |
| Reference manifest (Sovereign's actual production data) | `/spec/examples/reference-manifest.json` |
| Governance model | `/spec/GOVERNANCE.md` |
| Contributing guide | `/spec/CONTRIBUTING.md` |
| Threat model | `docs/THREAT_MODEL.md` (STRIDE-based) |
| Reference implementation source | github.com/christiaan839-beep/sovereign-v2 |
| Inspector CLI (offline verifier) | `packages/inspector/` (npm: `@sovereign/inspector`) |
| Wiring transparency page | https://sovereignmatrix.agency/trust/wiring-status |
| Live manifest endpoint | https://sovereignmatrix.agency/.well-known/sovereign-trust |

---

## §9. Contact

**Submitter:** Sovereign Matrix
**Lead contact:** [operator email]
**GitHub:** https://github.com/christiaan839-beep/sovereign-v2
**Portal contact preferred:** [response form / issue link]

We commit to responding to working-group questions within 7 days
during the review period.

---

## Appendix A — Why these 3 ASI categories specifically

The ASI Top 10 has 10 categories. We submit ASI04, ASI03, ASI06
because they share a structural property:

> **Each requires a verifiable artifact (SBOM, scope grant, content
> hash) that an outside auditor can validate without trusting the
> vendor.**

ASI04 (supply chain) has prior art in software SBOM (CycloneDX,
SPDX). ASI03 (cross-protocol privilege) and ASI06 (memory payload)
do not. Sovereign's reference implementation is one of the first to
ship verifiable artifacts for ASI03 and ASI06.

The other 7 categories (ASI01 input manipulation, ASI02 over-
empowerment, ASI05 communication security, ASI07 objective drift,
ASI08 lack of observability, ASI09 sandboxing, ASI10 over-reliance)
are harder to ship verifiable artifacts for — they're more about
deployment posture than discrete cryptographic primitives. We have
opinions on those (R140 IML for ASI07, R155 HITL routing for ASI02
and ASI10) but believe the ASI working group is best-positioned to
sequence those evaluations.

---

## Appendix B — Why an open spec, not a Sovereign-Matrix proprietary one

Three reasons:

1. **Trust at scale requires multi-vendor adoption.** Single-vendor
   security claims cap procurement adoption at ~1% of an industry.
   OAuth, OIDC, TLS, OWASP Top 10 — all multi-vendor. Sovereign Trust
   Manifest needs to follow the same pattern to reach the same
   ceiling.

2. **The spec must outlive any one company.** Sovereign Matrix is a
   2026-era startup. Specs we write today need to persist 20-50 years
   to be trustworthy procurement infrastructure. Open licensing +
   working-group governance is the only known pattern that achieves
   this.

3. **The discipline forces honesty.** A proprietary spec can be
   modified under marketing pressure. An open spec with an anti-drift
   conformance test cannot.

---

## Submission checklist (operator)

Before sending:

- [ ] Replace `[operator email]` and `[response form / issue link]`
- [ ] Verify all curl examples in §1, §2, §3 return expected output
- [ ] Confirm `npm publish --access public` was run (so npm install
      instructions in §3 work)
- [ ] Verify `/spec/SPEC.md`, `/spec/GOVERNANCE.md`,
      `/spec/CONTRIBUTING.md`, `/spec/CHANGELOG.md` are reachable in
      the source repo
- [ ] Submit via the OWASP ASI working-group intake (verify current
      portal at owasp.org/www-project-agent-security-initiative/)
- [ ] Wait 14-30 days for first-pass response
- [ ] Followup once with one new piece of evidence if no response
      within 14 days
