# ⚡ SOVEREIGN MATRIX OVERRIDE ⚡

> **STATUS: ABSOLUTE MARKET DOMINATION ACTIVE**
> **DEPLOYMENT:** Vercel Edge / Local Docker XFVB

## 1. The Structure of Power
The Sovereign Matrix isn't software; it is an autonomous workforce deployed on **Vercel Edge Runtimes** and orchestrated locally via **Dockerized Python Daemons** (NemoClaw).

It completely replaces the need for SDRs, strategists, and copywriters. 

## 2. Does the System Get Smarter?
**YES.** The Sovereign Matrix employs a permanent localized RAG memory loop (`ChromaDB`). Every time you feed it a competitor PDF, an old sales call transcript, or a winning cold email, it embeds this logic locally. Every subsequent strike it makes pulls from an ever-expanding contextual knowledge base. It physically gets smarter without relying on OpenAI's memory constraints. 

## 3. How Do Users Experience This Platform?
Your $5,000/mo Cartel clients log into `sovereign-matrix.com/client-portal/[domain]`. 
They see a flawless, military-style UI (The Palantir 3D Map, The Extinction Calculators). They submit a request (e.g., "Need 500 tech leads"), and then they close the browser.

You receive a ping on your iOS Telegram App. You tap `/execute`. The agent runs the requested playbook (lead discovery, outreach drafting, send), and writes each step to the audit log. A weekly summary report lists the exact work completed. We don't fabricate time-saved estimates; if you want an hours-saved claim, compute it from your own baseline and the verified audit log.

They never see the backend. They only see the results.

## 4. Is it Fast and Secure?
- **Speed:** The Vercel Edge API runs on cold-start-immune instances, meaning UI responsiveness is measured in micro-seconds.
- **Security:** NATIVE Zod Schema validation physically guarantees no malformed JSON can breach your Neon Postgres DB. The local Python scraper utilizes `try...except...finally` logic to ruthlessly kill zombie Chromium processes instantly, meaning your Mac/Server will *never* crash or run out of RAM.

## Deployment Commands
To run the UI:
```bash
bun run dev
```
To run the Daemon:
```bash
cd server/python-agents && source venv/bin/activate && python nemoclaw_os.py
```
To execute physical containerization:
```bash
docker-compose up -d --build
```

Execute. Dominate. Extinguish.

---

## Operations

### Environment Variables

All env vars are validated at boot via a Zod schema in `src/lib/env.ts`.
A misconfigured deploy fails fast in production with a readable error
listing the missing fields.

1. Copy the template: `cp .env.example .env.local`
2. Required for any deploy: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `DATABASE_URL`
3. Required for AI to do anything useful: at least one of
   `NVIDIA_NIM_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY`,
   `ANTHROPIC_API_KEY`, `GROQ_API_KEY`.

When the server boots, `src/lib/env.ts` prints a capability banner —
`✓` means wired, `–` means dormant. Use this to confirm a deploy
before cutting traffic over.

### Health Endpoints

| Endpoint | Purpose | Response |
|---|---|---|
| `/api/health` | Liveness — always returns JSON, never 500 | 200 with status object |
| `/api/health/ping` | Lightweight keepalive | 200 with `{ok: true, ts}` |
| `/api/health/deep` | All upstreams, 2s per check, parallel | 200 healthy / 503 critical-down |

### UptimeRobot Setup

Point UptimeRobot at `https://sovereignmatrix.agency/api/health/deep`:

1. Sign up at [uptimerobot.com](https://uptimerobot.com) (free tier covers 50 monitors)
2. **Add New Monitor** → Type: `HTTPS`
3. **URL**: `https://sovereignmatrix.agency/api/health/deep`
4. **Monitoring Interval**: 5 minutes
5. **Alert after**: 2 consecutive fails (avoids flapping)
6. **Alert Contacts**: email + Slack webhook + PagerDuty
7. **Keyword Monitoring** (optional): alert if response body loses
   `"status":"healthy"` — catches degraded-but-up state

The endpoint returns:
- `200 { status: "healthy" }` — all upstreams up
- `200 { status: "degraded" }` — advisory service missing (e.g. Pinecone
  not configured yet); platform still functional
- `503 { status: "critical" }` — DB or Clerk down; page on-call

### Deployment Checklist

Before cutting over to production:
1. `npm run build` — must succeed locally
2. `npm test` — all tests green
3. `npx tsc --noEmit` — typecheck clean
4. Run new migrations against Neon production:
   `drizzle/0018_credit_system.sql` → apply in Neon Console → SQL Editor
5. Set env vars in Vercel / Railway dashboard (see `.env.example`)
6. Verify `/api/health/deep` returns `{status: "healthy"}`
7. Add the endpoint to UptimeRobot
