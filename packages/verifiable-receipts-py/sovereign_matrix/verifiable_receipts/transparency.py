"""
RFC 9162 transparency-log inclusion-proof verifier (Python port).

Mirror of `verifyInclusionProof()` from the TypeScript package's
transparency.ts. The math is the contract — Python re-derives the
Merkle path by hashing leaf → audit-path → root and compares to the
published Signed Tree Head's rootHash.

Hash domain separation per RFC 9162 §2:
    leaf_hash(data) = SHA-256(0x00 || data)
    inner_hash(left, right) = SHA-256(0x01 || left || right)

All hex inputs are case-insensitive but compared lowercase.
"""

from __future__ import annotations

import hashlib
from typing import Mapping


_LEAF_PREFIX = b"\x00"
_INNER_PREFIX = b"\x01"


def leaf_hash(data: bytes) -> bytes:
    """RFC 9162 leaf-hash: SHA-256(0x00 || data)."""
    h = hashlib.sha256()
    h.update(_LEAF_PREFIX)
    h.update(data)
    return h.digest()


def inner_hash(left: bytes, right: bytes) -> bytes:
    """RFC 9162 inner-hash: SHA-256(0x01 || left || right)."""
    h = hashlib.sha256()
    h.update(_INNER_PREFIX)
    h.update(left)
    h.update(right)
    return h.digest()


def _hex_to_bytes(hex_str: str) -> bytes:
    """Decode hex string (case-insensitive) to bytes. Raises ValueError."""
    if not isinstance(hex_str, str):
        raise ValueError("expected hex string")
    cleaned = hex_str.lower().removeprefix("sha256:").removeprefix("0x")
    return bytes.fromhex(cleaned)


def verify_inclusion_proof(
    proof: Mapping[str, object],
    leaf_hash_hex: str,
    root_hash_hex: str,
) -> bool:
    """Verify an RFC 9162-style inclusion proof.

    Args:
        proof: A dict-like with:
            - ``leafIndex`` (int): 0-based index of the leaf in the tree
            - ``treeSize`` (int): total number of leaves in the tree
            - ``auditPath`` (list[str]): hex-encoded sibling hashes, leaf→root order
        leaf_hash_hex: SHA-256(0x00 || leaf_data) for the leaf you're proving.
        root_hash_hex: The Signed Tree Head's rootHash, hex-encoded.

    Returns:
        True iff hashing leaf_hash with the audit-path siblings in
        the algorithm RFC 9162 §2.1.1 yields exactly root_hash_hex.

    Notes:
        - leafIndex must be in [0, treeSize)
        - treeSize must be > 0
        - The number of audit-path siblings is determined by the path
          from the leaf to the root; mismatches return False rather
          than raising.
    """
    try:
        leaf_index = int(proof.get("leafIndex", -1))
        tree_size = int(proof.get("treeSize", 0))
    except (TypeError, ValueError):
        return False

    audit_path = proof.get("auditPath")
    if not isinstance(audit_path, list):
        return False

    if tree_size <= 0:
        return False
    if leaf_index < 0 or leaf_index >= tree_size:
        return False

    try:
        current = _hex_to_bytes(leaf_hash_hex)
        expected_root = _hex_to_bytes(root_hash_hex)
    except ValueError:
        return False

    index = leaf_index
    size = tree_size

    for sibling_hex in audit_path:
        if not isinstance(sibling_hex, str):
            return False
        try:
            sibling = _hex_to_bytes(sibling_hex)
        except ValueError:
            return False

        # Right-edge handling: if the leaf has no right neighbor at
        # this level (i.e. index is the last leaf and even), it carries
        # over without combining. RFC 9162 §2.1.1.
        if size <= 1:
            # We have audit-path entries left but the tree degenerated —
            # the proof claims more depth than the tree supports.
            return False

        if index % 2 == 1:
            # We're the right child; sibling is the left child.
            current = inner_hash(sibling, current)
        else:
            # We're the left child; sibling is the right child.
            # If index+1 == size (odd-leaf right edge), the sibling
            # would be us — but the well-formed proof wouldn't include
            # such a step. If it does, treat as malformed.
            if index + 1 >= size:
                return False
            current = inner_hash(current, sibling)

        index //= 2
        size = (size + 1) // 2

    # After consuming the full audit path, we should be at the root.
    if size != 1:
        return False
    return current == expected_root
