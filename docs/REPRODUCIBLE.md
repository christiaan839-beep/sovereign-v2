# Reproducible builds — how an auditor verifies what's running

This document walks an external auditor or regulator through the
**exact sequence** required to clone this repository, build the
production artifacts, and confirm that the published behaviour matches
the source. It is intended for a security or compliance reviewer with
no prior relationship to Sovereign Matrix.

The promise: **everything that ships in production is built from the
public source on GitHub**. There are no binary blobs, no
out-of-tree patches, no closed-source dependencies in the verifier
code path. If you can run Node and Git, you can audit us.

---

## 1. Prerequisites

| Tool              | Minimum version | Why                                                    |
| ----------------- | --------------- | ------------------------------------------------------ |
| Node.js           | 22.x            | `engines.node >= 18`; CI uses 22 LTS                   |
| npm               | 10.x            | Bundled with Node 22                                   |
| Git               | 2.x             | Anything modern                                        |
| (optional) Docker | 24.x            | Reproducible container build via the repo's Dockerfile |

All four are MIT/Apache/BSD licensed and freely installable. No
proprietary tool is required to reproduce any artifact this project
publishes.

---

## 2. Verify the source

```bash
git clone https://github.com/christiaan839-beep/sovereign-v2.git
cd sovereign-v2

# Confirm the commit SHA matches the production deploy.
# Production /api/built/ledger returns the latest deployed SHA.
curl -s https://sovereignmatrix.agency/api/built/ledger \
  | jq '.entries[-1].entry.commit'
git rev-parse HEAD   # should match
```

If those two SHAs disagree, the production deploy is ahead of `main`.
You are auditing a _not-yet-merged_ state; either checkout the SHA
returned by the ledger or wait for the merge.

---

## 3. Install dependencies — verify the lockfile

```bash
npm ci
```

Note: `npm ci` enforces the lockfile. If the lockfile and
`package.json` disagree, the install aborts. A passing `npm ci` proves
your install matches CI's install byte-for-byte.

Verify the lockfile integrity yourself:

```bash
npm audit signatures   # checks every package's npm-issued provenance
```

This is best-effort today (not every npm package is signed yet) but
the failures are informative — they tell you which packages don't
ship provenance attestations.

---

## 4. Reproduce the OSS verifier package

The cryptographic primitives that back the platform's promise — the
ones an auditor cares about — live in `packages/verifiable-receipts/`.
Build it standalone:

```bash
cd packages/verifiable-receipts
npx tsc -p tsconfig.json
ls dist/
```

You should see the same `.js` + `.d.ts` files that ship with the
published npm package. Compare:

```bash
# What you just built
sha256sum dist/transparency.js dist/bundle.js dist/pq-sign.js dist/guardian.js

# What npm ships (after publication)
npm view @sovereign-matrix/verifiable-receipts dist.tarball
# curl the tarball, extract, sha256sum the same files
```

The hashes MUST match. If they don't, the published package contains
code that isn't in this repo — open an issue.

---

## 5. Run the full test suite

```bash
cd <repo root>
npm test -- --run
```

Expected: ~3000+ tests pass in under 30 seconds. The suite includes:

- 184 conformance cases for the transparency log primitives
  (RFC 6962 inclusion + consistency proof round-trips for every
  pair up to size 16)
- 22 LogStore tests (in-memory + file-backed persistence
  recovery)
- 16 Upstash adapter tests (mocked fetch — proves the wire
  protocol is correct)
- 13 CLI verifier integration tests (spawns the actual
  `bin/verify.mjs` against a freshly-generated keypair)
- 10 contract tests for `/api/transparency/witness`
- 10 contract tests for `/api/security/posture`
- Contract tests for the Stripe webhook + Credits + CRM webhook
- The receipt-canonicalization round-trip for VAOS 2.0 + 3.0

A red test is a spec violation. There is no `*.skip` in CI.

---

## 6. Build the production bundle

```bash
npm run build
```

Expected: Next.js compiles in under 60 seconds and prerenders
~340 pages. The output is in `.next/`. CI uses the exact same command;
the Vercel deploy uses the exact same command.

To produce a self-contained container artifact identical to what
Vercel/Railway would deploy:

```bash
docker build -t sovereign-matrix:audit .
```

The `Dockerfile` at the repo root is a multi-stage build that uses
Node 22 Alpine + the same `npm ci` + `npm run build` you just ran.
The resulting image's `SHA-256` digest is stable across rebuilds of
the same commit (modulo build-time timestamps in dependency images).

---

## 7. Verify a production receipt end-to-end

The platform's central marketing claim is "any receipt we sign can
be independently verified by any third party". To prove it without
ambiguity:

```bash
# 1. Fetch a real signed receipt bundle that we publish
curl -s https://sovereignmatrix.agency/sample-bundle.json \
  > /tmp/bundle.json
curl -s https://sovereignmatrix.agency/sample-bundle.ed25519.pem \
  > /tmp/pubkey.pem

# 2. Verify it with the OSS CLI you just built
node packages/verifiable-receipts/bin/verify.mjs verify \
  --manifest /tmp/bundle.json \
  --pubkey /tmp/pubkey.pem
# → exit 0; "MANIFEST VERIFIED"

# 3. Tamper a byte; confirm rejection
sed -i 's/rcpt_demo_001/rcpt_FAKE/' /tmp/bundle.json
node packages/verifiable-receipts/bin/verify.mjs verify \
  --manifest /tmp/bundle.json \
  --pubkey /tmp/pubkey.pem
# → exit 1; "hash-mismatch"
```

This proves: the OSS package this repo defines, when run against
the public PEM this domain publishes, accepts the bundle that domain
ships AND rejects any tampered version of it. **The math holds end-
to-end with nothing on the wire we control.**

---

## 8. Verify the transparency log

The append-only log of every receipt this domain has issued is also
public:

```bash
# Current Signed Tree Head
curl -s https://sovereignmatrix.agency/api/transparency/sth | jq

# Inclusion proof for leaf #0
curl -s 'https://sovereignmatrix.agency/api/transparency/proof?kind=inclusion&index=0' | jq

# Consistency proof from size N to current
curl -s 'https://sovereignmatrix.agency/api/transparency/proof?kind=consistency&old=1' | jq
```

Re-derive the math in your own process using the OSS package:

```ts
import {
  verifyInclusionProof,
  verifyConsistencyProof,
} from "@sovereign-matrix/verifiable-receipts/transparency";

// Both endpoints return base64 PEM + hex proofs + root hashes.
// verifyInclusionProof(leafHash, idx, treeSize, proof, rootHash)
// verifyConsistencyProof(oldSize, newSize, oldRoot, newRoot, proof)
```

A passing verification proves the log has not rewritten any leaf
between the two STHs you compared.

---

## 9. What's NOT yet reproducible

Honest disclosure. The audit reaches the limits of independent
verification at these boundaries:

- **The Ed25519 secret key** is held only by Vercel's encrypted env
  store. We attest to the key generation procedure (single keygen
  on an air-gapped host, secret deposited in 1Password, public PEM
  published) but you cannot independently verify the secret never
  leaked.
- **The Vercel build pipeline** runs in their environment, not yours.
  We trust Vercel; you may not. If the trust is unacceptable, the
  `Dockerfile`-based build above gives you a binary you can run on
  your own infra and compare against the Vercel deploy's output.
- **The model providers** (NVIDIA NIM, Cerebras, Anthropic, etc.)
  are external services. Receipt integrity proves WHAT we sent and
  WHAT they returned — not that the model's internal computation
  was honest. Out of scope for VAOS.
- **The transparency log demo** is single-issuer + currently zero
  external witnesses. The "log can't fork" guarantee is theoretical
  until ≥ 2 independent third parties run pollers. The witness API
  exists; recruiting the witnesses is sales/ecosystem work.

---

## 10. If you find a problem

`security@sovereignmatrix.agency` — coordinated disclosure. We
acknowledge within 48h and provide a resolution timeline within 5
business days. We do not pursue legal action against good-faith
researchers.

---

## 11. License

Source: proprietary (platform) — see [`LICENSE`](../LICENSE), which is
authoritative. Individual packages under `packages/` carry their own
`LICENSE` files; 19 of 23 do (17 Apache-2.0, 2 MIT). The VAOS 1.0 spec,
the `vaos-verifier` package and the CLI are named permissive carve-outs.
This document: CC0 1.0 (public domain).

Built with the assumption that any audit-grade claim has to survive
a hostile, well-resourced reviewer. If a step above doesn't work the
way it's documented, please report it — that's a documentation bug
and we'll fix it.

— Christiaan de Wet, Cape Town
