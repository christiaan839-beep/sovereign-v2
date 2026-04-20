# @sovereignmatrix/mcp

> 20-tool MCP (Model Context Protocol) server that exposes the entire
> [Sovereign Matrix](https://sovereignmatrix.agency) agent platform to
> Claude, Cline, Cursor, and any other MCP-compatible client.

Built on Claude as the consensus critic. 5-layer safety pipeline on
every output. Auditable, reproducible, snapshot-exportable runs.

## Install

```bash
npm install -g @sovereignmatrix/mcp
```

## Configure (Claude Code)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sovereign-matrix": {
      "command": "sovereign-mcp",
      "env": {
        "SOVEREIGN_BASE_URL": "https://sovereignmatrix.agency",
        "SOVEREIGN_API_KEY": "sk_pro_..."
      }
    }
  }
}
```

API keys are obtained from [dashboard.sovereignmatrix.agency/settings/tokens](https://sovereignmatrix.agency/dashboard/settings/tokens).
Free-tier keys work for 50 runs/month — no credit card.

## Available tools (20)

### Platform operations
- `sovereign_health` — health of the platform + DB
- `sovereign_api_catalog` — full capability manifest
- `sovereign_list_playbooks` — browse preset playbooks
- `sovereign_run_playbook` — execute a named playbook
- `sovereign_run_agent` — execute any agent by slug
- `sovereign_usage` — your current billing period usage

### Agent discovery + transparency
- `sovereign_agent_resume` — fetch any agent's `.agent.md` resume
- `sovereign_partnership_metrics` — Anthropic partnership data (public)
- `sovereign_safety_metrics` — 5-layer safety pipeline outcomes

### Auditability
- `sovereign_verify_snapshot` — verify an exported run snapshot's integrity

### High-value agents (first-class MCP tools)
- `sovereign_find_leads` — B2B prospect research + qualification
- `sovereign_generate_blog` — SEO blog generation with research grounding
- `sovereign_seo_audit` — domain audit or content calendar
- `sovereign_competitor_intel` — Porter's 5 Forces + Blue Ocean analysis
- `sovereign_grounded_search` — Tavily web search with citations
- `sovereign_generate_ads` — 5 ad creatives across psychological hooks
- `sovereign_consensus` — multi-model generate-critique-revise
- `sovereign_translate` — 140+ languages with context preservation
- `sovereign_meeting_notes` — transcript → action items + decisions
- `sovereign_code_review` — AI-powered code review with priorities

## Why this exists

Most AI agent platforms are UI-first. Sovereign Matrix is
MCP-first — every agent is addressable from Claude Code or Cline
without leaving your editor. This MCP server is the distribution
surface.

Each tool is one HTTP call to `api.sovereignmatrix.agency`. We don't
run Claude on our side for these tools — the MCP client does — so
your token budget stays under your control.

## Safety + auditability

Every agent run goes through a 5-layer safety pipeline (jailbreak
detection → content safety → PII scan → quality score → Claude critic
gate). You can see live production outcomes at
[/trust/anthropic](https://sovereignmatrix.agency/trust/anthropic).

For regulated workloads, every run can be exported as a cryptographically
checksummed "Agent Snapshot" — a portable JSON document that any auditor
can verify via `sovereign_verify_snapshot` or the public POST endpoint
at `/api/_replay/verify`.

## License

MIT

## Contributing

The Sovereign Matrix codebase is
[on GitHub](https://github.com/christiaan839-beep/sovereign-v2).
Issues and PRs welcome.
