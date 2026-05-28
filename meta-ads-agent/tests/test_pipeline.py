from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.anti_slop import find_slop, is_clean  # noqa: E402
from src.audit import build_diagnostics  # noqa: E402
from src.config import AgentConfig  # noqa: E402
from src.constraints import Constraints  # noqa: E402
from src.creative import synthesize_payload  # noqa: E402
from src.deploy import deploy_payload  # noqa: E402
from src.mcp_client import DryRunClient, MetaAdsClientError  # noqa: E402

TODAY = date(2026, 5, 28)


def _config() -> AgentConfig:
    return AgentConfig.load(ROOT / "config" / "agent_config.example.json")


def _constraints() -> Constraints:
    return Constraints.load(ROOT / "meta_api_constraints.json")


def _diag():
    return build_diagnostics(DryRunClient(TODAY), _config(), TODAY)


def test_fatigue_node_flags_only_ad1():
    assert {a.ad_id for a in _diag().fatigued} == {"AD1"}


def test_bleed_node_flags_only_a2():
    assert {s.adset_id for s in _diag().bleeding} == {"A2"}


def test_fragmentation_node_flags_only_23853():
    assert {c.campaign_id for c in _diag().fragmented} == {"23853"}


def test_anti_slop_detection_and_word_boundary():
    assert find_slop("We will supercharge and revolutionize", ["supercharge", "revolutionize"])
    assert is_clean("Concrete, measured outcome.", ["supercharge"])
    # word-boundary: "delve" must not match inside "delver"
    assert not find_slop("a skilled delver", ["delve"])


def test_constraints_reject_active_status():
    item = {
        "target_campaign_id": "1",
        "target_adset_id": "2",
        "source_ad_id": "3",
        "angle": "A",
        "primary_text": "x",
        "headline": "y",
        "status": "ACTIVE",
    }
    assert any("PAUSED" in e for e in _constraints().validate_payload_item(item))


def test_full_dry_pipeline_is_paused_only():
    config, constraints = _config(), _constraints()
    diag = build_diagnostics(DryRunClient(TODAY), config, TODAY)
    payload_path, items = synthesize_payload(diag, config, constraints, "")
    assert items, "expected variations for the fatigued ad"
    assert all(i["status"] == "PAUSED" for i in items)

    client = DryRunClient(TODAY)
    manifest = deploy_payload(client, config, constraints, payload_path)
    assert manifest and all(m["status"] == "PAUSED" for m in manifest)
    created = [w for w in client.writes if w["op"] == "create_ad"]
    assert created and all(w["status"] == "PAUSED" for w in created)


def test_dry_client_refuses_active_ad():
    client = DryRunClient(TODAY)
    try:
        client.create_ad("A1", "C1", "name", "ACTIVE")
    except MetaAdsClientError:
        return
    raise AssertionError("expected the client to refuse ACTIVE status")


if __name__ == "__main__":
    import subprocess

    raise SystemExit(subprocess.call([sys.executable, "-m", "pytest", "-q", str(Path(__file__))]))
