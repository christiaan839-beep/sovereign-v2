"""
Verifier for VAOS 2.0 receipts (Ed25519, RFC 8032).

Mirror of `verifyDualSig()` from the TypeScript package's pq-sign.ts
but verifier-side only and v2-only. v3 (Ed25519 + ML-DSA-65) requires a
post-quantum dependency; that lands in v0.2 once a pure-Python ML-DSA
backend is standardized.

The contract:
  - A v2 wire-format signature is exactly "v2=<base64>"
  - The signed bytes are the UTF-8 encoding of the canonical JSON
    projection of the receipt (the `canonical` field, byte-for-byte)
  - Verification is `Ed25519.verify(pubkey, canonical_bytes, sig_bytes)`

If the receipt has both `canonical` and `contentHash`, we ALSO check
that sha256(canonical) == contentHash. This catches receipts where
the canonical string was tampered with after the hash was computed.
"""

from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass
from typing import Any, Mapping

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.serialization import (
    load_pem_public_key,
)
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PublicKey,
)


@dataclass(frozen=True)
class VerifyResult:
    """Outcome of a receipt verification attempt.

    Attributes:
        ok: True if the signature verifies AND (if present) contentHash matches canonical.
        reason: When ok is False, a short human-readable reason string.
    """

    ok: bool
    reason: str | None = None


def _decode_v2_signature(signature: str) -> bytes:
    """Strip the 'v2=' prefix and base64-decode. Raises ValueError on malformed input."""
    if not isinstance(signature, str):
        raise ValueError("signature must be a string")
    if not signature.startswith("v2="):
        raise ValueError("signature is not v2 (expected 'v2=<base64>')")
    raw = signature[3:]
    try:
        return base64.b64decode(raw, validate=True)
    except (ValueError, base64.binascii.Error) as exc:  # type: ignore[attr-defined]
        raise ValueError(f"signature base64 invalid: {exc}") from exc


def _load_ed25519_public_key(pem: bytes) -> Ed25519PublicKey:
    """Load an Ed25519 public key from PEM bytes. Raises ValueError on mismatch."""
    key = load_pem_public_key(pem)
    if not isinstance(key, Ed25519PublicKey):
        raise ValueError(
            f"expected Ed25519 public key, got {type(key).__name__}",
        )
    return key


def verify_v2_receipt(
    receipt: Mapping[str, Any],
    public_key_pem: bytes,
) -> VerifyResult:
    """Verify a VAOS 2.0 receipt.

    Args:
        receipt: A dict-like with at minimum ``canonical`` (the bytes
            that were signed) and ``signature`` ("v2=<base64>"). If
            ``contentHash`` is present, we additionally verify
            sha256(canonical) == contentHash.
        public_key_pem: The Ed25519 public key as PEM bytes (the same
            file a TypeScript verifier would load).

    Returns:
        VerifyResult(ok=True) on success; VerifyResult(ok=False, reason=...)
        on any failure. Never raises for routine verification failures.
    """
    if not isinstance(receipt, Mapping):
        return VerifyResult(False, "receipt must be a mapping")

    canonical = receipt.get("canonical")
    signature = receipt.get("signature")
    if not isinstance(canonical, str) or not canonical:
        return VerifyResult(False, "missing canonical projection")
    if not isinstance(signature, str) or not signature:
        return VerifyResult(False, "missing signature")

    try:
        sig_bytes = _decode_v2_signature(signature)
    except ValueError as exc:
        return VerifyResult(False, str(exc))

    try:
        pub = _load_ed25519_public_key(public_key_pem)
    except ValueError as exc:
        return VerifyResult(False, str(exc))

    canonical_bytes = canonical.encode("utf-8")

    # Cross-check contentHash if present. This catches a tampered
    # canonical string with a still-valid hash (would have to also
    # be re-signed by the issuer to pass the signature check, which
    # is the protection).
    content_hash = receipt.get("contentHash")
    if isinstance(content_hash, str) and content_hash:
        actual = hashlib.sha256(canonical_bytes).hexdigest()
        expected = content_hash.removeprefix("sha256:")
        if actual != expected:
            return VerifyResult(
                False, "contentHash mismatch with canonical bytes"
            )

    try:
        pub.verify(sig_bytes, canonical_bytes)
    except InvalidSignature:
        return VerifyResult(False, "signature does not verify under the supplied public key")

    return VerifyResult(True)


def verify_guardian_attestation(
    attestation: Mapping[str, Any],
    public_key_pem: bytes,
) -> VerifyResult:
    """Verify a signed Guardian attestation envelope.

    Same wire format as a v2 receipt — Guardian attestations ARE v2
    receipts whose canonical projection lists rule verdicts in a
    deterministic order. We just expose a separate name for callers
    that want the Guardian-specific surface.

    Args:
        attestation: The Guardian attestation dict (typically with
            ``verdictId``, ``overall``, ``rules``, ``canonical``,
            ``contentHash``, ``signature``).
        public_key_pem: The Ed25519 public key as PEM bytes.

    Returns:
        VerifyResult — same semantics as verify_v2_receipt().
    """
    return verify_v2_receipt(attestation, public_key_pem)
