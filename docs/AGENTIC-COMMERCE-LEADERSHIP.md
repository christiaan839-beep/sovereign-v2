# Agentic Commerce Leadership — How Sovereign Wins

**Status:** Shipped (R91 — April 29, 2026)
**Audience:** CFO, CISO, Head of Payments, Procurement
**Sister artifact:** `src/lib/agentic-commerce/acat.ts`, `src/lib/__tests__/acat.test.ts`

---

## TL;DR

Every payments network is racing to support agent-initiated purchases. **None
of them ship the cryptographic substrate that lets a seller verify, OFFLINE,
that an agent is actually authorized to spend on a user's behalf.** They ship
rails. We ship the trust layer that runs ON the rails.

R91 closes this with the **Agentic Commerce Authorization Token (ACAT)** —
a Macaroon-pattern, Ed25519-signed, attenuatable capability token that any
seller can verify with ~80 lines of pure-function code (or a single
`@sovereign/inspector` import). No round-trip. No vendor lock-in. No
trust-us-bro JWT.

We are not competing with Stripe, Visa, or Mastercard. **We are the
verification primitive their agentic-commerce features will need to be
trustworthy in court.**

---

## Market Reality (with dates)

| Date            | Provider               | Launch                                                                                  |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| May 2024        | Stripe                 | Agentic Commerce Toolkit — agent SDKs, agent-friendly checkout                          |
| Sept 2024       | Anthropic              | Computer Use — agent operating GUI, including checkout flows                            |
| Jan 2025        | OpenAI                 | Operator — agent that books, buys, and submits forms                                    |
| April 2025      | Visa                   | Visa Intelligent Commerce — agent-initiated payment rail                                |
| Q1 2025         | Mastercard             | Agent Pay — partnered with Microsoft on agent purchasing                                |
| Q1 2025         | Amazon                 | "Buy for Me" — agent shopping inside the Amazon app                                     |
| 2024-25         | Klarna                 | AI agent shopping experience (then publicly walked back AI customer-service in May '25) |
| 2024-25         | Shopify, Walmart       | Agent-friendly checkout endpoints, agent-aware fraud rules                              |

What every announcement has in common: **policy + UX, no cryptographic
verification primitive**. Stripe's Agentic Commerce Toolkit assumes the agent
is authorized because the user said so to the agent. Visa Intelligent
Commerce assumes the issuer's risk model can detect fraud. Mastercard Agent
Pay relies on the merchant's existing 3DS rails.

That's a comfort assumption, not a verifiable one. The first big agent fraud
case will end this comfort overnight.

---

## The 7 Trust Questions a Buyer Will Ask

When the chargeback dispute lands and the merchant has to explain to a court
what authorized this purchase, they need verifiable answers to:

1. **Who is the user?** — Cryptographic identity, not "the user told the
   agent."
2. **Who is the agent?** — Identity manifest, not "an LLM we don't operate."
3. **Did the user actually authorize this agent?** — A signed delegation,
   not a checkbox in a UI.
4. **What were they authorized to spend?** — Bounded scope (amount, merchant,
   category, expiry), not "anything."
5. **Was the agent in good standing?** — Reputation snapshot at issuance.
6. **Did they cover the loss?** — Insurance binding (optional but available).
7. **Can a third party verify all of this OFFLINE without us?** — Or are we
   asking the court to trust an opaque issuer?

We've shipped 6/7 already. R91 closes #7.

| #  | Trust question                | Sovereign primitive       | Round shipped |
| -- | ----------------------------- | ------------------------- | ------------- |
| 1  | User cryptographic identity   | CADC (Ed25519 user keys)  | R34           |
| 2  | Agent identity manifest       | KYA (signed manifest)     | R38           |
| 3  | User → agent delegation       | ACT (capability token)    | R37           |
| 4  | Bounded spending scope        | ACAT (this round)         | **R91**       |
| 5  | Reputation at issuance        | letter-grade snapshot     | R40           |
| 6  | Insurance coverage reference  | bound policy (R46)        | R46           |
| 7  | Offline third-party verifier  | `@sovereign/inspector`    | R36 (ports)   |

**Strategic punchline:** the moment Stripe / Visa / Mastercard need to
*prove in court* that an agent was authorized, they will need #4 and #7.
We are the only platform that ships both as a single composable primitive.

---

## R91 — Agentic Commerce Authorization Token (ACAT)

### Format

ACATs are JSON objects, base64url-encoded for HTTP transport. The signed
canonical message is line-separated to be deterministic:

```
acat-v1
agentic-commerce-authorization
agentId:<R38 manifest reference>
agentManifestVersion:<exact version>
userId:<R34 user id>
userPublicKey:<base64url Ed25519 pubkey>
scopeHash:<sha256 of canonical scope JSON>
reputationHash:<sha256 of reputation snapshot or "none">
insuranceHash:<sha256 of insurance binding or "none">
caveatsHash:<sha256 of caveats array>
issuedAt:<ISO 8601>
```

Signed with the user's Ed25519 private key. The seller verifies the signature
using the user's public key (embedded in the token, cross-checked against the
agent's identity manifest).

### Scope (what the user authorized)

```ts
interface ACATScope {
  maxCents: number;                    // e.g., 50000 = $500
  currency: "USD" | "EUR" | "GBP" | …;
  allowedMerchantIds?: string[];       // allowlist — empty means any
  allowedCategories?: CommerceCategory[]; // ISO 18245 MCC families
  excludedCategories?: CommerceCategory[]; // hard-deny (gambling, etc.)
  validFrom: ISO8601;
  validUntil: ISO8601;
  singleUseNonce?: string;             // optional one-shot
}
```

### Macaroon-pattern attenuation

Originally Google's 2014 capability-token paper — and the only known token
format where the holder can *narrow* scope without contacting the issuer.
Critical for agentic commerce: the user issues a broad token ("$500/mo at
any merchant"), the agent attenuates for a specific cart ("$73.42 at
merchant-acme for cart-id-XYZ, valid 5 minutes"), the seller verifies just
the attenuated form.

Attenuation is enforced narrowing-only via `additionalCaveatIsNarrowing()`
— same defense pattern as R37 ACTs. **An attenuated ACAT can never widen
the original delegation.** This is the property that makes the whole flow
safe.

### 12 Distinct Verification Failure Reasons

`verifyACAT()` returns one of these reasons on failure (procurement-readable):

```
message_mismatch         signature_invalid       user_pubkey_mismatch
expired                  not_yet_valid           scope_violation
merchant_not_allowed     category_excluded       category_not_allowed
single_use_consumed      chain_hash_mismatch     amount_exceeds_scope
```

This granularity matters for incident-response and fraud forensics. "Token
invalid" is useless to a CISO; `category_excluded` tells them exactly what
the agent tried to buy and why their policy stopped it.

---

## How a Seller Integrates (3 ways, all offline)

### 1. Drop-in npm package

```ts
import { verifyACAT, decodeACATFromHeader } from "@sovereign/inspector";

const token = decodeACATFromHeader(req.headers["x-sovereign-acat"]);
if (!token) return reject("malformed-token");

const result = verifyACAT({
  token,
  expectedUserPublicKey: lookupUserPubkey(token.userId),
  cart: { amountCents, currency, merchantId, category },
  isNonceConsumed: nonce => sellerDb.has(`acat:${nonce}`),
});

if (!result.valid) return reject(result.reason);
```

### 2. Reimplement the verifier (~80 LOC)

Every line is in `src/lib/agentic-commerce/acat.ts`. Pure functions. No
hidden state. The seller can audit it, fork it, or re-implement it in their
preferred language. This is the **trust through transparency** principle:
they verify the math, not us.

### 3. Stripe / Visa / Mastercard adapter (planned R-next)

A thin adapter that converts ACAT → 3DS authentication payload, ACAT →
Stripe Agentic Commerce Toolkit metadata, ACAT → Visa Intelligent Commerce
authorization. We meet them where they are. **The ACAT is the source of
truth; the rails are the transport.**

---

## Composition with Shipped Primitives

ACAT is not a new island. It composes with everything we've shipped:

| Primitive   | Composition                                                     |
| ----------- | --------------------------------------------------------------- |
| **R34 CADC** — Ed25519 user signing | Same key signs ACATs. One identity, one chain.                  |
| **R37 ACT** — capability tokens     | ACATs are commerce-specialized ACTs. Same attenuation invariant.|
| **R38 KYA** — agent manifest        | ACAT references the manifest version, so reputation is bound.   |
| **R40 reputation** — letter grade   | Snapshot embedded in the ACAT for offline accept/decline logic. |
| **R42 credit line** — trust collateral | Spend cap respects the user's R42 credit envelope.            |
| **R46 insurance** — per-incident    | Optional policy reference, verifiable with the carrier.         |
| **R26 audit chain** — hash-chained  | Every ACAT mint + use is appended to the user's audit chain.    |
| **R45 audit export** — receipt      | `summarizeACATForReceipt()` produces the procurement summary.   |
| **R67 reputation diff**             | Reputation drift detection works on ACAT issuance snapshots.    |

The cumulative effect: **a single Ed25519 user key, a single audit chain,
and a single inspector binary** verify the entire cryptographic trust
contract — identity, delegation, scope, reputation, insurance, and
post-purchase receipt.

---

## Why This Wins (and is not a Stripe / Visa competitor)

We are not building a payment network. We are not building a wallet. We are
not building a competitor to the Agentic Commerce Toolkit. **We are building
the substrate that will make those products provably trustworthy.**

Three positioning moves that make this anti-fragile:

1. **Procurement-grade by default.** The buyer of an agentic-commerce
   capability is a CFO + CISO + Procurement, not a developer. They need
   audit artifacts, regulatory citations, and offline verification. We
   deliver all three out of the box. Stripe ships SDKs. We ship court
   exhibits.

2. **Open verification, closed mint.** The verifier is open-source and ports
   to the inspector. The mint is gated behind R34 user keys, R38 agent
   manifests, R40 reputation, and R42 credit-line policy. **We don't lock in
   sellers; we lock in user trust.** Sellers can leave at any time. Users
   can't be forged.

3. **Rails-agnostic.** ACAT is not bound to any payment rail. Card networks,
   ACH, SEPA, blockchain rails (R59 on-chain reputation anchor on the
   roadmap), agent-to-agent settlement — all use the same substrate. The
   moment a new payment rail appears, ACAT works on it for free.

---

## The Procurement Story (for your sales motion)

When a CFO asks "how does this prevent agent runaway spending":

> Every agent-initiated purchase requires a Sovereign ACAT — a
> cryptographically signed, time-bounded, scope-bounded delegation issued
> by the user's Ed25519 key. The token is verified offline by the seller
> using `@sovereign/inspector`. The seller doesn't trust us — they verify
> the math. If the agent tries to buy something outside scope, the
> verifier returns one of 12 distinct failure reasons (e.g.,
> `amount_exceeds_scope`, `category_excluded`, `merchant_not_allowed`),
> all of which are written to the user's hash-chained audit log (R26)
> and exportable as procurement-ready receipts (R45).
>
> If the user wants to add insurance, they bind a policy from a Lloyd's
> syndicate (R46), and the policy reference is embedded in every ACAT
> the agent presents. The carrier verifies the binding offline.
>
> Reputation snapshot is embedded — sellers can refuse low-reputation
> agents at the door without contacting Sovereign. We are not the
> bottleneck; we are the trust math.

That story closes deals.

---

## Engineering Notes

**Test coverage:** 32 tests in `src/lib/__tests__/acat.test.ts` covering
canonical message format, mint/verify roundtrip, every one of the 12
failure reasons, Macaroon narrowing-only invariant, attenuation chain hash,
HTTP transport encode/decode, receipt summary, and chain hash purity.

**Tsc:** `npx tsc --noEmit` clean.

**Pure-function design:** Every function in `acat.ts` is pure. Mint requires
a private key (impure input), but the output is deterministic given the
same inputs. No globals. No I/O. **The whole file ports to
`@sovereign/inspector` for offline customer verification.** When we publish
the inspector to npm, sellers install one package and verify ACATs with no
network dependency on Sovereign at all.

**Anti-drift:** `scripts/weekly-health.mjs` carries 7 R91-specific
invariants — presence of the lib, presence of tests, narrowing-only
defense, all 12 failure reasons present, summary helper present, HTTP
transport helpers present, Macaroon-pattern citation present. **CI fails
on every PR if any of these regress.**

---

## What's Next (the rails adapters)

| Round (planned) | Adapter                              |
| --------------- | ------------------------------------ |
| R92             | Stripe Agentic Commerce Toolkit adapter (ACAT → Stripe metadata) |
| R93             | Visa Intelligent Commerce adapter (ACAT → 3DS payload) |
| R94             | Mastercard Agent Pay adapter         |
| R95             | Shopify Agent-Checkout adapter       |
| R96             | Amazon "Buy for Me" adapter          |

Adapters are thin — they convert ACAT to the rails' native authorization
format. The ACAT remains the source of truth.

---

## References

- Macaroons: Birgisson et al., "Macaroons: Cookies with Contextual
  Caveats for Decentralized Authorization in the Cloud", NDSS 2014.
- ISO 18245 (MCC) — Merchant Category Codes.
- ISO 4217 — Currency codes.
- Stripe Agentic Commerce Toolkit (May 2024 launch).
- Visa Intelligent Commerce (April 2025 launch).
- Mastercard Agent Pay + Microsoft partnership (Q1 2025).
- Anthropic Computer Use (Sept 2024 launch).
- OpenAI Operator (Jan 2025 launch).

---

*This document is the definitive strategic positioning for Sovereign's
agentic-commerce leadership. Updated April 29, 2026. Maintained by the
Sovereign trust team. Procurement questions: <christiaan@sovereignmatrix.agency>.*
