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

    # Single-leaf tree: root equals leaf, no audit path.
    if tree_size == 1:
        return len(audit_path) == 0 and leaf_hash_hex == root_hash_hex

    # RFC 9162 / RFC 6962 §2.1.1 inner/border decomposition. The
    # simpler index%2 walk fails on right-edge carry-up cases (e.g.
    # idx=6 in a 7-leaf tree); the bit-decomposition handles every
    # tree shape correctly. Matches the TypeScript canonical verifier.
    try:
        current = _hex_to_bytes(leaf_hash_hex)
        expected_root = _hex_to_bytes(root_hash_hex)
    except ValueError:
        return False

    inner = (leaf_index ^ (tree_size - 1)).bit_length()
    border = bin(leaf_index >> inner).count("1")
    if len(audit_path) != inner + border:
        return False

    # Pre-decode every audit-path entry; reject any malformed entry.
    siblings: list[bytes] = []
    for sibling_hex in audit_path:
        if not isinstance(sibling_hex, str):
            return False
        try:
            siblings.append(_hex_to_bytes(sibling_hex))
        except ValueError:
            return False

    # Inner segment: walk the bits of leaf_index. Bit=0 → sibling on
    # the right; bit=1 → sibling on the left.
    for i in range(inner):
        sib = siblings[i]
        if (leaf_index >> i) & 1 == 0:
            current = inner_hash(current, sib)
        else:
            current = inner_hash(sib, current)

    # Border segment: every remaining sibling combines on the LEFT
    # (these are left-children we skipped while walking up the right
    # edge).
    for i in range(border):
        current = inner_hash(siblings[inner + i], current)

    return current == expected_root
