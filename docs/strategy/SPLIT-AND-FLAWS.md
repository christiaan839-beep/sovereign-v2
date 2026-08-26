# The Split, The Flaws, The Worklist

> Companion to `VALUE-EXTRACTION-2026-08.md`. That file argues *what is worth money*.
> This one answers the operational question: **the repo is too big, it is two products,
> and it has flaws — so what do we actually work on?**
>
> Everything below was measured against the tree on 2026-08-26. Commands are in
> §5 so any claim can be re-derived.

---

## 1. It is two products, and the seam is already clean

| | Product A — **VAOS** | Product B — **the platform** |
| --- | --- | --- |
| Lives in | `packages/` (24 packages) | `src/` |
| Size | **29,608 LOC** | **274,078 LOC** |
| Depends on the other? | **No — zero imports from `src/`** | Yes — imports 16 of the packages |
| Build coupling | npm workspaces (`packages/*`) | consumes A as a dependency |
| Buyer | compliance officer, security lead, regulator | agency operator |

**The good news, and it is genuinely good: the dependency arrow already points the
right way.** `packages/` contains no reference to `@/lib`, `@/db`, `@/app`, or
`src/`. Not one. Product A does not know Product B exists.

That means **extracting VAOS is not a refactor.** It is `git filter-repo` on
`packages/` + `docs/specs/`, an `npm publish`, and pointing the app at the
published versions instead of the workspace. The hard architectural work —
keeping the spec implementation free of platform coupling — was already done and
held.

**The one thing that does straddle** is the receipt layer inside `src/lib`
(~30 modules). Of the 15 core ones, **7 are already pure** (`receipt-schema`,
`receipt-ratchet`, `merkle-receipt-batch`, `witness-store`, `provenance`,
`multi-party-attestation`, `audit-log-integrity`). The other 8 depend on exactly
four things: `logger`, `audit-log`, `agent-runs`, `zip-writer`. Three of those
four are ports you inject, not logic you port.

`agent-runs.ts` (487 LOC, 42 importers) is the true boundary object — it owns
canonicalization *and* signature verification *and* the DB row. Splitting it is
the only non-mechanical work in the extraction, and §4 W3 sizes it.

---

## 2. The flaws, ranked by what they cost you

### F1 — CRITICAL: a public trust page asserts a crypto scheme that is not implemented

`/status/integrity` is a public page. It renders `v3_ed25519_mldsa65.enabled`
straight from `/api/security/posture`, which computes it as:

```ts
v3_ed25519_mldsa65: {
  enabled: ed25519Configured() && mldsa65Configured(),   // env-var presence ONLY
}
```

Two environment variables being set flips a public indicator claiming
Ed25519 + ML-DSA-65 dual-signing is live. But in the running system:

- **`formatV3Wire()`** — composes the `v3=<ed>.<mldsa>` wire — has **zero production callers**.
- **`verifyDualSig()`** — verifies that wire — has **zero production callers**.
- **`verifySignature()`** in `agent-runs.ts` — the function actually behind
  `/api/verify` and `/api/verify/badge.svg` — handles `v1=` and `v2=` and then:

  ```ts
  // Unknown algorithm prefix — reject (forward-compat: v3, v4, ...
  // will require explicit support).
  return false;
  ```

  **It would reject a v3 receipt if one existed.**

So no agent-run receipt is ever v3-signed, and the public verifier could not
accept one. The status page says otherwise.

**Be precise about what *is* real**, because most of it is: `signMlDsa65()` is
genuinely called by `capability-receipts`, `deletion-receipts` and
`defense-receipts`, which store `mldsa65Sig` as a field, publish the public key
at `/.well-known/sovereign-receipts/mldsa65.b64`, and tell the holder how to
verify it. And `verifyMlDsa65WithKey()` is genuinely used by
`federation-puller.ts` to verify inbound bulletins from other issuers. The
cryptography works. What is missing is the **v3 wire format and the platform's
own verification of it** — the two pieces the status page is claiming.

**Why this is the top item:** for a company whose entire product is "you should
not have to trust us, you should be able to check," an unearned claim on the
trust surface is the one bug that invalidates the pitch. It is also the *most
fixable* — every piece exists, nothing is wired.

### F2 — HIGH: 93 orphaned modules, 16,529 LOC, and it explains the test paradox

| Class | Modules | LOC | Meaning |
| --- | --- | --- | --- |
| **A. Truly dead** | 26 | 5,279 | Zero references anywhere, not even a test |
| **B. Tested but unwired** | 55 | 9,336 | Has passing tests; **nothing in production calls it** |
| (remainder) | 12 | ~1,900 | Referenced only as string literals in registries/docs |

Class B is the finding that matters. It resolves the paradox between
"**4,491 passing tests**" and "**1.4% of agents are multi-step**": a large slice of
the suite is testing code that never executes in production. The green badge is
partly measuring shelf-ware.

Biggest truly-dead: `error-recovery` (795), `semantic-memory` (423),
`voice-service` (324), `output-refiner` (319), `swarm-protocol` (299 — already
flagged in `BACKLOG.md`), `peer-loop` (262), `browser-engine` (235).

Biggest tested-but-unwired: `nemo-guardrails` (543), `guardian-packs` (402),
`dual-approval` (385), `soc2-evidence` (356), `retention-proof` (287),
`red-team` (238), `receipt-search-index` (221), `webhook-sign` (215).

Note `nemo-guardrails` and `input-sanitizer` are listed in `CLAUDE.md` as the
security layer, and `merkle-receipt-batch` is cited by `vertical-readiness.ts`
as a shipped capability — all three are class B. **Documented as load-bearing,
not actually loaded.**

*(Method caveat, stated because it bit me: a first pass called `output-verifier`
dead. It is not — `agent-factory.ts:911` reaches it via a dynamic
`await import()`. The numbers above count dynamic imports. Re-verify with §5
before acting on any single module.)*

### F3 — HIGH: bare `fetch()` in API routes has grown, not shrunk

`BACKLOG.md` M1 records **121** callsites. Today: **182 across 124 files.**
The ESLint guardrail from wave 107 warns on each, and the count rose ~50%
anyway — warnings are being shipped past. Mixed risk: `https://api.resend.com`
is a hardcoded provider URL and fine; `fetch(n8nWebhookUrl)` and
`fetch(\`${baseUrl}${spec.path}\`)` are the SSRF surface `outboundFetch` exists to
close.

### F4 — MEDIUM: `soc2-evidence` exists twice
`src/lib/soc2-evidence.ts` (356 LOC, class B — nothing imports it) **and**
`packages/soc2-evidence/`. The compliance page imports the *package*. The
`src/lib` copy is a stale fork. One of them is a lie; delete it.

### F5 — LOW: `src/lib/db.ts` orphan
164 LOC duplicating `src/db/index.ts`. Zero importers. Two DB setups is one too
many in a repo where `@/db` is the documented path.

### F6 / F7 — already reported
ZAR pricing inconsistency (Array bills SA customers ~$270 for a $49 plan) and
CI red on `main` since 2026-05-21 (account-level block; jobs die in 2–3s before
`npm ci`). Both are in the prior doc and PR #224.

---

## 3. What this means about repo size

The repo is not too big because it does too much. It is too big because
**~16.5k LOC does nothing at all**, and a second product worth 29.6k LOC is
trapped inside the first one's release cycle, unpublishable and invisible.

Delete class A, wire or delete class B, extract Product A → the thing you
maintain daily shrinks by roughly a fifth, and the part that is actually
differentiated gets its own release cadence.

---

## 4. The worklist

Ordered so each item makes the next one cheaper. Sizes are honest.

### W1 — Make the trust surface true `½ day` **do this first**
Either implement v3 end-to-end or stop claiming it. Two acceptable outcomes:

- **(a) Implement.** Wire `formatV3Wire()` into the agent-run signing path; add a
  `v3=` branch to `verifySignature()` that delegates to `verifyDualSig()`
  (the injected-`verifyEd25519` seam is already designed for exactly this call).
  Then `enabled` becomes true honestly.
- **(b) Downgrade the claim.** Change `enabled` from env-var presence to a real
  probe — "are any receipts actually v3-signed?" — and let the page report
  `available: false` until (a) ships.

Do **(b) today regardless**; (a) can follow. A false claim on a trust page is
worse than a missing feature. Add a test that fails if `posture.enabled` is
true while no v3 wire exists.

### W2 — Delete class A `1 day`
26 modules, 5,279 LOC, zero references. Delete in one commit, per-module verified
with §5. No behavior change possible — nothing calls them. Biggest single
readability win available, and it makes W3's boundary analysis honest.

### W3 — Extract Product A `2–3 days`
1. Split `agent-runs.ts`: canonicalization + `verifySignature` move to a pure
   `packages/verifiable-receipts` module; the DB row stays in the app. This is
   the only real design work in the whole split.
2. `git filter-repo` `packages/` + `docs/specs/` into `vaos` with history.
3. Publish the four core packages (**this is also the 31 Aug item** — it is
   blocked on the CI/account issue, so unblock that first).
4. Repoint the app at published versions instead of workspace links.

### W4 — Triage class B `2 days`
For each of the 55: wire it, or delete it. Nothing stays tested-but-unwired —
that is the state that makes a green suite misleading. Start with the three that
`CLAUDE.md` and `vertical-readiness.ts` claim are load-bearing
(`nemo-guardrails`, `input-sanitizer`, `merkle-receipt-batch`), because those are
documentation that is currently false.

### W5 — `fetch()` → `outboundFetch()` codemod `1 day`
182 sites / 124 files. Mechanical, but triage per site: hardcoded provider URL →
straight swap; user- or config-supplied URL → swap **plus** the SSRF allowlist.
Then flip the ESLint rule from `warn` to `error` so the count cannot climb again.
The rule flipping is the durable half.

### W6 — Kill the duplicates `1 hour`
Delete `src/lib/soc2-evidence.ts` and `src/lib/db.ts`. Both orphaned, both
shadowing a real implementation.

### Not on this list, deliberately
Agents #141+, the DAG executor, memory opt-in for the remaining 119 agents.
All real backlog items. None of them shrink the repo, fix a false claim, or
ship the asset.

---

## 5. Re-derive any claim

```bash
# Product A has no dependency on Product B (expect: empty)
grep -rn "@/lib\|@/db\|@/app\|from \"src/" packages/*/src

# Orphan classes A and B (counts dynamic imports; excludes self + tests)
for f in src/lib/*.ts; do b=$(basename "$f" .ts); case "$b" in *.test) continue;; esac
  all=$(grep -rE "[\"'][^\"']*(@/lib/|\.\./|\./)${b}[\"']" src server scripts e2e 2>/dev/null | grep -v "^src/lib/${b}.ts:")
  prod=$(echo "$all" | grep -v "/__tests__/" | grep -v "\.test\.ts" | grep -c .)
  any=$(echo "$all" | grep -c .)
  [ "$any" -eq 0 ] && echo "DEAD    $b $(wc -l < $f)"
  [ "$any" -gt 0 ] && [ "$prod" -eq 0 ] && echo "UNWIRED $b $(wc -l < $f)"
done

# v3 has no production caller (expect: tests only)
grep -rn "formatV3Wire\|verifyDualSig" src server --include=*.ts | grep -v "^src/lib/pq-sign.ts:"

# bare fetch in API routes
grep -rnE "[^a-zA-Z._]fetch\(" src/app/api --include=*.ts | grep -v outboundFetch | wc -l
```
