from __future__ import annotations

import csv
from datetime import date
from pathlib import Path
from typing import Any

from .audit import AdRow, Diagnostics

COLUMNS = [
    "run_date",
    "account_id",
    "campaign_id",
    "adset_id",
    "ad_id",
    "flag",
    "angle",
    "frequency",
    "ctr",
    "ctr_decline_pct",
    "spend",
    "conversions",
    "cpa",
    "deployed_ad_id",
    "copy_snippet",
]


def _write_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    new_file = not path.exists()
    with path.open("a", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        if new_file:
            writer.writeheader()
        for row in rows:
            writer.writerow({col: row.get(col, "") for col in COLUMNS})


def load_rows(path: Path) -> list[dict[str, str]]:
    if not Path(path).exists():
        return []
    with Path(path).open(newline="") as fh:
        return list(csv.DictReader(fh))


def record_run(
    path: Path, account_id: str, diag: Diagnostics, manifest: list[dict[str, Any]], today: date | None = None
) -> None:
    today = today or date.today()
    run_date = today.isoformat()
    rows: list[dict[str, Any]] = []

    for ad in diag.fatigued:
        rows.append(
            {
                "run_date": run_date,
                "account_id": account_id,
                "campaign_id": ad.campaign_id,
                "adset_id": ad.adset_id,
                "ad_id": ad.ad_id,
                "flag": "FATIGUED",
                "frequency": f"{ad.frequency:.2f}",
                "ctr": f"{ad.ctr:.2f}",
                "ctr_decline_pct": f"{ad.ctr_decline_pct:.1f}",
                "spend": f"{ad.spend:.2f}",
                "conversions": f"{ad.conversions:.0f}",
                "cpa": f"{ad.cpa:.2f}",
            }
        )
    for s in diag.bleeding:
        rows.append(
            {
                "run_date": run_date,
                "account_id": account_id,
                "campaign_id": s.campaign_id,
                "adset_id": s.adset_id,
                "flag": "BLEEDING",
                "spend": f"{s.spend:.2f}",
                "conversions": f"{s.conversions:.0f}",
            }
        )
    for entry in manifest:
        rows.append(
            {
                "run_date": run_date,
                "account_id": account_id,
                "campaign_id": entry["campaign_id"],
                "adset_id": entry["adset_id"],
                "ad_id": entry["source_ad_id"],
                "flag": "DEPLOYED",
                "angle": entry["angle"],
                "deployed_ad_id": entry["new_paused_ad_id"],
                "copy_snippet": entry["copy_snippet"],
            }
        )

    _write_rows(path, rows)


def angle_cpa_ranking(history: list[dict[str, str]], current_ads: list[AdRow]) -> list[tuple[str, float, int]]:
    """Join deployed-ad->angle history against current measured CPAs. Lowest avg CPA first."""
    angle_by_ad: dict[str, str] = {}
    for row in history:
        deployed = row.get("deployed_ad_id")
        angle = row.get("angle")
        if deployed and angle:
            angle_by_ad[deployed] = angle

    buckets: dict[str, list[float]] = {}
    for ad in current_ads:
        angle = angle_by_ad.get(ad.ad_id)
        if angle and ad.cpa > 0:
            buckets.setdefault(angle, []).append(ad.cpa)

    ranking = [(angle, round(sum(v) / len(v), 2), len(v)) for angle, v in buckets.items()]
    return sorted(ranking, key=lambda x: x[1])


def best_angle_hint(history: list[dict[str, str]], current_ads: list[AdRow]) -> str:
    ranking = angle_cpa_ranking(history, current_ads)
    if not ranking:
        return ""
    angle, cpa, n = ranking[0]
    return f"Angle {angle} has the lowest measured CPA so far (${cpa} across {n} prior ad(s)). Lean into it."
