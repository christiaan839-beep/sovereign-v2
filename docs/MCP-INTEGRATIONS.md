# Sovereign Matrix — MCP & Plugin Integration Guide

## What Are MCPs?

MCP (Model Context Protocol) servers are plugins that extend Claude's capabilities. They let Claude directly interact with external services — databases, CRMs, payment systems, monitoring tools — without you writing glue code.

## Recommended MCP Connections

### Tier 1: Critical (Connect Now)

| MCP Server | Purpose | Setup |
|------------|---------|-------|
| **Neon** | Direct PostgreSQL management — query, migrate, inspect your DB from Claude | Requires: `neon.api_key` |
| **Stripe** | Manage subscriptions, invoices, customer data | Requires: `stripe.secret_key` |
| **GitHub Official** | Automate PRs, issues, Actions, repo management | Requires: `github.personal_access_token` |
| **Sentry** | Real-time error tracking & debugging | Requires: `sentry.auth_token` |

### Tier 2: Growth Accelerators

| MCP Server | Purpose | Setup |
|------------|---------|-------|
| **HubSpot** | CRM — contacts, deals, pipeline management | Requires: `hubspot.api_key` |
| **Slack** | Send notifications, monitor channels | Requires: `slack.bot_token` |
| **Gmail** | Email automation beyond Resend | Requires: `gmail-mcp.email_password` |
| **Google Maps** | Power your `/locations/[service]/[city]` pages | Requires: `google-maps.api_key` |

### Tier 3: Advanced Operations

| MCP Server | Purpose | Setup |
|------------|---------|-------|
| **Database Server** | Natural language SQL queries across any DB | Requires: `database_url` |
| **Metabase** | BI dashboards and analytics | Requires: `MetaBaseAPIKey` |
| **Redis Cloud** | Manage caching infrastructure | Requires: `redis-cloud.secret_key` |

## How to Connect MCPs in Claude Code

```bash
# In your Claude Code session:
# 1. Search for available MCPs
#    (Claude can do this via mcp-find)

# 2. Add an MCP server
#    (Claude can do this via mcp-add)

# 3. Configure with your API keys
#    (Claude can do this via mcp-config-set)
```

## Google AI — What You Already Have vs What's Available

### Current Setup (Sufficient)
- `@ai-sdk/google` — Gemini 2.0 Flash via API key
- `@google/generative-ai` — Direct Gemini access
- `@google/stitch-sdk` — Google Stitch for design

### Google Vertex AI — When You'd Need It
You already have `@ai-sdk/google-vertex` installed but likely unused. Vertex AI provides:
- Enterprise SLAs and support
- VPC Service Controls (data residency)
- Fine-tuned model hosting
- Batch prediction
- Model Garden (access to PaLM, Codey, Imagen)

**Verdict**: Not needed unless you're selling to enterprise clients who require SOC 2 compliance on the AI layer. Your current Gemini API key setup is functionally identical for inference.

## Architecture: How MCPs Fit Into Sovereign Matrix

```
┌─────────────────────────────────────────────┐
│              Claude Code CLI                 │
│  ┌─────────┐  ┌────────┐  ┌──────────────┐ │
│  │  Neon   │  │ Stripe │  │ GitHub       │ │
│  │  MCP    │  │  MCP   │  │ Official MCP │ │
│  └────┬────┘  └───┬────┘  └──────┬───────┘ │
│       │           │              │          │
└───────┼───────────┼──────────────┼──────────┘
        │           │              │
   ┌────▼────┐ ┌────▼────┐  ┌─────▼─────┐
   │ Neon DB │ │ Stripe  │  │  GitHub   │
   │ (Prod)  │ │   API   │  │   API     │
   └─────────┘ └─────────┘  └───────────┘
```

## What Else Can We Add to Make This Ultimate?

### 1. OpenTelemetry Integration
Add distributed tracing across all 100+ agent routes for performance monitoring.

### 2. Feature Flags (LaunchDarkly / Vercel Edge Config)
Roll out new agents gradually, A/B test model routing strategies.

### 3. WebSocket Upgrade (Pusher → Cloudflare Durable Objects)
Reduce latency for real-time agent streaming. You're already on Vercel — this is a natural fit.

### 4. API Versioning
Your 146 routes will eventually need versioning (`/api/v1/agents/...`) to avoid breaking client integrations.

### 5. Agent Marketplace Backend
You have the UI (`/dashboard/marketplace/`) — add a proper agent registry with:
- Version control per agent
- Usage analytics per agent
- Community contributions
- Rating system

### 6. Cron Job Dashboard
Your `/api/cron/` routes run blind — add a dashboard showing last run, next run, success/failure history.
