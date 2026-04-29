# ADR-0005: Agent Capability Tokens (ACTs)

**Status:** Accepted (R37)
**Date:** 2026-04-29
**Deciders:** @christiaandewet, Claude (Sovereign Matrix)
**Affects:** `src/lib/agent-capability-tokens.ts`, `drizzle/0047_*.sql`,
`packages/inspector/src/verify.mjs`, `/.well-known/sovereign-trust` (new
capability flag)

## Context

R34 shipped Cryptographic Agent Delegation Chain (CADC) — a user signs
a delegation message granting an agent a SCOPE. The agent then signs
each action.

This is enough for one-level delegation. It's NOT enough for the real
shape of agent commerce: an orchestrator agent delegates to a
sub-agent, which delegates to another sub-agent, which makes the
actual purchase. Three levels deep, possibly more.

The naive solution is to issue a fresh delegation at every level. That
requires the user to be online for every transaction — defeats the
point of agent autonomy.

The **right** solution is *attenuation*: a token can be derived into a
more-restricted child token, cryptographically, without contacting the
original issuer. The child has STRICTLY LESS permission than the parent
(narrower scope, shorter expiry, etc.). Verifiers walk the chain
end-to-end and confirm every level's caveats are satisfied.

This is the pattern of **Macaroons** (Google Research, 2014) and
**Biscuit Auth** (IETF working group, 2020+). Neither has seen wide
production adoption, partly because traditional auth is entrenched.

**The key opportunity:** AI agents have NO entrenched capability format
yet. The field is wide open. Whoever ships the first production-grade
agent capability token format becomes the reference impl.

## Decision

Ship Agent Capability Tokens (ACTs) as the next-generation primitive
on top of R34 CADC. ACTs:

1. **Are signed Ed25519 tokens** — same crypto primitive as CADC; same
   `@sovereign/inspector` library can verify them.

2. **Carry caveats** (constraints) — `max_cents`, `allowed_merchants`,
   `expires_at`, `merchant_categories`, custom predicates.

3. **Are attenuatable** — anyone holding a parent token can mint a
   child token by adding caveats. The child token's signature chains
   to the parent.

4. **Are verifiable offline** — a merchant or sub-agent verifies the
   chain locally with `verifyTokenChain()`. No platform call required.

5. **Are hash-chained** — like the audit chain (R26) and the action
   signature chain (R34). Tampering with any past token in the chain
   breaks the chain.

6. **Compose with all existing primitives:**
   - **R26 audit:** every mint/attenuate event is an audit row
   - **R30 spend cards:** spend authorizations BECOME ACTs (a special
     case with `{max_cents, expires_at}` caveats)
   - **R33 multi-stage HITL:** high-stakes mints route through HITL
   - **R34 CADC:** the root token is signed by the user's CADC key
   - **R36 federation:** ACTs cross instance boundaries via the
     federation discovery file

## Constraints

- **Pure-function design** — `mintToken`, `attenuateToken`, `verifyTokenChain`
  must be pure (no DB, no I/O) so they can be unit-tested AND ported
  to `@sovereign/inspector` for offline verification.
- **No external dependencies** — `node:crypto` only. Same as CADC.
- **Canonical JSON** — caveats are JSON objects; canonical-stringify
  before signing so key order doesn't break signatures.
- **Caveat language is extensible** — start with 5 built-in caveats
  (max_cents, allowed_merchants, expires_at, merchant_categories,
  allowed_actions) but the format must allow custom caveats with
  predicate code.

## Options considered

### Option A — JWT with custom claims (rejected)

JWT is widely understood but not naturally attenuatable. You can't
derive a child JWT from a parent without re-signing — which means
the original signer must be online. Defeats the purpose.

### Option B — Macaroons (chosen, with adaptations)

Originally proposed by Google Research. Each token has a list of
"caveats" added incrementally, with each caveat HMAC'd to the
previous. Verifier checks each caveat in turn.

**Adaptations for AI agents:**
- Use Ed25519 signatures (asymmetric) instead of HMAC (symmetric).
  Why: a merchant verifying a token shouldn't need the issuer's
  shared secret. They use the issuer's public key (already in
  R36 sovereign-trust discovery file).
- Caveats are JSON, not opaque strings. More auditable.
- Chain hash links each attenuation level for tamper detection.

### Option C — Biscuit Auth (rejected, for now)

IETF working group format, more complex, uses a Datalog dialect for
caveats. Powerful but overkill for v1. Could be a future migration
target if the agent-commerce space wants Datalog policy expressiveness.

## Consequences

### Positive

- First production agent capability token format → standards-capture position
- Composes with all R26-R36 primitives without breaking changes
- Verifier code shared between platform and `@sovereign/inspector` (npm)
- Agent-to-agent commerce protocol becomes feasible (each agent has its
  own ACT chain; cross-instance verification via R36 federation)
- Per-merchant scopes become cryptographically enforced

### Negative

- New primitive = new test surface = new audit surface
- Caveat predicates must be carefully designed to avoid Turing-complete
  blow-up (we choose simple JSON predicates, not Datalog)
- Backwards-compat: existing R30 spend authorizations are NOT ACTs;
  we'll provide a migration path but they remain side-by-side for now

### Mitigations

- Caveat predicates limited to 5 built-in types in v1
- Chain depth capped at A2E_HARD_CEILING (10) to bound verifier cost
- All operations pure-function tested before any DB integration

## Implementation

- `drizzle/0047_agent_capability_tokens.sql` — migration
- `src/lib/agent-capability-tokens.ts` — pure-function lib
  - `mintToken(issuerPrivateKey, subject, caveats, expiresAt)`
  - `attenuateToken(parent, attenuatorPrivateKey, additionalCaveats)`
  - `verifyTokenChain(rootIssuerPubKey, tokenChain, action)`
- `packages/inspector/src/verify.mjs` — port for offline verification
- `packages/inspector/src/cli.mjs` — `sovereign-inspect verify-token`
- `/.well-known/sovereign-trust` — declares `agentCapabilityTokens: true`
- 25+ unit tests covering caveat semantics, attenuation rules,
  chain verification, signature forgery defense

## Strategic frame

After R37, the platform's defining sentence becomes:

> *Sovereign Matrix is the only agentic platform that ships
> cryptographically-attenuatable capability tokens — the first
> production-grade Macaroon-pattern format for AI agents.*

This positions us for:
- Standards-body engagement (IETF, W3C)
- Agent-to-agent commerce protocol (one agent's ACT crosses to another)
- Open-source `@sovereign/act` package (separate from `@sovereign/inspector`)
- Eventual standardization as "ACT 1.0"

R37 is the primitive R36 (federation) was waiting for.
