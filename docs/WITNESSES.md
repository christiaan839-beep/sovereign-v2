# VAOS Witness Registry

A public list of independent transparency-log witnesses that
co-sign Signed Tree Heads emitted by Sovereign Matrix and other
VAOS issuers. This is the **federation primitive** that makes the
VAOS trust model Byzantine-fault-tolerant rather than "trust one
server" — a verifier checks against multiple witnesses, and any
inconsistency (log equivocation) becomes detectable within minutes.

CC0 1.0. Republish, fork, run your own witness.

Last updated: 2026-05-18 (Wave 63).

---

## How to read this file

Each witness in the table below operates the open-source CLI from
`@sovereign-matrix/verifiable-receipts/witness` (or an equivalent
implementation of the same protocol). They independently observe
the issuer's `/api/transparency/sth` endpoint at the documented
cadence and POST a co-signature back to
`/api/transparency/witness`. The aggregated co-signatures are
publicly readable at
`/api/transparency/witness/observations` (Wave 63 federation
endpoint).

If you discover a fork — two STHs at the same `treeSize` with
different `rootHash` values — the witness operator is obligated to
publish the observation. Email `security@sovereignmatrix.agency`
within 24 hours.

---

## Production witnesses

| Witness ID               | Operator    | Region    | Pubkey URL                            | Cadence | Since     |
| ------------------------ | ----------- | --------- | ------------------------------------- | ------- | --------- |
| `eu-witness-berlin`      | _seed slot_ | EU (DE)   | _publish at `/witness/eu-berlin.pem`_ | 1h      | _pending_ |
| `us-witness-nyc`         | _seed slot_ | US (NY)   | _publish at `/witness/us-nyc.pem`_    | 1h      | _pending_ |
| `apac-witness-singapore` | _seed slot_ | APAC (SG) | _publish at `/witness/apac-sg.pem`_   | 1h      | _pending_ |

Three seed slots are intentionally vacant. Sovereign Matrix will
not occupy any of them — single-operator witnesses defeat the
trust model. Open a PR to this file once your witness has been
running and emitting valid co-signatures continuously for ≥ 7 days.

---

## How to become a witness (10 minutes)

```bash
# 1. Generate a fresh Ed25519 keypair.
openssl genpkey -algorithm ed25519 -out witness-private.pem
openssl pkey -in witness-private.pem -pubout -out witness-public.pem

# 2. Publish the public key somewhere stable + HTTPS-served.
#    Example: GitHub Pages, your own /.well-known, S3 + CloudFront.

# 3. Run the witness CLI from the open-source package.
#    Cadence in seconds; 3600 = 1 hour, the recommended starting point.
npx @sovereign-matrix/verifiable-receipts-witness \
  --url https://sovereignmatrix.agency \
  --key ./witness-private.pem \
  --witness-id "Your Name · City" \
  --interval 3600

# 4. After 7 days of clean operation, open a PR adding your row
#    to the table above. Include uptime evidence.
```

The witness CLI's exit codes match the spec:

- `0` — STH unchanged OR successfully co-signed
- `1` — fork detected (two different rootHashes at same treeSize).
  Operator MUST investigate before resuming.
- `2` — network / config error.

---

## What a witness is committing to

A witness co-signature commits to **the exact canonical bytes of
the STH** the witness observed. The signing predicate is:

> "At ISO-8601 timestamp T, the issuer at URL U served me an STH
> with `(logId, treeSize, rootHash)` exactly equal to the values in
> the canonical JSON I'm signing."

A witness is NOT vouching for the validity of the underlying
receipts — only that the issuer presented this specific tree head
at this specific moment. This is enough to detect equivocation
(an issuer that secretly signs two trees) because two honest
witnesses observing different STHs at the same `treeSize` would
publish contradicting evidence.

---

## Pulling federated observations

Any monitor can pull a witness aggregator's public observation
list via the federation endpoint shipped in Wave 63:

```bash
curl https://sovereignmatrix.agency/api/transparency/witness/observations \
  | jq '.observations[] | {sthHash, cosignatures: [.cosignatures[].witnessId]}'
```

This returns every STH the aggregator has accumulated cosignatures
against, with the full witness-id list per STH. Combined with the
same endpoint on **other** issuers' deployments, a monitor can
cross-check: does every witness agree on every `(treeSize → rootHash)`
they've observed? Any disagreement is the smoke signal for a
compromised log.

---

## Operator governance

- Witnesses MUST be operated by an entity independent of the
  issuer being witnessed. A Sovereign Matrix employee cannot
  operate `eu-witness-berlin`.
- Witnesses MUST publish their pubkey at a URL that resolves
  with HTTPS and CORS open. The exact path is at the operator's
  discretion (suggested: `/.well-known/vaos-witness.pem`).
- Witnesses SHOULD publish a public dashboard or feed of their
  observations — even just an RSS/Atom of their submitted
  co-signatures.
- Witnesses MAY rotate keys. Old pubkeys MUST remain resolvable
  forever (signatures from rotated keys must still verify).

---

## License

CC0 1.0 (public domain). Embed in your procurement materials,
fork into your own ecosystem, replicate the protocol against your
own logs. The math is the contract; the witnesses are the social
layer that compounds the math into a trust network.
