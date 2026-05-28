from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any


class Constraints:
    """Wraps meta_api_constraints.json: API deadlines, valid statuses, and payload validation."""

    def __init__(self, data: dict[str, Any]):
        self.data = data

    @classmethod
    def load(cls, path: str | Path) -> "Constraints":
        return cls(json.loads(Path(path).read_text()))

    @property
    def api_version(self) -> str:
        return self.data["api"]["current_version"]

    @property
    def valid_statuses(self) -> list[str]:
        return self.data["status"]["valid_values"]

    @property
    def agent_create_status(self) -> str:
        return self.data["status"]["agent_create_status"]

    def deadline_warnings(self, today: date | None = None, horizon_days: int = 60) -> list[str]:
        today = today or date.today()
        out: list[str] = []
        for dep in self.data.get("api", {}).get("deprecations", []):
            for key in ("stops_working", "stopped_delivering"):
                if key not in dep:
                    continue
                try:
                    when = date.fromisoformat(dep[key])
                except ValueError:
                    continue
                delta = (when - today).days
                if delta < 0:
                    out.append(f"PAST DUE ({dep[key]}, {abs(delta)}d ago): {dep['what']} -> {dep['action']}")
                elif delta <= horizon_days:
                    out.append(f"DUE IN {delta}d ({dep[key]}): {dep['what']} -> {dep['action']}")
        return out

    def validate_payload_item(self, item: dict[str, Any]) -> list[str]:
        """Return a list of validation errors for a single pending-ad payload entry (empty == valid)."""
        errs: list[str] = []
        pv = self.data["payload_validation"]
        for field_name in pv["required_fields"]:
            if field_name not in item or item[field_name] in (None, ""):
                errs.append(f"missing required field: {field_name}")
        if item.get("status") != pv["status_must_equal"]:
            errs.append(f"status must be {pv['status_must_equal']} (got {item.get('status')!r})")
        for field_name in pv["non_empty_text_fields"]:
            if not str(item.get(field_name, "")).strip():
                errs.append(f"text field empty: {field_name}")
        return errs
