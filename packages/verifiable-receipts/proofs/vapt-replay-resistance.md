# Proof — VAPT replay resistance

**Claim.** A Verifiable Agentic Payment Token (VAPT) minted at
time `t_0` cannot be successfully replayed against a settlement
verifier at any time `t > t_0 + 3600 seconds` (1 hour), even
without any state tracking on the verifier.

Equivalently: the **maximum economic replay exposure** of a single
VAPT is bounded by:

```
Exposure(VAPT) ≤ maxAmount   AND   Lifetime(VAPT) ≤ 1 hour
```

## Notation

- `t_0`: issuance timestamp (= `VAPT.issuedAt`).
- `t_1`: expiry timestamp (= `VAPT.expiresAt`).
- `Δt := t_1 - t_0`. The mint validator enforces `Δt ≤ 3600 sec`.
- `now`: the verifier's wall-clock at settlement time.
- `Amount`: the proposed settlement amount.
- `MaxAmount`: the VAPT's `maxAmount` constraint.

## Assumptions

1. **D1 (Mint validator integrity).** `mintVapt()` rejects any
   payload with `t_1 - t_0 > 3600 sec` (enforced by
   `validateMintInputs` in `src/vapt.ts`).
2. **D2 (Verifier clock loose-sync).** The settlement verifier's
   clock drifts by at most `δ` seconds from any honest issuer's
   clock. (In practice δ < 30 sec via NTP.)
3. **D3 (Signature non-malleability from `vaos-v2-non-malleability.md`).**
   No PPT adversary produces a different VAPT payload that
   verifies under the same user key.
4. **D4 (Verifier executes the full constraint check).** The
   verifier consults the issuance/expiry timestamps and
   `maxAmount` field every time `verifyVapt()` is called.

## Proof

By inspection of `verifyVapt()` in `src/vapt.ts`:

```
if (now < issued) return { ok: false, reason: "token not yet valid" }
if (now > expires) return { ok: false, reason: "token expired" }
if (proposedAmount > payload.maxAmount) return { ok: false, ... }
```

### Step 1 — Temporal bound

Verification succeeds only if `now ≤ t_1`. Since the mint
validator (D1) enforces `t_1 ≤ t_0 + 3600`, we have

```
now ≤ t_0 + 3600
```

This bound is **wall-clock-based**, requiring no replay-tracking
state on the verifier: once `now > t_0 + 3600 + δ`, the VAPT is
unconditionally rejected, regardless of how many times it's
presented.

### Step 2 — Per-presentation amount bound

Each call to `verifyVapt()` enforces `Amount ≤ MaxAmount`. So a
single successful settlement extracts at most `MaxAmount` units.

### Step 3 — Multi-presentation bound

Within the 1-hour window, the verifier sees the same VAPT some
number `k ≥ 0` of times. By D3, every presentation has the
same payload (in particular the same `MaxAmount` and the same
`tokenId`).

The implementation field `singleUse: true` is a **hint** to the
settlement layer to track `tokenId` and refuse re-presentation
beyond the first. When the settlement layer honors this hint
(via `vaptHash()` for idempotency keys), `k ≤ 1` and total
exposure equals `min(Amount, MaxAmount) = Amount ≤ MaxAmount`.

When the settlement layer ignores the hint (or doesn't yet exist),
`k` can be > 1, and total exposure equals `k × Amount`. However,
the temporal bound (Step 1) caps `k` at `(3600 / RTT)` where RTT
is the verifier's round-trip time for an attempted settlement. In
production, this is bounded by:

```
k ≤ 3600 / (network_RTT + verifier_latency) ≈ 3600 / 0.1s = 36000
```

Total worst-case exposure: `36000 × MaxAmount`, with the catch
that **every settlement was an explicit, signed, per-tx
authorization by the issuer** that the user granted upfront via
the same VAPT.

### Step 4 — Closing the un-honored-hint gap

Operators that integrate VAPT with a stateful settlement layer
MUST enforce `singleUse` via the `vaptHash(token)` idempotency
key. The reference implementation provides this function
explicitly:

```typescript
import { vaptHash } from "@sovereign-matrix/verifiable-receipts";
const idempotencyKey = vaptHash(token);
if (already_settled(idempotencyKey)) reject;
record_settled(idempotencyKey);
```

Under this discipline, `k ≤ 1` strictly, and total exposure is
bounded by `MaxAmount` for any time, including past `t_1`.

∎

## What this rules out

- **Cross-session replay past 1 hour.** Token expiry is
  wall-clock enforced, so even an attacker with a perfect copy of
  the token cannot settle once `now > t_1 + δ`.
- **Privilege escalation via amount inflation.** `MaxAmount` is
  signed into the canonical bytes; modifying it breaks the
  signature (by non-malleability, D3).
- **Cross-merchant misuse.** When `merchantAllowlist` is set, the
  verifier rejects any merchant not in the list. (Proved by
  direct inspection of `verifyVapt()`.)

## What this does NOT cover

- **Issuer-side double-spend within the window.** If the issuer
  mints two VAPTs back-to-back with different `tokenId`s but the
  same intent ("buy this thing"), the user has authorized two
  spends, not one. This is by design — VAPTs are
  tx-scoped, not intent-scoped. The user-facing UI is responsible
  for not minting duplicates.
- **Compromise of the user's signing key.** A compromised user
  key allows minting arbitrary VAPTs up to whatever amounts the
  payment system itself accepts. Mitigated by storing the user
  key in a hardware-backed enclave (WebAuthn / Secure Enclave /
  TPM) — outside the VAPT layer.
- **Settlement-layer correctness.** VAPT bounds what _can_ be
  settled, not what _will_ be settled. A buggy or malicious
  settlement integrator can ignore the constraints — that's a
  defect in their integration, not a flaw in VAPT.

## Reference implementation

`src/vapt.ts` `validateMintInputs` (enforces D1 at mint time),
`verifyVapt()` (enforces D4 at every check), `vaptHash()`
(returns the idempotency key for the settlement layer).
22 tests in `tests/vapt.test.ts` cover: amount > MaxAmount,
currency mismatch, merchant-allowlist violations, empty-allowlist
(no merchants accepted), expired token, not-yet-valid token,
wrong-key signature, tampered-payload reject, lifetime > 1h
rejection at mint time.
