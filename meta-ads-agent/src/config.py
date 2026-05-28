from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]

try:
    from dotenv import load_dotenv

    load_dotenv(PROJECT_ROOT / ".env")
except Exception:
    pass


@dataclass
class AgentConfig:
    raw: dict[str, Any]
    base_dir: Path = PROJECT_ROOT

    @classmethod
    def load(cls, config_path: str | Path | None = None) -> "AgentConfig":
        if config_path:
            path = Path(config_path)
            if not path.is_absolute():
                path = PROJECT_ROOT / path
        else:
            path = PROJECT_ROOT / "config" / "agent_config.json"
        # Fall back to the checked-in example so a fresh clone runs in dry-run immediately.
        if not path.exists():
            example = PROJECT_ROOT / "config" / "agent_config.example.json"
            if not example.exists():
                raise FileNotFoundError(f"No config at {path} and no example fallback.")
            path = example
        return cls(raw=json.loads(path.read_text()), base_dir=PROJECT_ROOT)

    def resolve(self, rel: str) -> Path:
        p = Path(rel)
        return p if p.is_absolute() else self.base_dir / p

    @property
    def ad_account_id(self) -> str:
        return self.raw["account"]["ad_account_id"]

    @property
    def page_id(self) -> str:
        return self.raw["account"]["page_id"]

    @property
    def persona(self) -> str:
        return self.raw["persona"]

    @property
    def value_proposition(self) -> str:
        return self.raw["value_proposition"]

    @property
    def tone(self) -> str:
        return self.raw.get("tone", "")

    @property
    def target_cpa(self) -> float:
        return float(self.raw["economics"]["target_cpa"])

    @property
    def diagnostics(self) -> dict[str, Any]:
        return self.raw.get("diagnostics", {})

    @property
    def creative(self) -> dict[str, Any]:
        return self.raw.get("creative", {})

    @property
    def banned_phrases(self) -> list[str]:
        return self.raw.get("anti_slop_banned_phrases", [])

    @property
    def mcp(self) -> dict[str, Any]:
        return self.raw.get("mcp", {})

    @property
    def paths(self) -> dict[str, str]:
        return self.raw.get("paths", {})

    # --- secrets (environment only; never stored in the JSON config) ---
    @property
    def pipeboard_token(self) -> str | None:
        return os.getenv("PIPEBOARD_TOKEN") or None

    @property
    def meta_access_token(self) -> str | None:
        return os.getenv("META_ACCESS_TOKEN") or None

    @property
    def anthropic_key(self) -> str | None:
        return os.getenv("ANTHROPIC_API_KEY") or None

    @property
    def model(self) -> str:
        return os.getenv("META_AGENT_MODEL") or "claude-sonnet-4-6"

    @property
    def has_live_credentials(self) -> bool:
        return bool(self.pipeboard_token or self.meta_access_token)

    @property
    def is_configured(self) -> bool:
        """False while the account placeholders still hold their REPLACE_ME defaults."""
        return "REPLACE_ME" not in str(self.ad_account_id)
