# The best-platform playbook

> Honest inventory of what's missing, where the gaps are, and the
> 12-month path to unambiguous elite tier.

---

## Part 1 — What's missing from the project today

Not guesses. Each item has a verifiable trigger + a fix scope.

### Infrastructure gaps

| Gap                                       | Why it matters                                           | Fix scope       |
|-------------------------------------------|----------------------------------------------------------|-----------------|
| **103-commit divergence** between feature branch + `main` | Nothing shipped in this sprint reaches Vercel until merged | 1 afternoon     |
| **SSO / SAML for enterprise**             | Can't sell to companies with IT-approved identity         | 3 days          |
| **SOC 2 Type II attestation**             | Gates enterprise procurement above ~500-seat deals       | 3 months + $30K |
| **HIPAA BAA template**                    | Gates healthcare buyers (we have for-healthcare page but can't sign a BAA) | 1 week + legal  |
| **Published status page**                 | SLO tracker exists; no public status.sovereignmatrix.agency | 2 days          |
| **Cross-instance SLO aggregation**        | Current ring buffer is per-instance; Vercel runs many    | 1 week (Postgres sink) |
| **Real uptime monitoring (Pingdom/StatusPage)** | We measure ourselves; need external witness               | 1 day + $50/mo  |
| **Load testing** (k6 / Gatling)           | We don't know where the platform saturates               | 3 days          |

### Product gaps

| Gap                                         | Why it matters                                            | Fix scope       |
|---------------------------------------------|-----------------------------------------------------------|-----------------|
| **Visual playbook canvas editor**           | n8n / Make win on this; our playbooks are code-first only | 2-3 weeks       |
| **Webhook recipe library**                  | Webhook engine exists; no pre-built recipes               | 1 week          |
| **Public agent playground (no signup)**     | Friction at the top of funnel                             | 3 days          |
| **Zero-retention / on-device Ollama setup flow** | Ollama works but setup is manual                          | 1 week          |
| **Stripe Connect onboarding for creators**  | Blocks creator payouts in production                      | 1 week          |
| **NPM publish of @sovereignmatrix/sdk**     | Creators can't install our validator                      | 1 day + ops     |
| **Agent pricing calculator per invocation** | Buyers need to forecast cost                              | 2 days          |

### Developer experience gaps

| Gap                                              | Why it matters                               | Fix scope |
|--------------------------------------------------|----------------------------------------------|-----------|
| **Per-error-code doc page** (`/docs/errors/<code>`) | We have the taxonomy; no content pages yet   | 1 day     |
| **OpenAPI spec auto-published**                  | Enterprises want the swagger file            | 2 days    |
| **Interactive API tryer**                        | Swagger UI or Scalar inline                  | 1 day     |
| **Webhook HMAC sample code**                     | Copy-paste snippets for Node / Python / Go   | 1 day     |

### Quality gaps

| Gap                                           | Today  | Target | Fix scope                         |
|-----------------------------------------------|--------|--------|------------------------------------|
| Agent eval coverage                           | **11%** | 50%    | 4 weeks (~5 agents/day)           |
| Tests overall                                 | 2,331  | 3,000+ | quarterly backfill                 |
| E2E tests (Playwright)                        | 0      | 10+    | 2 weeks                           |
| CI-gated pre-deploy smoke tests               | Manual | Auto   | 2 days                            |

---

## Part 2 — How to become the best platform in the world (12 months)

### Quarter 1 (now → May): Elite-tier foundations

1. **Merge this PR to main + apply migrations.** Gets today's work live.
2. **Publish status.sovereignmatrix.agency** — pipe `/api/_health/slo` to a simple public page.
3. **Cross-instance SLO sink** — stream ring-buffer events to Postgres so numbers survive restarts + aggregate across Vercel regions.
4. **SOC 2 Type I** engagement kickoff (gate for Q3 enterprise deals).
5. **Stripe Connect onboarding live** — unblocks creator payouts.
6. **Published OpenAPI spec + /docs/errors/<code> pages**.

**Target by end of Q1**: 99.95% measured uptime, 6-month rolling.

### Quarter 2 (June → Aug): Visual + vertical push

7. **Visual playbook canvas** — React Flow-based editor for drag-drop orchestration. This is the single biggest gap vs n8n.
8. **Industry Starter Packs** — ship bundles per vertical (Insurance Starter, Logistics Starter, Healthcare Coding Starter, Ag Season, Construction Ops). Each packs 4-5 agents + 2 playbooks + docs.
9. **5 more industries** (see Part 3): Tax/accounting, Recruiting compliance, Retail SKU, Government FOIA, Manufacturing PO — bringing total to **15 verticals**.
10. **Agent eval coverage to 30%** (~65 agents).
11. **HIPAA BAA template + SOC 2 Type I attestation** signed.

### Quarter 3 (Sep → Nov): Compliance + compounds

12. **SOC 2 Type II** complete (12-month audit window).
13. **Compliance Modes** per vertical:
    - Insurance mode: NAIC + state-DOI guardrails
    - Healthcare mode: HIPAA-forced local inference + zero-retention
    - Logistics mode: CBP-traceable audit log
    - Construction mode: OSHA + IBC rule integration
14. **Webhook recipe library**: 50 pre-built recipes (BOL-to-TMS, FNOL-to-Guidewire, Invoice-to-QuickBooks, etc.).
15. **Federated model proxies** — allow enterprise self-hosted Claude/GPT to be addressable from our router.
16. **Public agent benchmarks leaderboard** — `/benchmarks/<industry>` shows which agent wins on W-2 extraction, BOL, COI, etc.

### Quarter 4 (Dec → Feb 2027): Ecosystem

17. **Third-party agent marketplace open** (today we only ship first-party). Creator agents live alongside ours.
18. **@sovereignmatrix/sdk** npm package — typed wrappers for every agent
19. **5 more industries** → **20 verticals**.
20. **Agent pricing calculator** — forecast cost + latency before commit.
21. **Eval coverage to 50%**.

### Q1 2027: Platform-of-platforms

22. **MCP marketplace** — every agent is a ready MCP server tool.
23. **Agent-to-agent economy** (A2E) — agents can invoke other agents with metered revenue share.
24. **On-device agent runtime** — Ollama + our safety pipeline as a downloadable daemon.

---

## Part 3 — Industry gap map: 20+ verticals in reach

### Live today (10)
✅ Healthcare · Legal · Real estate · Recruiting · Cybersecurity · Education · Insurance · Logistics · Agriculture · Construction

### On deck Q2–Q3 (5 — **we have agents for these**, need landing pages)
- **Tax / accounting**: W-2 reader already shipped. Next: 1099-reader, bank-reconciler → `/for-tax`
- **Recruiting compliance**: existing recruiting page. Add: resume-normalizer, reference-check → `/for-recruiting-compliance`
- **Retail / ecom**: menu-digitizer shipped. Next: SKU-normalizer, price-intel → `/for-retail`
- **Government**: needs: FOIA drafter, grant-compliance → `/for-government`
- **Manufacturing**: needs: PO processor, supplier-compliance → `/for-manufacturing`

### Q3–Q4 (5 — clear market, no agents yet)
- **Energy / utilities**: outage-report intake, regulatory-filing drafter
- **Hospitality**: reservation reader, housekeeping incident reporter
- **Nonprofit**: donor thank-you personalizer, grant-impact report
- **Pharma**: adverse-event intake, regulatory dossier assembler
- **Automotive dealers**: trade-in appraisal, finance application intake

### 2027 (5 — larger surface, later payoff)
- **Banking**: AML / KYC document intake
- **Telecom**: service-outage triage, contract renewal
- **Media / broadcast**: rights clearance, royalty tracking
- **Mining / oil & gas**: permit tracking, environmental compliance
- **Sports / entertainment**: talent contract redlining, touring logistics

### Observable patterns for picking the **next** vertical

1. **Paper-heavy + regulated** wins faster (regulatory wedge = harder to displace)
2. **Incumbent system-of-record exists** (Guidewire, Procore, etc.) so we plug in upstream rather than replace
3. **Labor-shortage narrative** (healthcare coders, truck dispatchers, CCAs) — the customer is already losing money on the current path
4. **Output structure is known + stable** (HS codes, ICD-10, IBC occupancy) — LLM hallucination risk is contained

Every industry that passes 3 of 4 criteria goes in the ship queue. Today's 10 all pass 4. The Q2 five all pass 3.

---

## Part 4 — What it looks like when we win

Concrete, measurable end-state after 12 months:

| Dimension               | Today        | +12 months target                                  |
|-------------------------|--------------|----------------------------------------------------|
| Agents                  | 218          | **300+**                                           |
| Industries with ≥4 agents each | 5   | **15**                                             |
| Unique model providers  | 8            | **12** (adds Mistral, Reka, Databricks, self-hosted slot) |
| Eval coverage           | 11%          | **50%+**                                           |
| Published SLO uptime    | ~99.9% untracked | **99.95%+ publicly attested**                  |
| Status page             | internal API | **status.sovereignmatrix.agency** live            |
| Compliance              | informal     | **SOC 2 Type II + HIPAA BAA + ISO 27001 path**    |
| Creator payouts         | infra ready  | **$500K/mo flowing through Stripe Connect**        |
| Platforms (MCP / SDK / CLI / API) | 4  | **6** (+ visual canvas + on-device runtime)        |
| Competitor /vs pages    | 11           | **15** (add Manus, Relevance AI, Sintra, OpenAI's agents) |
| Tests                   | 2,331        | **4,000+**                                         |

**What it FEELS like to a user, end of year:**

- They hit /compare and see live 99.97% uptime + 680ms P95 + 58% cache hit rate
- They browse /for-<their-industry> → ship an agent in < 5 minutes
- They run a playbook that chains 5 agents, each signed, each audited, for $0.12 per invocation
- Their CISO signs the SOC 2 report without a 60-question vendor assessment
- Their developer hits the OpenAPI spec from Postman and gets sample cURL for every endpoint
- Their creator friends build agents on top of our SAM v1.0 spec and get paid through Stripe

That's the "best platform in the world for agentic AI" end-state.
It's 12 months of work from where we sit today — and the foundation is already in the ground.

> Fewer + sharper over more + softer. (STAY-ELITE §129)
