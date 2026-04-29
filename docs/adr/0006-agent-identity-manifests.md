# ADR-0006: Agent Identity Manifests + Know-Your-Agent (KYA) Registry

**Status:** Accepted (R38)
**Date:** 2026-04-29
**Deciders:** @christiaandewet, Claude (Sovereign Matrix)
**Affects:** `src/lib/agent-identity.ts`, `drizzle/0048_*.sql`,
`packages/inspector/src/identity.mjs`, `/.well-known/sovereign-trust`

## Context

R30-R37 shipped commerce primitives (spend cards, capability tokens),
delegation chains (CADC), federation discovery, and a public verifier.
What's missing: **agent identity itself.**

When agent A from instance X transacts with merchant M, M can verify
the cryptographic chain — but M cannot verify *what agent A is*.
Specifically, M cannot answer:

- Who built this agent?
- What model versions does it use?
- What's its declared capability scope?
- Has it been compromised before?
- Was its training data licensed?
- What's its provenance hash?

This is the **agent identity gap**. Nobody has filled it. The industry
is converging on this need (regulated industries demand it for
high-value transactions; insurance markets need it for underwriting;
reputation systems need it as the foundational identifier).

The classical analogue is **SSL Certificate Authorities**: every TLS
cert is signed by a CA whose public key is widely trusted. For agents,
no such structure exists yet.

## Decision

Ship Agent Identity Manifests as the next-generation primitive on top
of R34 CADC. Manifests:

1. **Are JSON documents** — human and machine-readable; no exotic
   format
2. **Are signed by the owner's CADC public key** — proves provenance
3. **Declare canonical attributes:** owner, capabilities, model
   versions, code provenance, training-data declaration
4. **Are hash-chained** — modifications require a new manifest
   version; the chain is forensically traceable
5. **Are revocable via signed kill-switch** — same pattern as R34
6. **Are publicly registrable** — federation peers can mirror
7. **Are verifiable offline** — `@sovereign/inspector` ports the
   verification logic

## The KYA Registry pattern

Each Sovereign instance maintains an **agent identity manifest registry**:

```
agent-id-1  →  signed manifest v1
            →  signed manifest v2 (refers to v1's hash as parent)
            →  REVOKED via signed revocation
agent-id-2  →  signed manifest v1 (still active)
```

The registry is queryable via the public endpoint:

```
GET /api/agents/identity/[agentId]  →  current manifest + history
```

Federation peers learn about registered agents via `/.well-known/sovereign-trust`
declaring `agentIdentityRegistry: true`. A merchant verifying a transaction
fetches the agent's manifest from any Sovereign instance, verifies the
signature locally with `@sovereign/inspector`, and gets cryptographic
confidence that the agent is who it claims to be.

## What goes in a manifest

```json
{
  "$schema": "sovereign-identity-manifest/v1",
  "id": "agent-uuid",
  "name": "travel-agent",
  "version": "1.2.3",
  "owner": "user_alpha",
  "ownerPublicKey": "<base64url Ed25519>",
  "purpose": "Books travel within budget",
  "capabilities": ["book_flight", "book_hotel", "manage_calendar"],
  "modelProvenance": {
    "models": ["claude-sonnet-4.5", "gpt-4o"],
    "promptHash": "<sha256 hex>"
  },
  "codeProvenance": {
    "repository": "https://github.com/...",
    "commitHash": "<sha256 hex>",
    "buildTimestamp": "2026-04-29T10:00:00Z"
  },
  "trainingDataDeclaration": "No proprietary or copyrighted material",
  "previousManifestHash": null,           // or previous version's chain hash
  "issuedAt": "2026-04-29T10:00:00Z",
  "expiresAt": "2027-04-29T10:00:00Z",
  "revocationPublicKey": "<same as ownerPublicKey or designated key>",
  "manifestSignature": "<base64url Ed25519>",
  "chainHash": "<sha256 hex>"
}
```

The owner signs the canonical-JSON form. Verifiers reconstruct the
canonical form from declared fields and verify the signature.

Revocation: a `revoke` message signed by the same owner key, stored
as `revoked_at + revocation_message + revocation_signature`. After
revocation, every verification of THIS manifest version fails.

## Constraints

- **Pure-function design:** `buildManifestMessage`, `signManifest`,
  `verifyManifest`, `revokeManifest` all pure (no DB, no I/O).
- **Canonical JSON for signing:** key order doesn't change the signature.
- **No external dependencies** — only `node:crypto`.
- **Same Ed25519 keys as R34 CADC** — one user identity across delegation +
  tokens + manifests.
- **Hash-chained version history** — each new manifest references its
  predecessor's chain hash; forensics work even after revocation.

## Options considered

### A. JWT-based identity tokens (rejected)

JWT is widely understood but has shape constraints (compact serialization,
b64url chunks). Manifests want richness — capability descriptions, code
provenance, training declarations. JSON-with-canonical-stringify is a
better fit, with explicit signature semantics.

### B. Verifiable Credentials (W3C, considered)

W3C VC spec is the obvious option. But VC is heavy and has poor
production tooling. We pick a simpler shape compatible with future VC
migration if needed.

### C. Sovereign Identity Manifests (chosen)

Custom but small format aligned with R34 CADC + R37 ACT signature
patterns. Same crypto, same canonical JSON, same chain-hash discipline.

## Consequences

### Positive

- First production-grade agent identity primitive — standards-capture position
- Composes with all prior trust primitives (CADC, ACTs, federation, audit)
- Enables R40 (public reputation system) — reputation is keyed by agent ID
- Procurement-ready: regulated industries can REQUIRE manifest-verified agents
- Open source (in `@sovereign/inspector`) → trustless verification

### Negative

- New primitive = new test surface
- Manifest schema evolution requires care (versioned `$schema` field)
- Privacy: manifest is PUBLIC; sensitive owner info should not be embedded
  (we declare a small public field set; private metadata stays off-chain)

### Mitigations

- `$schema` field allows future v2 with strict back-compat checks
- Privacy: only public-safe fields (owner = userId, not email; capabilities
  list, not scope details; code provenance is hashes, not source)
- All operations pure-function tested before any DB integration

## Implementation

- `drizzle/0048_agent_identity_manifests.sql` — table
- `src/lib/agent-identity.ts` — pure functions:
  - `buildManifestMessage(manifest)`
  - `signManifest(manifestData, ownerPrivateKey, ownerPublicKey)`
  - `verifyManifest({ manifest, expectedOwnerPublicKey })`
  - `buildRevocationMessage(manifestId, reason, issuedAt)`
  - `verifyRevocation({ manifest, revocationMessage, revocationSignature, ownerPublicKey })`
- `packages/inspector/src/identity.mjs` — port for offline verification
- `packages/inspector/src/cli.mjs` — `sovereign-inspect verify-agent`
- `/.well-known/sovereign-trust` — declares `agentIdentityRegistry: true`
- ~25 unit tests covering: manifest construction, signature roundtrip,
  forgery defense, revocation defense, chain-hash tampering, version chain

## Strategic frame

After R38, the platform's positioning becomes:

> *Sovereign Matrix is the only agentic platform that ships
> production-grade agent identity manifests, capability tokens, and
> delegation chains — verifiable end-to-end by any third party,
> without trusting Sovereign servers.*

R38 is the FOUNDATION for:
- R40: public agent reputation system (keyed by manifest ID)
- R41: cross-instance KYA federation (mirror manifests across peers)
- R42: agent insurance protocol (underwriting requires KYA)
- IETF RFC submission combining R36 + R37 + R38 as "Sovereign Trust 1.0"

R38 closes the last major gap in the cryptographic agent-trust stack.
