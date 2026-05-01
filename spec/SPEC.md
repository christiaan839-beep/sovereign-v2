# Sovereign Trust Manifest — Open Specification 1.0

**Status:** Working Draft 1.0 — published April 30, 2026
**License:** CC BY 4.0 (this document); MIT (the schema)
**Stewards:** Sovereign Matrix initially; intended to migrate to a neutral
multi-vendor working group once 3+ implementors are live.

> **Why this spec exists.** As of April 2026, agentic AI platforms make
> trust claims in marketing copy ("audit-logged", "policy-bound",
> "supply-chain-verified") that an enterprise procurement team cannot
> mechanically verify. The Sovereign Trust Manifest defines a public,
> well-known URL — `/.well-known/sovereign-trust` — where any vendor can
> publish a self-describing JSON document declaring which trust
> primitives they implement *and where to verify each claim*.
>
> The manifest is to agentic AI what `/.well-known/security.txt` is to
> web vulnerabilities, what `/.well-known/openid-configuration` is to
> identity, and what `robots.txt` is to crawlers. A focal point that
> outsiders can probe with no prior knowledge and no vendor cooperation.

---

## 1. Discovery URL

A conforming implementation **MUST** serve a JSON document at:

    https://<host>/.well-known/sovereign-trust

with `Content-Type: application/json`, an open `Access-Control-Allow-Origin`,
and `Cache-Control` of at most one hour.

## 2. Document shape (normative)

```jsonc
{
  "$schema": "https://sovereignmatrix.agency/.well-known/sovereign-trust/v1.0.0",
  "generatedAt": "<ISO 8601 UTC>",
  "identity": {
    "name": "<vendor-or-instance display name>",
    "canonicalUrl": "<https origin of this instance>",
    "description": "<one-paragraph procurement-readable summary>",
    "keyFingerprint": "<SHA-256 hex of platform signing public key, or null>"
  },
  "capabilities": {
    "<capabilityFlag>": <boolean>
    /* see §3 for the canonical capability vocabulary */
  },
  "platformCapabilities": ["<kebab-case capability name>", ...],
  "endpoints": {
    "<endpointName>": "<absolute URL>"
    /* see §4 for the canonical endpoint vocabulary */
  },
  "verifierSurfaces": ["<surface name>", ...],
  "verifier": {
    "npmPackage": "<npm package name of the offline verifier CLI>",
    "install": "<one-line install command>",
    "source": "<source repo URL>"
  },
  "federation": {
    "peers": ["<canonical URL>", ...],
    "lastSync": "<ISO 8601 UTC, or null>"
  },
  "stats": {
    "<statName>": <number>
    /* free-form numeric claims with public sources */
  },
  "note": "<free-form human-readable note>"
}
```

## 3. Canonical capability vocabulary (informative)

A capability flag declares "this instance implements primitive X *and*
exposes a verification surface for it." Implementations **SHOULD** use
these names where applicable; new names **MAY** be added (the
`platformCapabilities` array carries the tagged list).

| Flag | R-tag | Definition |
|------|-------|------------|
| `auditChain` | R26 | SHA-256 hash chain over every state-changing action |
| `delegationChain` | R34 | Capability-attenuated delegation tree |
| `multiStageHitl` | R33 | Human-in-the-loop with timeout + escalation |
| `spendAuthorizations` | R30 | Merchant-bounded agentic-commerce mandates |
| `agentCapabilityTokens` | R37 | Macaroon-pattern attenuatable tokens |
| `agentIdentityRegistry` | R38 | Know-Your-Agent identity manifests |
| `policyGate` | R100 | Declared-policy enforcement before action |
| `behavioralInvariantIml` | R140 | Drift detection (KL / z-test) |
| `viabilityRiskgate` | R141 | Continuous trust score VI(t) ∈ [-1, 1] |
| `governanceLoop` | R142 | Pre-action 4-layer governance ruleset |
| `odtaRuntimeGate` | R143 | Observability/Decidability/Timeliness/Attestability |
| `memoryPayloadGuard` | R145 | Embedded-instruction scanner on memory writes |
| `aibom` | R150 | Agentic Bill of Materials |
| `hitlConfidenceRouting` | R155 | Calibrated HITL routing |
| `agentCardA2A` | R160 | Google A2A Agent Card publication |
| `mcpToolGateway` | R161 | MCP Tool Descriptor with scope grammar |
| `crossProtocolBridge` | R162 | A2A→MCP least-privilege bridge |
| `publicVerifierEndpoint` | — | Curl-able verifier surface (see §4) |

## 4. Canonical endpoint vocabulary (normative for advertised names)

| Endpoint key | Path template | Purpose |
|--------------|---------------|---------|
| `agentCard` | `/.well-known/agent.json` | Google A2A v1.0 Agent Card |
| `verifier` | `/api/v1/verify/{surface}` | Public POST verifier dispatcher |
| `verifierIndex` | `/api/v1/verify/index` | GET — list of available surfaces |
| `permanence` | `/api/health/permanence` | Anti-drift invariant snapshot |
| `incidents` | `/api/health/incidents` | Public incident timeline |
| `diagnose` | `/api/health/diagnose` | Self-diagnostic (env / DB / wiring) |
| `hitlPolicy` | `/api/health/hitl-policy` | Shipped HITL routing rules |
| `verifyDelegation` | `/api/health/verify-delegation` | Delegation chain replay |
| `publicTrace` | `/api/health/trace/{traceId}` | Anonymized reasoning trace |

Implementations **MAY** add custom endpoint keys; values **MUST** be
absolute URLs at the same canonical origin.

## 5. Verifier surfaces (normative)

The `/api/v1/verify/{surface}` dispatcher accepts POST with a JSON body
and returns a uniform response shape:

    { "ok": <boolean>, "surface": "<surface>", ...verifierFields }

Standard surfaces (each implementor **SHOULD** support every one for
which they implement the corresponding capability):

- **`audit-chain`** — body `{ rows: AuditChainRow[] }` → replays the
  hash chain offline. Reuses the same algorithm as the on-server
  cron-driven chain check.
- **`agent-card`** — body `{ card: A2AAgentCard }` → recomputes the
  fingerprint and validates structure.
- **`aibom`** — body `{ doc: AIBOMDocument, blocklist?: string[] }` →
  validates supply-chain document and optionally checks against a
  CVE/AVE blocklist.
- **`scope-evaluation`** — body `{ required: string[], granted: string[] }`
  → MCP scope grammar evaluation.
- **`bridge-authorization`** — body `{ input, claimed }` → replays a
  cross-protocol bridge decision and confirms the claim.
- **`memory-payload`** — body `{ content: string }` → scans for
  embedded instruction patterns.

Custom surfaces **MAY** be added; their names **MUST** be kebab-case.

## 6. Verification posture (normative)

> **The instance MUST NOT be a required trust anchor.** Every claim
> made by the manifest MUST be independently verifiable using:
>
>   1. The published verifier endpoint at `/api/v1/verify/{surface}`
>      (online path, requires no auth), AND
>   2. An offline verifier (typically a public npm package or open-source
>      CLI) that reproduces the verification math without contacting the
>      instance.
>
> If a claim cannot be verified offline, the corresponding capability
> flag MUST be `false`.

This is the load-bearing rule of the spec. It's what makes the manifest
useful to a procurement team that doesn't trust the vendor.

## 7. Federation (informative)

The `federation.peers` array lists the canonical URLs of peer instances
this instance mutually recognizes. A verifier crawling the federation
can:

1. Fetch `/.well-known/sovereign-trust` from a seed URL.
2. For each `peers[i]`, repeat (1) up to a depth bound.
3. Detect asymmetries: if A claims to federate with B but B does not
   list A, the federation is mis-declared.

A federation graph is the basis for cross-instance reputation
aggregation, but reputation portability is **out of scope** for v1.0.

## 8. Versioning

The manifest's `$schema` URL **MUST** terminate in `/v<major>.<minor>.<patch>`
matching this document's version. Backward-compatible additions MAY be
made within a major version. Removing a capability flag, an endpoint key,
or a verifier surface is a breaking change requiring a major bump.

## 9. Conformance test (informative)

A conforming implementation can be self-checked by:

1. `curl https://<host>/.well-known/sovereign-trust | jq .` — must
   parse, must validate against the schema in
   `/.well-known/sovereign-trust.schema.json`.
2. For every endpoint key in the document, the URL **MUST** return a
   2xx (HEAD or GET) response.
3. For every advertised verifier surface, POST to `/api/v1/verify/{surface}`
   with a known-valid fixture **MUST** return `ok: true`; with a
   known-invalid fixture **MUST** return `ok: false`.

Sovereign Matrix's reference implementation lives at:
- Manifest:  https://sovereignmatrix.agency/.well-known/sovereign-trust
- Verifier:  https://sovereignmatrix.agency/api/v1/verify/index
- Schema:    https://sovereignmatrix.agency/.well-known/sovereign-trust.schema.json
- Inspector: `npm install -g @sovereign/inspector`

## 10. Acknowledgments

Inspired by:
- IETF RFC 8615 (Well-Known URIs)
- IETF RFC 9116 (security.txt)
- OpenID Foundation: `.well-known/openid-configuration`
- OWASP Agent Security Initiative (ASI) Top 10
- Google Agent-to-Agent Protocol v1.0

---

**Citing this spec.** Until v1.0 is finalized, cite as:

> "Sovereign Trust Manifest, Working Draft 1.0," Sovereign Matrix,
> April 2026. https://sovereignmatrix.agency/docs/SOVEREIGN_TRUST_MANIFEST_SPEC.md

After finalization, citations should reference the version-pinned URL
shown in the manifest's `$schema` field.
