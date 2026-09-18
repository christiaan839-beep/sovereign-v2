from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import AgentConfig
from .constraints import Constraints
from .mcp_client import MetaAdsClient


def _creative_spec(item: dict[str, Any], image_hash: str | None) -> dict[str, Any]:
    spec: dict[str, Any] = {
        "name": f"[auto] {item['angle']} - {item['source_ad_name']}",
        "page_id": item["page_id"],
        "message": item["primary_text"],
        "headline": item["headline"],
        "description": item.get("description", ""),
        "link_url": item["link_url"],
    }
    if image_hash:
        spec["image_hash"] = image_hash
    return spec


def deploy_payload(
    client: MetaAdsClient, config: AgentConfig, constraints: Constraints, payload_path: Path | None = None
) -> list[dict[str, Any]]:
    path = payload_path or config.resolve(config.paths.get("pending_payload_file", "pending_ad_payload.json"))
    payload = json.loads(Path(path).read_text())
    items = payload.get("items", payload if isinstance(payload, list) else [])

    manifest: list[dict[str, Any]] = []
    for item in items:
        # PLATFORM PROTECTION: force PAUSED and re-validate before any write.
        item["status"] = "PAUSED"
        errors = constraints.validate_payload_item(item)
        if errors:
            raise ValueError(f"refusing to deploy invalid item ({item.get('source_ad_id')}): {errors}")

        image_hash = client.upload_ad_image(item["image_path"]) if item.get("image_path") else None
        creative_id = client.create_ad_creative(_creative_spec(item, image_hash))
        ad_id = client.create_ad(
            adset_id=item["target_adset_id"],
            creative_id=creative_id,
            name=f"[auto] {item['angle']} - {item['source_ad_name']}",
            status="PAUSED",
        )
        manifest.append(
            {
                "campaign_id": item["target_campaign_id"],
                "adset_id": item["target_adset_id"],
                "source_ad_id": item["source_ad_id"],
                "new_paused_ad_id": ad_id,
                "creative_id": creative_id,
                "angle": item["angle"],
                "status": "PAUSED",
                "copy_snippet": item["primary_text"][:90],
            }
        )
    return manifest


def render_manifest(manifest: list[dict[str, Any]], live: bool) -> str:
    mode = "LIVE" if live else "DRY-RUN (no writes performed)"
    lines = [f"# DEPLOYMENT MANIFEST ({mode})", ""]
    if not manifest:
        lines.append("_No creatives deployed (no fatigued ads)._")
        return "\n".join(lines)
    for entry in manifest:
        lines.append(
            f"- Campaign {entry['campaign_id']} / Ad Set {entry['adset_id']} "
            f"-> NEW PAUSED ad {entry['new_paused_ad_id']} (angle {entry['angle']})"
        )
        lines.append(f"    copy: \"{entry['copy_snippet']}...\"")
    return "\n".join(lines)
