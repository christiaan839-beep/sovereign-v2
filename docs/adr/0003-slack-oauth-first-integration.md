# ADR-0003: Slack OAuth as the first real customer integration

**Status:** Proposed
**Date:** 2026-04-19
**Affects:** `src/app/api/_integrations/slack/*`, `src/db/schema.ts`
(new `oauth_connections` table), `src/lib/slack-client.ts`.

## Context

We claim "130 agents that do things in your tools." Today, agents that
*say* they send a Slack message compose a message and hand it to a
hypothetical dispatcher. There's no per-customer OAuth, no token vault,
no workspace mapping. The claim is outrunning the plumbing.

Shipping one end-to-end OAuth flow (Slack as the chosen first) flips
this from marketing to demo. The same pattern generalizes to Gmail,
HubSpot, Linear, etc. — one design, N integrations.

## Decision

Ship OAuth 2.0 for Slack with per-user token storage, tenant scoping,
and the canonical `slack.chat.postMessage` action surfaced in agent
routes.

### Schema

New table `oauth_connections`:

```
id                uuid PK
user_id           text (Clerk id)
provider          text  -- "slack"
workspace_id      text  -- Slack team id, e.g. T01234
workspace_name    text
access_token      text  -- encrypted at rest (via existing safeEncrypt)
refresh_token     text  -- encrypted
scopes            text[]
bot_user_id       text
installed_at      timestamp
revoked_at        timestamp (null while active)
UNIQUE(user_id, provider, workspace_id)
```

### Flow

1. User clicks "Connect Slack" in `/dashboard/integrations`.
2. Frontend redirects to `/api/_integrations/slack/authorize` which
   generates a random state token (stored in a short-lived cookie)
   and 302s to Slack's authorize URL with `scope=chat:write users:read`.
3. Slack redirects back to `/api/_integrations/slack/callback?code=...`.
4. Callback verifies `state`, exchanges `code` for tokens, encrypts
   with `safeEncrypt`, and inserts into `oauth_connections`.
5. Any agent that needs Slack calls
   `slackClient(userId).postMessage({channel, text})` — this wraps
   decrypt + token refresh + API call behind a single async.

### Why Slack first
- Lowest regulatory friction (no PII-heavy data like Gmail/HubSpot).
- Best demo: "agent posted in #sales-wins" is immediately visible.
- Existing webhook-dispatcher in the codebase already has Slack
  formatting helpers.

### Out of scope this iteration
- Granular per-workspace permissions (we'll start with one
  connection-per-user)
- Slash-command/event subscriptions (this is OUTBOUND only to start)
- Enterprise Grid

## Action items

1. `src/db/schema.ts`: add `oauth_connections` table (+ migration)
2. `src/app/api/_integrations/slack/authorize/route.ts`: redirect to
   Slack with CSRF state cookie
3. `src/app/api/_integrations/slack/callback/route.ts`: exchange code,
   encrypt + store, redirect to /dashboard/integrations?connected=slack
4. `src/lib/slack-client.ts`: typed wrapper — getClient(userId),
   postMessage, refreshIfNeeded
5. `src/app/dashboard/integrations/page.tsx`: Slack card with "Connect"
   button, connected state, disconnect flow
6. One agent route (`_agents/slack-notify`) that demonstrates usage

## Trade-offs

- Slack tokens can expire; we need refresh logic (rotation tokens for
  newer workspaces, legacy long-lived for old). Current design handles
  refresh lazily in slackClient.
- If a customer revokes the app in Slack, our DB row is stale — we
  catch Slack's 401 `invalid_auth` on first call and mark
  `revoked_at = NOW()`.
- Per-user not per-org: phase 2 will add org-level connections when
  multi-tenant org support ships.
