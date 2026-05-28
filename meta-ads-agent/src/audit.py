from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from .config import AgentConfig
from .mcp_client import MetaAdsClient

INSIGHT_FIELDS = [
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "spend",
    "impressions",
    "frequency",
    "inline_link_clicks",
    "inline_link_click_ctr",
    "ctr",
    "actions",
]

# Action types counted as a conversion when parsing the raw `actions` array.
CONVERSION_ACTION_TYPES = {
    "purchase",
    "lead",
    "offsite_conversion.fb_pixel_purchase",
    "offsite_conversion.fb_pixel_lead",
    "onsite_conversion.purchase",
    "onsite_conversion.lead_grouped",
}


def _f(row: dict[str, Any], *keys: str, default: float = 0.0) -> float:
    for key in keys:
        if key in row and row[key] not in (None, ""):
            try:
                return float(row[key])
            except (TypeError, ValueError):
                continue
    return default


def _s(row: dict[str, Any], *keys: str, default: str = "") -> str:
    for key in keys:
        if row.get(key):
            return str(row[key])
    return default


def _conversions(row: dict[str, Any]) -> float:
    if "conversions" in row:
        return _f(row, "conversions")
    total = 0.0
    actions = row.get("actions")
    if isinstance(actions, list):
        for action in actions:
            if isinstance(action, dict) and action.get("action_type") in CONVERSION_ACTION_TYPES:
                total += _f(action, "value")
    return total


@dataclass
class AdRow:
    ad_id: str
    ad_name: str
    adset_id: str
    adset_name: str
    campaign_id: str
    campaign_name: str
    spend: float
    impressions: int
    frequency: float
    link_clicks: int
    ctr: float
    ctr_prev: float
    conversions: float
    flags: list[str] = field(default_factory=list)

    @property
    def ctr_decline_pct(self) -> float:
        if self.ctr_prev <= 0:
            return 0.0
        return round((self.ctr_prev - self.ctr) / self.ctr_prev * 100, 1)

    @property
    def cpa(self) -> float:
        return round(self.spend / self.conversions, 2) if self.conversions else 0.0


@dataclass
class AdsetRow:
    adset_id: str
    adset_name: str
    campaign_id: str
    campaign_name: str
    spend: float
    conversions: float
    flags: list[str] = field(default_factory=list)


@dataclass
class CampaignRow:
    campaign_id: str
    campaign_name: str
    adset_count: int
    uses_cbo: bool
    flags: list[str] = field(default_factory=list)


@dataclass
class Diagnostics:
    lookback_days: int
    window: tuple[str, str]
    prior_window: tuple[str, str]
    ads: list[AdRow]
    adsets: list[AdsetRow]
    campaigns: list[CampaignRow]

    @property
    def fatigued(self) -> list[AdRow]:
        return [a for a in self.ads if "FATIGUED" in a.flags]

    @property
    def bleeding(self) -> list[AdsetRow]:
        return [s for s in self.adsets if "BLEEDING" in s.flags]

    @property
    def fragmented(self) -> list[CampaignRow]:
        return [c for c in self.campaigns if "FRAGMENTED" in c.flags]


def _normalize_ad(row: dict[str, Any]) -> AdRow:
    return AdRow(
        ad_id=_s(row, "ad_id", "id"),
        ad_name=_s(row, "ad_name", "name", default="(unnamed)"),
        adset_id=_s(row, "adset_id"),
        adset_name=_s(row, "adset_name"),
        campaign_id=_s(row, "campaign_id"),
        campaign_name=_s(row, "campaign_name"),
        spend=_f(row, "spend"),
        impressions=int(_f(row, "impressions")),
        frequency=_f(row, "frequency"),
        link_clicks=int(_f(row, "inline_link_clicks", "link_clicks")),
        ctr=_f(row, "inline_link_click_ctr", "ctr"),
        ctr_prev=0.0,
        conversions=_conversions(row),
    )


def build_diagnostics(client: MetaAdsClient, config: AgentConfig, today: date | None = None) -> Diagnostics:
    today = today or date.today()
    diag = config.diagnostics
    lookback = int(diag.get("lookback_days", 7))
    freq_threshold = float(diag.get("frequency_fatigue_threshold", 2.3))
    ctr_threshold = float(diag.get("ctr_decline_pct_threshold", 15.0))
    bleed_multiple = float(diag.get("budget_bleed_cpa_multiple", 1.5))
    frag_threshold = int(diag.get("fragmentation_adsets_per_campaign", 4))

    until = today
    since = today - timedelta(days=lookback - 1)
    prior_until = since - timedelta(days=1)
    prior_since = prior_until - timedelta(days=lookback - 1)

    current = client.get_insights("ad", since.isoformat(), until.isoformat(), INSIGHT_FIELDS)
    prior = client.get_insights("ad", prior_since.isoformat(), prior_until.isoformat(), INSIGHT_FIELDS)
    prior_ctr = {_s(r, "ad_id", "id"): _f(r, "inline_link_click_ctr", "ctr") for r in prior}

    ads: list[AdRow] = []
    for raw in current:
        ad = _normalize_ad(raw)
        ad.ctr_prev = prior_ctr.get(ad.ad_id, ad.ctr)
        # Creative Fatigue Node.
        if ad.frequency > freq_threshold and ad.ctr_decline_pct > ctr_threshold:
            ad.flags.append("FATIGUED")
        ads.append(ad)

    adsets: list[AdsetRow] = []
    bleed_floor = bleed_multiple * config.target_cpa
    for raw in client.get_insights("adset", since.isoformat(), until.isoformat(), INSIGHT_FIELDS):
        row = AdsetRow(
            adset_id=_s(raw, "adset_id", "id"),
            adset_name=_s(raw, "adset_name", "name"),
            campaign_id=_s(raw, "campaign_id"),
            campaign_name=_s(raw, "campaign_name"),
            spend=_f(raw, "spend"),
            conversions=_conversions(raw),
        )
        # Budget Bleed Node.
        if row.spend > bleed_floor and row.conversions == 0:
            row.flags.append("BLEEDING")
        adsets.append(row)

    # Fragmentation Node: replaces the legacy >40% audience-overlap rule, which is unreliable
    # now that detailed targeting is suggestion-only and exclusions are gone. We instead flag
    # campaigns split across many ad sets without campaign budget optimization.
    adset_counts: dict[str, int] = {}
    for a in client.get_adsets():
        cid = _s(a, "campaign_id")
        adset_counts[cid] = adset_counts.get(cid, 0) + 1

    campaigns: list[CampaignRow] = []
    for raw in client.get_campaigns():
        cid = _s(raw, "id", "campaign_id")
        uses_cbo = bool(
            raw.get("uses_cbo")
            or raw.get("daily_budget")
            or raw.get("lifetime_budget")
            or raw.get("budget_optimization") == "CAMPAIGN"
        )
        row = CampaignRow(
            campaign_id=cid,
            campaign_name=_s(raw, "name", "campaign_name"),
            adset_count=adset_counts.get(cid, 0),
            uses_cbo=uses_cbo,
        )
        if row.adset_count >= frag_threshold and not row.uses_cbo:
            row.flags.append("FRAGMENTED")
        campaigns.append(row)

    return Diagnostics(
        lookback_days=lookback,
        window=(since.isoformat(), until.isoformat()),
        prior_window=(prior_since.isoformat(), prior_until.isoformat()),
        ads=ads,
        adsets=adsets,
        campaigns=campaigns,
    )
