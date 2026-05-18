"""
Pure-Python verifier for VAOS receipts — Ed25519 (v2) + RFC 9162
transparency-log inclusion proofs. The math is the contract: this
implementation re-derives the canonical projection independently and
confirms signatures with the published Ed25519 public key.

This module is verifier-side only. Issuers mint receipts via the
canonical TypeScript implementation; verifiers re-check them from
any language with the same primitive available.

Public API:
    verify_v2_receipt(receipt, public_key_pem) -> VerifyResult
    verify_inclusion_proof(proof, leaf_hash_hex, root_hash_hex) -> bool
"""

from .verify import (
    VerifyResult,
    verify_v2_receipt,
    verify_guardian_attestation,
)
from .transparency import (
    verify_inclusion_proof,
    leaf_hash,
    inner_hash,
)

__all__ = [
    "VerifyResult",
    "verify_v2_receipt",
    "verify_guardian_attestation",
    "verify_inclusion_proof",
    "leaf_hash",
    "inner_hash",
]

__version__ = "0.1.0"
