"""
Python verifier tests — symmetric with the TypeScript suite.

These tests use Python-side keys (Ed25519 generated in cryptography)
to prove the verifier correctly accepts/rejects without needing
cross-language fixtures. The cross-language interop test lives
separately and exercises the wire format end-to-end.
"""

from __future__ import annotations

import base64
import hashlib

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
)

from sovereign_matrix.verifiable_receipts import (
    VerifyResult,
    verify_v2_receipt,
    verify_guardian_attestation,
    verify_inclusion_proof,
    leaf_hash,
    inner_hash,
)


def _make_keypair() -> tuple[Ed25519PrivateKey, bytes]:
    """Returns (private_key, public_key_pem)."""
    priv = Ed25519PrivateKey.generate()
    pub_pem = priv.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return priv, pub_pem


def _sign_v2(priv: Ed25519PrivateKey, canonical: str) -> str:
    """Mint a v2= wire-format signature over the canonical UTF-8 bytes."""
    sig = priv.sign(canonical.encode("utf-8"))
    return "v2=" + base64.b64encode(sig).decode("ascii")


def _content_hash(canonical: str) -> str:
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class TestVerifyV2Receipt:
    def test_verifies_a_well_formed_receipt(self) -> None:
        priv, pub_pem = _make_keypair()
        canonical = '{"verdictId":"v_test","overall":"pass"}'
        receipt = {
            "canonical": canonical,
            "signature": _sign_v2(priv, canonical),
            "contentHash": _content_hash(canonical),
        }
        result = verify_v2_receipt(receipt, pub_pem)
        assert result.ok is True
        assert result.reason is None

    def test_rejects_when_signature_is_under_wrong_key(self) -> None:
        priv_a, _ = _make_keypair()
        _, pub_b_pem = _make_keypair()
        canonical = '{"verdictId":"v_test"}'
        receipt = {
            "canonical": canonical,
            "signature": _sign_v2(priv_a, canonical),
        }
        result = verify_v2_receipt(receipt, pub_b_pem)
        assert result.ok is False
        assert "signature" in (result.reason or "")

    def test_rejects_when_canonical_was_tampered(self) -> None:
        priv, pub_pem = _make_keypair()
        canonical = '{"verdictId":"v_test"}'
        sig = _sign_v2(priv, canonical)
        # Now tamper.
        receipt = {
            "canonical": '{"verdictId":"v_tampered"}',
            "signature": sig,
        }
        result = verify_v2_receipt(receipt, pub_pem)
        assert result.ok is False

    def test_rejects_when_content_hash_does_not_match(self) -> None:
        priv, pub_pem = _make_keypair()
        canonical = '{"verdictId":"v_test"}'
        receipt = {
            "canonical": canonical,
            "signature": _sign_v2(priv, canonical),
            "contentHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        }
        result = verify_v2_receipt(receipt, pub_pem)
        assert result.ok is False
        assert "contentHash" in (result.reason or "")

    def test_rejects_non_v2_signature_prefix(self) -> None:
        _, pub_pem = _make_keypair()
        receipt = {
            "canonical": '{"x":1}',
            "signature": "v1=hmacstuff",
        }
        result = verify_v2_receipt(receipt, pub_pem)
        assert result.ok is False

    def test_rejects_malformed_base64(self) -> None:
        _, pub_pem = _make_keypair()
        receipt = {
            "canonical": '{"x":1}',
            "signature": "v2=!!!notbase64!!!",
        }
        result = verify_v2_receipt(receipt, pub_pem)
        assert result.ok is False

    def test_rejects_missing_canonical_or_signature(self) -> None:
        _, pub_pem = _make_keypair()
        assert verify_v2_receipt({"signature": "v2=x"}, pub_pem).ok is False
        assert verify_v2_receipt({"canonical": "x"}, pub_pem).ok is False
        assert verify_v2_receipt({}, pub_pem).ok is False

    def test_rejects_non_mapping_receipt(self) -> None:
        _, pub_pem = _make_keypair()
        assert verify_v2_receipt("not a dict", pub_pem).ok is False  # type: ignore[arg-type]
        assert verify_v2_receipt(None, pub_pem).ok is False  # type: ignore[arg-type]

    def test_guardian_attestation_is_an_alias(self) -> None:
        priv, pub_pem = _make_keypair()
        canonical = '{"verdictId":"g_test","overall":"pass"}'
        att = {
            "canonical": canonical,
            "signature": _sign_v2(priv, canonical),
            "verdictId": "g_test",
            "overall": "pass",
            "rules": [],
        }
        assert verify_guardian_attestation(att, pub_pem).ok is True


class TestRfc9162InclusionProof:
    def test_single_leaf_tree(self) -> None:
        leaf = leaf_hash(b"hello")
        proof = {
            "leafIndex": 0,
            "treeSize": 1,
            "auditPath": [],
        }
        # Single-leaf tree: root == leaf hash.
        assert (
            verify_inclusion_proof(proof, leaf.hex(), leaf.hex()) is True
        )

    def test_two_leaf_tree_left(self) -> None:
        a = leaf_hash(b"a")
        b = leaf_hash(b"b")
        root = inner_hash(a, b)
        proof = {
            "leafIndex": 0,
            "treeSize": 2,
            "auditPath": [b.hex()],
        }
        assert verify_inclusion_proof(proof, a.hex(), root.hex()) is True

    def test_two_leaf_tree_right(self) -> None:
        a = leaf_hash(b"a")
        b = leaf_hash(b"b")
        root = inner_hash(a, b)
        proof = {
            "leafIndex": 1,
            "treeSize": 2,
            "auditPath": [a.hex()],
        }
        assert verify_inclusion_proof(proof, b.hex(), root.hex()) is True

    def test_four_leaf_tree(self) -> None:
        # Tree:
        #         root
        #        /    \
        #       AB    CD
        #      / \   / \
        #     a   b c   d
        a = leaf_hash(b"a")
        b = leaf_hash(b"b")
        c = leaf_hash(b"c")
        d = leaf_hash(b"d")
        ab = inner_hash(a, b)
        cd = inner_hash(c, d)
        root = inner_hash(ab, cd)

        proof_for_c = {
            "leafIndex": 2,
            "treeSize": 4,
            "auditPath": [d.hex(), ab.hex()],
        }
        assert (
            verify_inclusion_proof(proof_for_c, c.hex(), root.hex()) is True
        )

    def test_rejects_wrong_root(self) -> None:
        a = leaf_hash(b"a")
        b = leaf_hash(b"b")
        root = inner_hash(a, b)
        proof = {
            "leafIndex": 0,
            "treeSize": 2,
            "auditPath": [b.hex()],
        }
        # Tamper with root.
        wrong_root = inner_hash(b, a)  # swapped order
        assert (
            verify_inclusion_proof(proof, a.hex(), wrong_root.hex())
            is False
        )

    def test_rejects_wrong_leaf_index(self) -> None:
        a = leaf_hash(b"a")
        b = leaf_hash(b"b")
        root = inner_hash(a, b)
        # Proof claims index 1 (right) but supplies leaf hash of a (left).
        proof = {
            "leafIndex": 1,
            "treeSize": 2,
            "auditPath": [a.hex()],
        }
        # Will compute inner_hash(a, a) which != root.
        assert (
            verify_inclusion_proof(proof, a.hex(), root.hex()) is False
        )

    def test_rejects_out_of_range_leaf_index(self) -> None:
        a = leaf_hash(b"a")
        proof = {
            "leafIndex": 5,
            "treeSize": 2,
            "auditPath": [],
        }
        assert (
            verify_inclusion_proof(proof, a.hex(), a.hex()) is False
        )

    def test_rejects_zero_tree_size(self) -> None:
        a = leaf_hash(b"a")
        proof = {"leafIndex": 0, "treeSize": 0, "auditPath": []}
        assert verify_inclusion_proof(proof, a.hex(), a.hex()) is False

    def test_rejects_malformed_audit_path_entry(self) -> None:
        a = leaf_hash(b"a")
        proof = {
            "leafIndex": 0,
            "treeSize": 2,
            "auditPath": ["not-hex"],
        }
        assert (
            verify_inclusion_proof(proof, a.hex(), a.hex()) is False
        )

    def test_rejects_malformed_proof_fields(self) -> None:
        assert (
            verify_inclusion_proof(
                {"leafIndex": "x", "treeSize": 1, "auditPath": []},
                "00" * 32,
                "00" * 32,
            )
            is False
        )
        assert (
            verify_inclusion_proof(
                {"leafIndex": 0, "treeSize": 1, "auditPath": "string"},
                "00" * 32,
                "00" * 32,
            )
            is False
        )

    def test_hash_helpers_use_rfc9162_domain_separators(self) -> None:
        # RFC 9162 §2: leaf prefix is 0x00, inner prefix is 0x01.
        # Re-derive the expected SHA-256s by hand for empty inputs.
        expected_leaf = hashlib.sha256(b"\x00" + b"hello").digest()
        assert leaf_hash(b"hello") == expected_leaf

        a = leaf_hash(b"a")
        b = leaf_hash(b"b")
        expected_inner = hashlib.sha256(b"\x01" + a + b).digest()
        assert inner_hash(a, b) == expected_inner


class TestVerifyResultDataclass:
    def test_ok_default_no_reason(self) -> None:
        r = VerifyResult(True)
        assert r.ok is True
        assert r.reason is None

    def test_frozen_dataclass(self) -> None:
        r = VerifyResult(False, "reason here")
        with pytest.raises(AttributeError):
            r.ok = True  # type: ignore[misc]
