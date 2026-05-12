# Sovereign Matrix v2 — Launch Checklist

The one-page index of every manual step required to take Sovereign
from "code merged" to "fully live in production."

If you can tick every box here, the platform is fully launched.

---

## 0 · Pre-flight (local, on the merge commit)

- [ ] `git pull origin main` — latest is on disk
- [ ] `npm install` — lockfile resolves clean
- [ ] `npm run lint` → 0 errors (warnings allowed)
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run test` → all green
- [ ] `npm run build` → green
- [ ] `/deploy-check` skill clean (skips none of the 6 gotchas)

If any of the above fails, **do not deploy** — open an incident PR.

---

## 1 · Database — Neon Console → SQL Editor

Open `https://console.neon.tech`, pick the production project, open
the SQL Editor, paste each file in order, click **Run**, confirm row
counts in the response panel before moving on.

- [ ] `drizzle/0002_async_jobs.sql` — `jobs` table for async runners
- [ ] `drizzle/0003_playbook_runs.sql` — `playbook_runs`, `playbook_run_steps`, `scheduled_runs`
- [ ] `drizzle/0004_remaining_tables.sql` — graph memory + affiliates + audit logs + workflows + tenant onboarding columns
- [ ] `drizzle/0021_agent_runs.sql` — `agent_runs` table (backs every signed-receipt feature)

After each run, sanity-check: `SELECT count(*) FROM information_schema.tables WHERE table_schema='public';` — should monotonically increase.

---

## 2 · Vercel environment variables

Open **Vercel Dashboard → Project → Settings → Environment Variables**.
Each row below is `KEY → where to get the value`. Apply to
**Production + Preview** unless noted.

### 2.1 Signing & crypto (REQUIRED — receipts return `valid: false` without these)

- [ ] `AGENT_RUN_SIGNING_SECRET` — ≥32 random chars. Generate with `openssl rand -hex 32`.
- [ ] `RECEIPT_ED25519_PRIVATE_KEY_B64` — `openssl genpkey -algorithm Ed25519 | openssl pkey -outform PEM | base64`
- [ ] `RECEIPT_ED25519_PUBLIC_KEY_B64` — derived; serve at `/.well-known/sovereign-verifier-keys.json`

### 2.2 Auth — Clerk

- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk Dashboard → API Keys
- [ ] `CLERK_SECRET_KEY` — same page (server-side only — NOT NEXT_PUBLIC)
- [ ] `CLERK_WEBHOOK_SECRET` — Clerk Dashboard → Webhooks → create endpoint `https://sovereignmatrix.agency/api/webhooks/clerk`, copy signing secret

### 2.3 Payments — Stripe

- [ ] `STRIPE_SECRET_KEY` — Stripe Dashboard → Developers → API keys (live mode)
- [ ] `STRIPE_WEBHOOK_SECRET` — Stripe Dashboard → Developers → Webhooks → add endpoint `https://sovereignmatrix.agency/api/_payments/stripe/webhook` → copy signing secret
- [ ] `STRIPE_PRICE_STARTER` — create product "Starter — $29/mo · 200 runs", copy price ID (`price_…`)
- [ ] `STRIPE_PRICE_ARRAY` — create product "Array — $99/mo · 500 runs", copy price ID
- [ ] `STRIPE_PRICE_NODE` — create product "Node — $299/mo · 2K runs", copy price ID
- [ ] `STRIPE_PRICE_ENTERPRISE` — create product "Enterprise — $999/mo · 10K runs", copy price ID

Subscribe the Stripe webhook to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`.

### 2.4 AI providers (at least one required)

- [ ] `ANTHROPIC_API_KEY` — Anthropic Console
- [ ] `GOOGLE_API_KEY` — Google AI Studio (for Gemini)
- [ ] `NVIDIA_API_KEY` — NVIDIA NIM (free tier)
- [ ] `GROQ_API_KEY` — Groq Cloud
- [ ] `CEREBRAS_API_KEY` — Cerebras (fast inference)
- [ ] `OPENAI_API_KEY` — fallback only; not required if Anthropic + Gemini set
- [ ] (Optional) `OLLAMA_BASE_URL` — set if you run a local model gateway

### 2.5 Database

- [ ] `DATABASE_URL` — Neon connection string (production branch, pooled)
- [ ] `DATABASE_URL_UNPOOLED` — same project, unpooled (for migrations only — runtime uses pooled)

### 2.6 Email

- [ ] `RESEND_API_KEY` — Resend Dashboard → API Keys (primary sender)
- [ ] `RESEND_FROM_EMAIL` — verified domain in Resend (e.g., `noreply@sovereignmatrix.agency`)
- [ ] (Fallback) `GMAIL_USER` + `GMAIL_APP_PASSWORD` — Gmail SMTP if Resend unavailable

### 2.7 CRM / integrations

- [ ] `HUBSPOT_CLIENT_SECRET` — HubSpot app webhook signing secret
- [ ] `CALCOM_WEBHOOK_SECRET` — Cal.com webhook signing
- [ ] `YOCO_WEBHOOK_SECRET` — Yoco (ZA) payments
- [ ] `TELEGRAM_WEBHOOK_SECRET` — Telegram bot webhook (if running closer bot)

### 2.8 Operations

- [ ] `SYSTEM_USER_ID` — `userId` to attribute system-initiated runs (cron jobs, webhooks)
- [ ] `ADMIN_USER_IDS` — comma-separated Clerk user IDs that can grant bonus credits / view all tenants
- [ ] `DATA_SOVEREIGNTY_MODE` — `eu` | `us` | `za` | `global` — picks the AI provider region default
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — rate limiting (graceful degrade if absent)
- [ ] `SENTRY_DSN` — error monitoring (optional but recommended)

---

## 3 · Stripe Dashboard wiring

Outside of env vars, the Stripe side needs:

- [ ] Webhook endpoint added: `https://sovereignmatrix.agency/api/_payments/stripe/webhook`
- [ ] All 5 event types subscribed (see 2.3 above)
- [ ] First test event sent — Stripe Dashboard → Webhooks → click endpoint → "Send test webhook" → choose `checkout.session.completed` → confirm green response in the endpoint log
- [ ] Customer Portal enabled: Stripe Dashboard → Settings → Billing → Customer Portal → activate (lets paying users manage their own subscription from `/dashboard/billing`)

---

## 4 · Clerk Dashboard wiring

- [ ] Webhook endpoint added: `https://sovereignmatrix.agency/api/webhooks/clerk`
- [ ] Subscribed events: `user.created`, `user.updated`, `user.deleted`, `session.created`
- [ ] Allowed origins include `https://sovereignmatrix.agency` and `https://*.vercel.app` (for preview deploys)
- [ ] Sign-in page customization: matches landing brand (dark mode, copper CTA)

---

## 5 · Domain & DNS

- [ ] `sovereignmatrix.agency` → Vercel A/CNAME pointing at the project
- [ ] Apex + `www` redirect configured (Vercel handles automatically)
- [ ] HTTPS certificate issued (Vercel auto-issues — wait ~2 min after DNS propagates)
- [ ] HSTS preload eligible (next.config.ts already sends `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`)
- [ ] `/.well-known/security.txt` reachable
- [ ] `/.well-known/sovereign-verifier-keys.json` reachable + returns the active ed25519 public key

---

## 6 · Distribution surfaces

### 6.1 MCP server publication

- [ ] `npm publish --access public` in `packages/mcp/` (already done if v1.x is on npm)
- [ ] Submit to Anthropic MCP registry: open PR at `https://github.com/anthropics/mcp-registry` referencing the npm package
- [ ] Submit to Smithery / mcp.so directories

### 6.2 GitHub Action

- [ ] Action published to GitHub Marketplace: `https://github.com/marketplace/actions/sovereign-matrix-receipt-verify`
- [ ] Confirm `packages/verify-action/action.yml` `runs.using: node20`
- [ ] Tag a stable release (`v1.0.0`) — Marketplace pins on tags

### 6.3 CLI tool

- [ ] `npm publish --access public` in `packages/cli/` for `@sovereignmatrix/cli`
- [ ] README badge added to repo root

### 6.4 Postman / Insomnia

- [ ] `https://sovereignmatrix.agency/api/postman.json` returns 200 + valid v2.1 collection
- [ ] Add "Import → Link → paste URL" button on `/api-docs` page

---

## 7 · Industry positioning surfaces

The Cook 28 vertical pages are now live. Confirm each one renders:

- [ ] `/industries` — 12-vertical hub renders, all card links route correctly
- [ ] `/compliance` — SOC 2 / EU AI Act / POPIA / GDPR positioning (cyan accent)
- [ ] `/vendor-risk` — procurement questionnaire pre-answers (cyan accent)
- [ ] `/insurance` — AI E&O underwriting signals (cyan accent)
- [ ] Existing `/for-*` pages all reachable from `/industries`
- [ ] Landing nav now shows "Industries" between Platform and Marketplace

---

## 8 · SEO & analytics

- [ ] Submit `https://sovereignmatrix.agency/sitemap.xml` to Google Search Console
- [ ] Submit same to Bing Webmaster Tools
- [ ] Confirm `/robots.txt` allows all crawlers, references the sitemap
- [ ] Verify Open Graph previews on Twitter Card Validator + LinkedIn Post Inspector for: `/`, `/quickstart`, `/spec`, `/compliance`, `/vendor-risk`, `/insurance`, `/industries`
- [ ] Plausible / PostHog / Vercel Analytics enabled (whichever you use)

---

## 9 · Outbound launch

Once everything above is green:

- [ ] Push git tag: `git tag -a v2.3.0 -m "v2.3.0 — vertical positioning launch" && git push origin v2.3.0`
- [ ] Publish release notes from `CHANGELOG.md` v2.3.0 entry to the GitHub release
- [ ] Post on X / LinkedIn: link to `/quickstart` + a verified receipt URL
- [ ] Show HN: title format = "Show HN: Sovereign Matrix — cryptographically signed receipts for every AI agent run"
- [ ] Email the design-partner cohort for the 4 frontier verticals (`/industries` page lists them)
- [ ] Ping the 5 highest-priority vendor-risk prospects with a personalized `/vendor-risk` link

---

## 10 · 24-hour post-launch monitoring

- [ ] `/api/healthz` returns 200 every 5 min (set up Better Stack or Cronitor)
- [ ] Sentry has zero **new** error groups in the first hour
- [ ] Stripe webhook log shows green responses on every event
- [ ] `/api/stats/public` lifetime-receipt counter is incrementing
- [ ] No unexpected DB connection-pool exhaustion (Neon dashboard → connections graph)
- [ ] No 5xx rate spike on Vercel (project → analytics)

If any of these go red — open an incident channel and roll back via Vercel dashboard.

---

## Status

| Section                  | Status                  |
| ------------------------ | ----------------------- |
| 0 · Pre-flight           | Code-side green; verify |
| 1 · DB migrations        | **Manual — user**       |
| 2 · Vercel env           | **Manual — user**       |
| 3 · Stripe webhook       | **Manual — user**       |
| 4 · Clerk webhook        | **Manual — user**       |
| 5 · Domain / DNS         | **Manual — user**       |
| 6 · Distribution         | npm + Marketplace ready |
| 7 · Industry surfaces    | Code shipped this PR    |
| 8 · SEO / analytics      | **Manual — user**       |
| 9 · Outbound launch      | **Manual — user**       |
| 10 · Post-launch monitor | **Manual — user**       |

The code side is done. The remaining work is dashboard-configuration that
only the account owner can perform.
