from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any


class MetaAdsClientError(RuntimeError):
    pass


class MetaAdsClient:
    """Interface the agent depends on. Two implementations below: live (PipeboardMCPClient)
    and offline (DryRunClient)."""

    live: bool = True

    def get_campaigns(self) -> list[dict[str, Any]]:
        raise NotImplementedError

    def get_adsets(self) -> list[dict[str, Any]]:
        raise NotImplementedError

    def get_insights(self, level: str, since: str, until: str, fields: list[str]) -> list[dict[str, Any]]:
        raise NotImplementedError

    def upload_ad_image(self, image_path: str) -> str:
        raise NotImplementedError

    def create_ad_creative(self, spec: dict[str, Any]) -> str:
        raise NotImplementedError

    def create_ad(self, adset_id: str, creative_id: str, name: str, status: str) -> str:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Live client: blind implementation against the documented pipeboard-co/meta-ads-mcp
# tool surface. Param names and response shapes are best-effort from public docs and
# are centralised here so a single edit fixes any mismatch found on the first live run.
# ---------------------------------------------------------------------------
class PipeboardMCPClient(MetaAdsClient):
    live = True

    def __init__(
        self,
        endpoint: str,
        token: str,
        tool_prefix: str = "mcp_meta_ads_",
        account_id: str = "",
        meta_token: str | None = None,
    ):
        self.endpoint = endpoint
        self.token = token
        self.tool_prefix = tool_prefix
        self.account_id = account_id
        self.meta_token = meta_token

    def _url(self) -> str:
        if not self.token:
            return self.endpoint
        sep = "&" if "?" in self.endpoint else "?"
        return f"{self.endpoint}{sep}token={self.token}"

    def _call(self, tool: str, args: dict[str, Any]) -> Any:
        import asyncio

        return asyncio.run(self._acall(tool, args))

    async def _acall(self, tool: str, args: dict[str, Any]) -> Any:
        try:
            from mcp import ClientSession
            from mcp.client.streamable_http import streamablehttp_client
        except ImportError as exc:
            raise MetaAdsClientError("Live runs require the 'mcp' package: pip install mcp") from exc

        name = f"{self.tool_prefix}{tool}"
        call_args = dict(args)
        # pipeboard accepts a per-call Meta token when not using a Pipeboard OAuth session.
        if self.meta_token:
            call_args.setdefault("access_token", self.meta_token)

        async with streamablehttp_client(self._url()) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(name, call_args)
                if getattr(result, "isError", False):
                    raise MetaAdsClientError(f"{name} error: {self._text(result)}")
                return self._parse(result)

    @staticmethod
    def _text(result: Any) -> str:
        parts = []
        for block in getattr(result, "content", []) or []:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "\n".join(parts)

    def _parse(self, result: Any) -> Any:
        structured = getattr(result, "structuredContent", None)
        if structured:
            return structured
        text = self._text(result)
        if not text:
            return {}
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"raw": text}

    @staticmethod
    def _as_list(resp: Any) -> list[dict[str, Any]]:
        if isinstance(resp, list):
            return [r for r in resp if isinstance(r, dict)]
        if isinstance(resp, dict):
            for key in ("data", "campaigns", "adsets", "ads", "results"):
                value = resp.get(key)
                if isinstance(value, list):
                    return [r for r in value if isinstance(r, dict)]
        return []

    @staticmethod
    def _extract_id(resp: Any) -> str:
        if isinstance(resp, str) and resp:
            return resp
        if isinstance(resp, dict):
            for key in ("id", "creative_id", "ad_id"):
                if resp.get(key):
                    return str(resp[key])
        raise MetaAdsClientError(f"no id in response: {resp!r}")

    def get_campaigns(self) -> list[dict[str, Any]]:
        return self._as_list(self._call("get_campaigns", {"account_id": self.account_id}))

    def get_adsets(self) -> list[dict[str, Any]]:
        return self._as_list(self._call("get_adsets", {"account_id": self.account_id}))

    def get_insights(self, level: str, since: str, until: str, fields: list[str]) -> list[dict[str, Any]]:
        return self._as_list(
            self._call(
                "get_insights",
                {
                    "account_id": self.account_id,
                    "level": level,
                    "time_range": {"since": since, "until": until},
                    "fields": fields,
                },
            )
        )

    def upload_ad_image(self, image_path: str) -> str:
        resp = self._call("upload_ad_image", {"account_id": self.account_id, "image_path": image_path})
        if isinstance(resp, dict):
            if resp.get("hash"):
                return str(resp["hash"])
            for value in (resp.get("images") or {}).values():
                if isinstance(value, dict) and value.get("hash"):
                    return str(value["hash"])
        raise MetaAdsClientError(f"could not parse image hash from: {resp!r}")

    def create_ad_creative(self, spec: dict[str, Any]) -> str:
        return self._extract_id(self._call("create_ad_creative", {"account_id": self.account_id, **spec}))

    def create_ad(self, adset_id: str, creative_id: str, name: str, status: str) -> str:
        if status != "PAUSED":
            raise MetaAdsClientError("PLATFORM PROTECTION: agent refuses to create ads with status != PAUSED")
        return self._extract_id(
            self._call(
                "create_ad",
                {
                    "account_id": self.account_id,
                    "adset_id": adset_id,
                    "creative_id": creative_id,
                    "name": name,
                    "status": status,
                },
            )
        )


# ---------------------------------------------------------------------------
# Offline client: deterministic fixtures that trip every diagnostic node so the
# whole pipeline runs end-to-end without network or credentials.
# ---------------------------------------------------------------------------
class DryRunClient(MetaAdsClient):
    live = False

    def __init__(self, today: date | None = None):
        self.today = today or date.today()
        self.writes: list[dict[str, Any]] = []
        self._counter = 0

    def get_campaigns(self) -> list[dict[str, Any]]:
        return [
            {"id": "23851", "name": "Prospecting - Core", "uses_cbo": False},
            {"id": "23852", "name": "Retargeting - Site Visitors", "uses_cbo": True},
            {"id": "23853", "name": "Broad Experiments", "uses_cbo": False},
        ]

    def get_adsets(self) -> list[dict[str, Any]]:
        rows = [
            {"id": "A1", "name": "Core LAL 1%", "campaign_id": "23851"},
            {"id": "A2", "name": "Broad Interest", "campaign_id": "23851"},
            {"id": "A3", "name": "RTG 30d", "campaign_id": "23852"},
        ]
        # Campaign 23853 is fragmented: 5 sibling ad sets, no campaign budget optimization.
        rows += [
            {"id": f"A{n}", "name": f"Experiment {n - 3}", "campaign_id": "23853"} for n in range(4, 9)
        ]
        return rows

    def get_insights(self, level: str, since: str, until: str, fields: list[str]) -> list[dict[str, Any]]:
        is_current = date.fromisoformat(until) >= (self.today - timedelta(days=1))
        if level == "ad":
            return self._ad_insights(is_current)
        if level == "adset":
            return self._adset_insights()
        return []

    def _ad_insights(self, is_current: bool) -> list[dict[str, Any]]:
        # AD1 is the fatigue case: frequency 2.82 and link CTR falling 1.30 -> 0.90 (~31% drop).
        ad1_ctr = 0.90 if is_current else 1.30
        ad2_ctr = 1.10 if is_current else 1.15
        return [
            {
                "ad_id": "AD1",
                "ad_name": "Supply Chain - Data v1",
                "adset_id": "A1",
                "adset_name": "Core LAL 1%",
                "campaign_id": "23851",
                "campaign_name": "Prospecting - Core",
                "spend": 150.0 if is_current else 140.0,
                "impressions": 20000,
                "frequency": 2.82 if is_current else 2.10,
                "inline_link_clicks": 180,
                "inline_link_click_ctr": ad1_ctr,
                "conversions": 2,
            },
            {
                "ad_id": "AD2",
                "ad_name": "Supply Chain - Friction v1",
                "adset_id": "A1",
                "adset_name": "Core LAL 1%",
                "campaign_id": "23851",
                "campaign_name": "Prospecting - Core",
                "spend": 90.0,
                "impressions": 12000,
                "frequency": 1.40,
                "inline_link_clicks": 132,
                "inline_link_click_ctr": ad2_ctr,
                "conversions": 3,
            },
        ]

    def _adset_insights(self) -> list[dict[str, Any]]:
        # A2 is the budget-bleed case: spend well past 1.5x target CPA, zero conversions.
        return [
            {"adset_id": "A1", "adset_name": "Core LAL 1%", "campaign_id": "23851", "campaign_name": "Prospecting - Core", "spend": 240.0, "conversions": 5},
            {"adset_id": "A2", "adset_name": "Broad Interest", "campaign_id": "23851", "campaign_name": "Prospecting - Core", "spend": 120.0, "conversions": 0},
            {"adset_id": "A3", "adset_name": "RTG 30d", "campaign_id": "23852", "campaign_name": "Retargeting - Site Visitors", "spend": 60.0, "conversions": 4},
        ]

    def upload_ad_image(self, image_path: str) -> str:
        self.writes.append({"op": "upload_ad_image", "image_path": image_path})
        return "DRYRUN_IMG_HASH"

    def create_ad_creative(self, spec: dict[str, Any]) -> str:
        self._counter += 1
        self.writes.append({"op": "create_ad_creative", "spec": spec})
        return f"DRYRUN_CREATIVE_{self._counter}"

    def create_ad(self, adset_id: str, creative_id: str, name: str, status: str) -> str:
        if status != "PAUSED":
            raise MetaAdsClientError("PLATFORM PROTECTION: agent refuses to create ads with status != PAUSED")
        self._counter += 1
        self.writes.append(
            {"op": "create_ad", "adset_id": adset_id, "creative_id": creative_id, "name": name, "status": status}
        )
        return f"DRYRUN_AD_{self._counter}"


def build_client(config: Any, force_dry: bool = False) -> MetaAdsClient:
    if force_dry or not config.has_live_credentials:
        return DryRunClient()
    mcp = config.mcp
    return PipeboardMCPClient(
        endpoint=mcp["endpoint"],
        token=config.pipeboard_token or "",
        tool_prefix=mcp.get("tool_prefix", "mcp_meta_ads_"),
        account_id=config.ad_account_id,
        meta_token=config.meta_access_token,
    )
