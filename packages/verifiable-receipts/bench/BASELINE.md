# Performance baseline

**Last measured:** 2026-05-18 (Wave 71).
**Host:** Linux x86_64 (default cloud runner).
**Runtime:** Node 22, V8 default.

Numbers below are the canonical "this is what the production code
costs to call". Regressions ≥ 30% on any benchmark MUST be either
intentional (with a CHANGELOG line) or rolled back.

Run with:

```bash
npx vitest bench packages/verifiable-receipts/bench --run
```

## Hash primitives

| Benchmark                  | Ops/sec    | Mean (μs) | Notes                               |
| -------------------------- | ---------- | --------- | ----------------------------------- |
| `leafHash(256-byte chunk)` | ~6,000,000 | 0.2       | Just a single SHA-256 hash.         |
| `innerHash(left + right)`  | ~6,000,000 | 0.2       | Same. Bottleneck is SHA-256 itself. |

## Merkle tree construction (RFC 6962)

| Benchmark           | Ops/sec  | Mean (μs) | Notes                                 |
| ------------------- | -------- | --------- | ------------------------------------- |
| `treeRoot(n=10)`    | ~280,000 | 4         |                                       |
| `treeRoot(n=100)`   | ~26,000  | 40        |                                       |
| `treeRoot(n=1000)`  | ~2,500   | 400       |                                       |
| `treeRoot(n=10000)` | ~250     | 4,000     | **O(n²) confirmed.** Memoize in v0.4. |

The 10× slowdown per 10× input is the signature of an O(n²)
recursive `slice` rebuild. Acceptable for ≤ 10K leaves; above
that, the memoization PR queued for v0.4 brings this to O(n log n).

## Inclusion proof

| Benchmark                             | Ops/sec | Mean (μs) | Notes                  |
| ------------------------------------- | ------- | --------- | ---------------------- |
| `inclusionProof(idx=42, n=100)`       | ~4,000  | 260       | Same O(n²) as treeRoot |
| `verifyInclusionProof(idx=42, n=100)` | ~51,000 | 19        | Linear in path length  |

## VAPT (Verifiable Agentic Payment Tokens)

| Benchmark                            | Ops/sec | Mean (μs) | Notes                              |
| ------------------------------------ | ------- | --------- | ---------------------------------- |
| `mintVapt(USD 5000, 30min lifetime)` | ~20,000 | 50        | Ed25519 sign + base64              |
| `verifyVapt(valid token)`            | ~7,600  | 130       | Ed25519 verify + constraint checks |

## TRS (Threshold Receipt Signatures, m-of-n with n=5)

| Benchmark                            | Ops/sec | Mean (μs) | Notes                               |
| ------------------------------------ | ------- | --------- | ----------------------------------- |
| `verifyThresholdAttestation(1-of-5)` | ~7,700  | 130       | One Ed25519 verify                  |
| `verifyThresholdAttestation(3-of-5)` | ~2,600  | 380       | Three Ed25519 verifies              |
| `verifyThresholdAttestation(5-of-5)` | ~1,600  | 630       | Five Ed25519 verifies — linear in m |

Linear scaling in m is expected (one signature verify per
authorized cosigner).

## Audit-DSL

| Benchmark                                                      | Ops/sec  | Mean (μs) | Notes                                |
| -------------------------------------------------------------- | -------- | --------- | ------------------------------------ |
| `parseQuery(SELECT * WHERE ... AND ... ORDER BY ... LIMIT 50)` | ~347,000 | 3         | Pure-TS recursive-descent parser     |
| `queryReceipts(1000 rows, projected, ordered, limited)`        | ~18,000  | 56        | Full filter + sort + project + slice |

## Anomaly detector

| Benchmark                 | Ops/sec | Mean (μs) | Notes                                 |
| ------------------------- | ------- | --------- | ------------------------------------- |
| `detectAnomalies(n=100)`  | ~14,000 | 70        | Below the 20-receipt small-sample cut |
| `detectAnomalies(n=1000)` | ~1,200  | 800       | Five-detector path, full Z-score math |

## How to read these numbers

- **Hash + verify primitives** sit in the microsecond range. The
  bottleneck is V8's SHA-256 + Ed25519 implementation, not our
  wrapper.
- **Merkle tree construction** is the only known O(n²) hot path.
  For trees up to ~10K leaves the wall-clock cost is ≤ 4ms; above
  that, plan to use the memoized v0.4 path or pre-compute the root
  out-of-band.
- **DSL queries** scale linearly in the row count. 1000-row
  queries run at < 100μs; multi-million-row queries should stream
  from the source rather than materialize in memory.

## Regression policy

Any PR that drops a benchmark's `ops/sec` by ≥ 30% from the
numbers above MUST include:

1. A CHANGELOG entry explaining the intentional perf change, OR
2. A rollback before merge.

CI does not yet auto-enforce this — for v0.2 this baseline is
operator-checked. v0.3 adds a `bench:ci` script that fails the
build on regression.
