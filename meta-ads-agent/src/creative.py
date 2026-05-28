from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .anti_slop import find_slop
from .audit import AdRow, Diagnostics
from .config import AgentConfig
from .constraints import Constraints

ANGLES = {
    "A": "Data-First: lead with a heavy, un-hyped industry statistic.",
    "B": "High Friction: focus entirely on one acute problem the persona experiences daily.",
    "C": "Direct Mechanics: explain exactly how the product solves a mechanical inefficiency.",
}


def _build_prompt(ad: AdRow, config: AgentConfig, history_hint: str, need: int, banned: list[str], feedback: str) -> str:
    angle_text = "\n".join(f"- Angle {k}: {v}" for k, v in ANGLES.items())
    return (
        "You are a precise direct-response copywriter. Write Meta ad copy.\n\n"
        f"PERSONA: {config.persona}\n"
        f"VALUE PROPOSITION: {config.value_proposition}\n"
        f"TONE: {config.tone}\n\n"
        f"The ad '{ad.ad_name}' fatigued (frequency {ad.frequency:.2f}, "
        f"link CTR fell {ad.ctr_decline_pct:.1f}% week-over-week). Combat that fatigue with fresh angles.\n\n"
        f"Produce exactly {need} variations across these frameworks:\n{angle_text}\n\n"
        f"HARD RULE - never use any of these banned phrases: {', '.join(banned)}.\n"
        "Every sentence must state a concrete, unembellished fact or a clear business friction point.\n"
        + (f"\nCORRECTION: {feedback}\n" if feedback else "")
        + (f"\nHISTORICAL SIGNAL: {history_hint}\n" if history_hint else "")
        + "\nReturn ONLY a JSON array of objects with keys: angle (A|B|C), primary_text, headline, description. No prose."
    )


def _parse_json_variations(text: str) -> list[dict[str, Any]]:
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return []
    if isinstance(data, dict):
        data = data.get("variations", [])
    return [v for v in data if isinstance(v, dict) and v.get("primary_text")]


def _llm_variations(ad: AdRow, config: AgentConfig, history_hint: str, n: int, banned: list[str]) -> list[dict[str, Any]]:
    import anthropic

    client = anthropic.Anthropic(api_key=config.anthropic_key)
    retries = int(config.creative.get("max_synthesis_retries", 3))
    accepted: list[dict[str, Any]] = []
    feedback = ""
    for _ in range(retries + 1):
        if len(accepted) >= n:
            break
        prompt = _build_prompt(ad, config, history_hint, n - len(accepted), banned, feedback)
        message = client.messages.create(
            model=config.model,
            max_tokens=1400,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(getattr(b, "text", "") for b in message.content)
        rejected: set[str] = set()
        for variation in _parse_json_variations(text):
            blob = " ".join(str(variation.get(k, "")) for k in ("primary_text", "headline", "description"))
            hits = find_slop(blob, banned)
            if hits:
                rejected.update(hits)
                continue
            variation["source"] = "llm"
            accepted.append(variation)
            if len(accepted) >= n:
                break
        if rejected:
            feedback = "Previous attempt used banned phrases: " + ", ".join(sorted(rejected)) + ". Rewrite without them."
    return accepted[:n]


def _template_variations(config: AgentConfig, n: int) -> list[dict[str, Any]]:
    vp = config.value_proposition
    templates = [
        {
            "angle": "A",
            "primary_text": f"Audit last quarter: how much did each acquired customer actually cost? {vp} measures that figure and reports it on a fixed weekly cadence.",
            "headline": "Cost per outcome, measured",
            "description": "Request the method.",
        },
        {
            "angle": "B",
            "primary_text": f"The work stalls in the same place every week. {vp} removes that step so the queue stops backing up.",
            "headline": "Where the week stalls",
            "description": "See the fix.",
        },
        {
            "angle": "C",
            "primary_text": f"{vp} runs in three defined stages, each with a measurable input and output. No retainer, no guesswork.",
            "headline": "Three stages, measured",
            "description": "Read the mechanics.",
        },
    ]
    for t in templates:
        t["source"] = "template"
    return templates[:n]


def synthesize_for_ad(ad: AdRow, config: AgentConfig, history_hint: str) -> list[dict[str, Any]]:
    n = int(config.creative.get("variations_per_fatigued_ad", 3))
    banned = config.banned_phrases
    variations: list[dict[str, Any]] = []
    if config.anthropic_key:
        variations = _llm_variations(ad, config, history_hint, n, banned)
    # Fall back to (slop-free) templates when there is no LLM key or the model fell short.
    if len(variations) < n:
        for t in _template_variations(config, n - len(variations)):
            if not find_slop(" ".join(str(t.get(k, "")) for k in ("primary_text", "headline", "description")), banned):
                variations.append(t)
    return variations[:n]


def _payload_item(ad: AdRow, variation: dict[str, Any], config: AgentConfig) -> dict[str, Any]:
    return {
        "target_campaign_id": ad.campaign_id,
        "target_campaign_name": ad.campaign_name,
        "target_adset_id": ad.adset_id,
        "target_adset_name": ad.adset_name,
        "source_ad_id": ad.ad_id,
        "source_ad_name": ad.ad_name,
        "angle": variation.get("angle", ""),
        "primary_text": variation.get("primary_text", ""),
        "headline": variation.get("headline", ""),
        "description": variation.get("description", ""),
        "link_url": config.creative.get("link_url", ""),
        "page_id": config.page_id,
        "image_path": variation.get("image_path"),
        "status": "PAUSED",
        "source": variation.get("source", "unknown"),
    }


def synthesize_payload(
    diag: Diagnostics, config: AgentConfig, constraints: Constraints, history_hint: str = ""
) -> tuple[Path, list[dict[str, Any]]]:
    items: list[dict[str, Any]] = []
    for ad in diag.fatigued:
        for variation in synthesize_for_ad(ad, config, history_hint):
            item = _payload_item(ad, variation, config)
            errors = constraints.validate_payload_item(item)
            if errors:
                raise ValueError(f"synthesized item failed validation for {ad.ad_id}: {errors}")
            items.append(item)

    path = config.resolve(config.paths.get("pending_payload_file", "pending_ad_payload.json"))
    path.write_text(json.dumps({"generated_for": diag.window, "items": items}, indent=2))
    return path, items
