"""
Cross-language conformance harness — Python verifier side.

Reads the JSON fixtures from ../conformance/fixtures/ and asserts the
Python reference implementation agrees with the TypeScript reference
implementation on every fixture's expected outcome.

Run from the repo root:
    cd packages/verifiable-receipts-py
    PYTHONPATH=. python3 -m pytest ../verifiable-receipts/conformance/conformance.py -v
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import sys
from pathlib import Path

import pytest

# Ensure the Python SDK is on sys.path. This file lives at
# packages/verifiable-receipts/conformance/conformance.py; the SDK
# lives at packages/verifiable-receipts-py/sovereign_matrix/
HERE = Path(__file__).resolve().parent
SDK_DIR = HERE.parent.parent / "verifiable-receipts-py"
if str(SDK_DIR) not in sys.path:
    sys.path.insert(0, str(SDK_DIR))

from sovereign_matrix.verifiable_receipts import (  # noqa: E402
    verify_v2_receipt,
    verify_inclusion_proof,
)

FIXTURES_DIR = HERE / "fixtures"
PUBLIC_KEY_PEM = (HERE / "public-key.pem").read_bytes()


def _load_fixtures() -> list[dict]:
    out = []
    for path in sorted(FIXTURES_DIR.glob("*.json")):
        with path.open(encoding="utf-8") as fh:
            fixture = json.load(fh)
        fixture["__filename"] = path.name
        out.append(fixture)
    return out


@pytest.fixture(scope="module")
def fixtures() -> list[dict]:
    return _load_fixtures()


def test_loads_the_documented_corpus(fixtures: list[dict]) -> None:
    """Exact, not ">= 10".

    The README states "11 fixtures x 3 verifiers = 33 checks, 5 accept /
    6 reject". A floor assertion lets that arithmetic drift silently the
    moment someone adds a fixture; an exact one makes the documented
    number fail when it goes stale.
    """
    assert len(fixtures) == 11
    accept = sum(1 for f in fixtures if f["expected"]["ok"])
    assert accept == 5
    assert len(fixtures) - accept == 6


@pytest.mark.parametrize("fixture", _load_fixtures(), ids=lambda f: f["__filename"])
def test_fixture_outcome_matches(fixture: dict) -> None:
    expected_ok = fixture["expected"]["ok"]

    if "receipt" in fixture:
        receipt = fixture["receipt"]
        result = verify_v2_receipt(receipt, PUBLIC_KEY_PEM)
        assert result.ok is expected_ok, (
            f"{fixture['__filename']}: expected ok={expected_ok}, "
            f"got ok={result.ok} reason={result.reason}"
        )
        reason_contains = fixture["expected"].get("reasonContains")
        if reason_contains and not result.ok:
            assert re.search(reason_contains, result.reason or "", re.IGNORECASE), (
                f"{fixture['__filename']}: expected reason to match "
                f"{reason_contains!r}, got {result.reason!r}"
            )
    elif "leafHashHex" in fixture:
        proof = {
            "leafIndex": fixture["leafIndex"],
            "treeSize": fixture["treeSize"],
            "auditPath": fixture["auditPath"],
        }
        actual = verify_inclusion_proof(
            proof,
            fixture["leafHashHex"],
            fixture["rootHashHex"],
        )
        assert actual is expected_ok, (
            f"{fixture['__filename']}: expected ok={expected_ok}, got ok={actual}"
        )
    else:
        pytest.fail(
            f"{fixture['__filename']}: unknown fixture shape — "
            "must contain 'receipt' or 'leafHashHex'"
        )
