#!/usr/bin/env python3
"""Phase-5 orchestrator: audit -> synthesize -> deploy (PAUSED) -> persist, on a cadence.

Run once:   python meta_agent_cron.py --dry-run
Live audit: python meta_agent_cron.py --phase audit
Scheduling: prefer system cron / a real scheduler; --loop is a convenience only.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date

from src.audit import build_diagnostics
from src.brain import best_angle_hint, load_rows, record_run
from src.config import AgentConfig
from src.constraints import Constraints
from src.creative import synthesize_payload
from src.deploy import deploy_payload, render_manifest
from src.mcp_client import build_client
from src.report import render_report


def run_once(config: AgentConfig, force_dry: bool, phase: str) -> None:
    constraints = Constraints.load(config.resolve(config.paths.get("constraints_file", "meta_api_constraints.json")))
    client = build_client(config, force_dry=force_dry)
    today = date.today()

    # Phase 1 (read) + Phase 2.
    warnings = constraints.deadline_warnings(today)
    diag = build_diagnostics(client, config, today)
    print(render_report(diag, warnings, client.live))

    if phase == "audit":
        return

    if client.live and not config.is_configured:
        print("\n[stop] account config still has REPLACE_ME placeholders; refusing live synthesis/deploy.")
        return

    # Phase 5 memory feeds Phase 3.
    brain_path = config.resolve(config.paths.get("brain_csv", "agent_brain/historical_performance.csv"))
    hint = best_angle_hint(load_rows(brain_path), diag.ads)

    # Phase 3.
    payload_path, items = synthesize_payload(diag, config, constraints, hint)
    print(f"\n[phase 3] wrote {len(items)} variation(s) -> {payload_path}")
    if hint:
        print(f"[phase 3] history signal: {hint}")
    if phase == "synth":
        return

    # Phase 4 (everything PAUSED).
    manifest = deploy_payload(client, config, constraints, payload_path)
    print("\n" + render_manifest(manifest, client.live))

    # Phase 5 persistence.
    record_run(brain_path, config.ad_account_id, diag, manifest, today)
    print(f"\n[phase 5] appended findings -> {brain_path}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Autonomous Meta Ads Manager Agent")
    parser.add_argument("--config", default=None, help="path to agent_config.json (defaults to example)")
    parser.add_argument("--dry-run", action="store_true", help="force offline fixtures (no network, no writes)")
    parser.add_argument("--phase", choices=["audit", "synth", "all"], default="all")
    parser.add_argument("--loop", action="store_true", help="run forever on the configured cadence")
    args = parser.parse_args(argv)

    config = AgentConfig.load(args.config)
    force_dry = args.dry_run or not config.has_live_credentials

    if not args.loop:
        run_once(config, force_dry, args.phase)
        return 0

    import time

    cadence_days = int(config.raw.get("schedule", {}).get("cadence_days", 3))
    while True:
        run_once(config, force_dry, args.phase)
        print(f"\n[loop] sleeping {cadence_days}d until next run...")
        time.sleep(cadence_days * 86400)


if __name__ == "__main__":
    sys.exit(main())
