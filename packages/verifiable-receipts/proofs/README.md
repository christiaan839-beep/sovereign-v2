# Mathematical proofs corpus

**License:** Apache 2.0 (free to republish, re-derive, or formalize in Lean / Coq / Isabelle).

This directory contains plain-text formal-ish proofs of the
security properties our reference implementation claims. They are
**verifier-grade**: an auditor, regulator, or external cryptographer
can read them and convince themselves the math is sound without
running our code.

Each proof follows the structure:

1. **Claim** — what property we're proving
2. **Notation** — symbols + types
3. **Assumptions** — what we're taking as given (e.g. SHA-256 collision
   resistance, Ed25519 EUF-CMA security)
4. **Proof** — argument by cases / induction / contradiction
5. **What this rules out** — concrete attack scenarios this proof
   forecloses

These are intentionally **not Lean / Coq files**. The receipt-layer
audience is regulators + procurement teams, not formal-methods
researchers. The arguments are tight enough that a domain-competent
reader can mechanically check each step, but informal enough to
read in 5–10 minutes per proof.

## Proofs in this corpus

| File                                                                           | Property proved                                                                                    |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [`trs-soundness.md`](./trs-soundness.md)                                       | TRS threshold check is sound — verification returning OK implies ≥ m honest cosigners signed.      |
| [`rfc9162-inclusion-completeness.md`](./rfc9162-inclusion-completeness.md)     | RFC 9162 inclusion proof is complete — every honest leaf is provable.                              |
| [`vaos-v2-non-malleability.md`](./vaos-v2-non-malleability.md)                 | VAOS v2 wire format is non-malleable — no signature-respelling produces a different valid receipt. |
| [`vapt-replay-resistance.md`](./vapt-replay-resistance.md)                     | VAPT lifetime + singleUse constraints bound replay risk to a 1-hour window.                        |
| [`stream-attestation-non-injection.md`](./stream-attestation-non-injection.md) | VAOS-RSA Merkle root commitment makes mid-stream injection detectable.                             |

## Why a corpus, not a single doc

Each property is independent. A reviewer auditing only the TRS spec
can read `trs-soundness.md` without context from any other proof.
This matches how procurement scrutiny actually works — different
questions go to different specialists.

## License

Apache 2.0 © Sovereign Matrix. Republish, formalize, fork.

If you find a flaw in any proof, please email
`security@sovereignmatrix.agency` before public disclosure. We treat
proof flaws as security issues with the same SLAs documented in
`SECURITY.md`.
