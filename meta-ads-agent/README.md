# Autonomous Meta Ads Manager Agent

A standalone, API-only execution loop for Meta (Facebook/Instagram) Ads: audit live
performance, detect fatigue/bleed, synthesize anti-slop creative, and deploy it **paused**
for human review. No browser automation, no scraping — all writes go through the
[`pipeboard-co/meta-ads-mcp`](https://github.com/pipeboard-co/meta-ads-mcp) MCP server (or a
self-hosted equivalent).

This folder is self-contained and can be lifted into its own repository as-is.

## What this is (and how it diverges from the original blueprint)

This implements the 5-phase blueprint, **corrected against the May 2026 Meta Marketing API
reality** discovered during research:

| Blueprint rule                         | Status       | Correction applied                                                                                                                                                   |
| -------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1: harvest API changelog         | kept         | Pinned to **v24.0**; encodes the hard deadlines (all <v24 die **2026-06-09**; ASC/AAC gone **2026-05-19**).                                                          |
| 14-day audit window + 7-day cron       | **fixed**    | Meta's "Andromeda" model exhausts audiences ~3x faster — fatigue now shows in **5–7 days**. Window is **7 days**, cadence **2–3 days**.                              |
| Frequency > 2.3 AND CTR decline > 15%  | kept         | Both thresholds align with current benchmarks (decline starts ~2.5, cliff ~4.0). Tunable in config.                                                                  |
| Budget Bleed (1.5× CPA, 0 conversions) | kept         | Still valid; note removed 7-/28-day view-through windows when counting conversions.                                                                                  |
| Overlap Node (>40% audience overlap)   | **replaced** | Detailed targeting is now suggestion-only and exclusions are gone, so programmatic overlap math is unreliable. Replaced with a **campaign-fragmentation** heuristic. |
| Phase 4: deploy everything PAUSED      | kept         | Enforced in two places; the client **refuses** any non-PAUSED create. Matches pipeboard's own default.                                                               |
| Phase 5: "fine-tune" from a CSV        | kept         | It's few-shot retrieval, not fine-tuning. Lowest-CPA angle is fed back into synthesis.                                                                               |

## Layout

```
meta-ads-agent/
├── meta_api_constraints.json      # Phase-1 deliverable: validation schema + API deadlines
├── meta_agent_cron.py             # Phase-5 orchestrator / CLI entrypoint
├── config/agent_config.example.json
├── .env.example
├── agent_brain/                   # historical_performance.csv accumulates here (gitignored)
├── src/
│   ├── config.py        constraints.py   anti_slop.py
│   ├── mcp_client.py    # live pipeboard adapter + offline DryRunClient fixtures
│   ├── audit.py         # Phase 2: fatigue / bleed / fragmentation
│   ├── creative.py      # Phase 3: LLM synthesis + anti-slop retry + template fallback
│   ├── deploy.py        # Phase 4: PAUSED-locked deployment + manifest
│   ├── brain.py         # Phase 5: CSV memory + angle-CPA learning
│   └── report.py        # ACCOUNT HEALTH DIAGNOSTIC REPORT renderer
└── tests/test_pipeline.py
```

## Quick start (offline, no credentials)

```bash
pip install -r requirements.txt
python meta_agent_cron.py --dry-run        # runs the whole loop on built-in fixtures
python -m pytest -q                        # 7 tests, no network
```

The fixtures intentionally trip every node: one fatigued ad, one bleeding ad set, one
fragmented campaign — so you can see the full report → payload → manifest flow immediately.

## Configure for a real account

1. `cp config/agent_config.example.json config/agent_config.json` and replace every
   `REPLACE_ME` (ad account id, page id, persona, value proposition, target CPA, link url).
2. `cp .env.example .env` and set **one** of `PIPEBOARD_TOKEN` or `META_ACCESS_TOKEN`
   (system-user token with `ads_management`). Set `ANTHROPIC_API_KEY` for real creative
   synthesis — without it, the agent falls back to slop-free template copy.
3. Run a read-only audit first:
   ```bash
   python meta_agent_cron.py --phase audit
   ```
4. Then synthesis only, then the full paused deploy:
   ```bash
   python meta_agent_cron.py --phase synth
   python meta_agent_cron.py --phase all
   ```

## Blind-integration caveat (read before first live run)

The live client in `src/mcp_client.py` is coded against pipeboard's **documented** tool
surface (`mcp_meta_ads_get_insights`, `create_ad_creative`, `create_ad`, …) but has not been
run against a live server. Tool-name prefix and the insights/creative parameter shapes are
centralized in that one file and in `config.mcp.tool_prefix` — expect to adjust them once on
your first connection. Everything else (diagnostics, anti-slop, validation, payload, brain)
is fully exercised by the offline tests.

## Scheduling

Prefer a real scheduler (system `cron`, a CI schedule, or an existing job runner) over the
built-in `--loop`. Recommended: a read-only `--phase audit` daily, and `--phase all` weekly.

```cron
0 9 * * 1   cd /path/to/meta-ads-agent && python meta_agent_cron.py --phase all >> run.log 2>&1
```

## Safety model

- Every creative and ad is created **PAUSED**. The client raises rather than create `ACTIVE`.
- Live synthesis/deploy refuses to run while the config still contains `REPLACE_ME`.
- Secrets live only in `.env` (gitignored); the JSON config holds no tokens.
- `pending_ad_payload.json` and the brain CSV are runtime artifacts and are gitignored.
