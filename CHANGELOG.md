# Changelog

All notable changes to Sovereign Matrix are documented here.

## [2.5.0] — 2026-05-12

The **entry-level agent rollout** pass. Cook 33 lands the first
five universal agents that compose the full elite-tier safety
stack from Cook 32. Every agent inherits confidence-gate +
expert-critic + factory verifier by default. Six independent
safety layers, six new revenue surfaces.

### Added

- **`src/lib/super-agent.ts`** — elite-stack composition helper.
  Wires confidence-gate (Cook 32) and expert-critic (Cook 32) into
  one `runSuperAgent()` call. Three-outcome contract:
  `commit` / `revise` / `abstain`. Returns receipt-friendly
  `SuperAgentResult`. Centralizes the response envelope so every
  agent route returns an identical shape (`toResponseEnvelope()`).
  15 tests covering composition routing, gate→critic ordering,
  rubricId=null skip path, option propagation, and
  JSON-serializable round-tripping.
- **`/api/agents/inbox-triage`** — receptionist / EA replacement.
  Reads inbound email, returns
  `{urgency, category, summary, draftReply, routeTo}`. Standard
  confidence tier, generic-audit-ready rubric.
- **`/api/agents/meeting-scribe`** — junior notetaker replacement.
  Parses transcript, returns
  `{summary, decisions, actionItems, openQuestions}`. Cites
  attendees from the supplied roster only — no fabricated owners.
  Standard tier, generic-audit-ready rubric.
- **`/api/agents/doc-extractor`** — data-entry clerk replacement.
  Caller provides text + field spec; agent returns
  `{fields: {<name>: {value, confidence, sourceQuote}}, missingFields}`.
  STRICT confidence tier — wrong fields are expensive downstream.
- **`/api/agents/lead-qualifier`** — junior SDR replacement. BANT
  qualification with score (0-100), tier (hot/warm/cool/unqualified),
  per-dimension signal + evidence quote, ICP fit, next action,
  reasoning. Standard tier, generic-audit-ready rubric.
- **`/api/agents/tier1-support`** — helpdesk Lvl-1 replacement.
  Answers ONLY from the supplied knowledge base; escalates rather
  than fabricates when the KB doesn't contain the answer. Returns
  `{reply, answeredFromKb, sourceQuotes, tags, escalate}`. STRICT
  tier — wrong support replies erode customer trust.
- **`AGENT_REGISTRY`** — 5 new agents registered for the unified
  serverless router at `/api/agents/<slug>`. Total registered: 142.

### Notes

- The full elite stack on every Cook-33+ agent now reads:
  `generate → confidence-gate → expert-critic → 5-layer verifier
  (LlamaGuard + PII + content policy + quality + trust) →
  cryptographic-receipt`. Six independent safety checks. No single
  failure can ship a wrong answer.
- Each agent's `confidenceTier` is chosen by stakes: medical/legal
  = strict or critical, customer-facing reply drafts = standard,
  internal brainstorming = permissive. Override per-call by
  passing a numeric threshold instead of a tier name.
- Agents return one of three response codes — `ok: true`,
  `ok: false + code: REVISE_REQUIRED`, or
  `ok: false + code: HUMAN_REVIEW_REQUIRED`. UI clients should
  branch on `ok` first, then on `code`.

---

## [2.4.0] — 2026-05-12

The **elite-tier expansion** pass. Cook 31 + Cook 32 land together:
two new audit-grade verticals (pharma + climate, both ★★★★★ on the
audit-demand × TAM ranking) and the two missing super-agent
reliability primitives (confidence-gate + expert-critic). Every new
agent shipped after this release inherits both.

### Added

- **`/pharma`** — Life Sciences + Clinical Trials positioning. 21
  CFR Part 11 (electronic records + signatures), ICH-GCP E6(R3),
  GxP, ALCOA+, HIPAA + GDPR Art. 9. Three audit-ready workflows
  (protocol deviation triage, AE narrative drafting, investigator-
  site monitoring summary). Designed OG card + Service JSON-LD +
  breadcrumb schema + sitemap entry (priority 0.92).
- **`/climate`** — Climate + ESG Assurance positioning. CSRD
  Article 8a limited assurance, SEC climate rule S-K 1500, GHG
  Protocol Corporate Standard, SBTi/CDP/ISSB alignment. Three
  audit-ready workflows (activity data → emissions, Scope 3
  supplier triage, disclosure narrative drafting). Designed OG
  card + Service JSON-LD + breadcrumb schema + sitemap entry.
- **`src/lib/confidence-gate.ts`** — abstain-when-unsure policy
  layer. Three-state outcome (commit / escalate / abstain), four
  tier presets (permissive 0.6, standard 0.7, strict 0.85, critical
  0.95), graceful upstream-failure degradation. Contract: NEVER
  fabricates when upstream model is missing — defaults to abstain
  with a "needs human review" reason. 17 tests covering threshold
  resolution, policy classification, integration with consensus,
  and the JSON-serializable-receipt contract.
- **`src/lib/expert-critic.ts`** — domain-aware final-pass review.
  Per-domain `ExpertRubric` (role + must-pass checklist + nice-to-
  have). Three baseline rubrics shipped: `pharma-protocol-deviation`
  (15-yr CRA persona, ICH-GCP 5.20 + 21 CFR 312.62(b) bar),
  `climate-scope-calculation` (ISO 14065 verifier persona, GHG
  Protocol + CSRD Article 8a bar), `generic-audit-ready` (audit
  reviewer persona). Defensive parsing — model claiming `pass=true`
  with blocker findings is overridden to fail. Network failures
  degrade to blocker verdict (never silently accepts a missing
  review as a pass). 24 tests covering rubric library shape,
  prompt construction, JSON extraction, verdict normalization, and
  the AI-router-mocked integration path.
- **`/industries` hub** — pharma + climate cards added to the
  audit-grade tier (cyan accent). Total audit-grade verticals now
  5: compliance, vendor-risk, insurance, pharma, climate. Hard-
  coded "3 / 3 live" count replaced with `{AUDIT.length}` so future
  additions self-update.

### Notes

- The two new modules (`confidence-gate.ts` + `expert-critic.ts`)
  COMPOSE with the existing `verifiedAi` consensus pipeline + the
  5-layer output verifier. The full super-agent stack now reads:
  generate → consensus-verify → confidence-gate → expert-critic →
  cryptographic-receipt. Six independent safety layers.
- New agents from Cook 33+ will compose these primitives explicitly
  in their request pipeline. See `src/lib/agents/` (forthcoming).

---

## [2.3.1] — 2026-05-12

The **share-surface + proof-of-aliveness** pass. Cook 29 follows
the vertical-positioning launch (Cook 28) with everything required
for those pages to look elite when shared and feel alive on every
visit.

### Added

- **9 dynamic OG cards** — Designed 1200×630 preview images for
  `/industries`, `/compliance`, `/vendor-risk`, `/insurance`,
  `/trust`, `/spec`, `/quickstart`, `/verified`, `/explorer`,
  `/badge`, `/stats`, `/mcp`, `/api-docs`. Sharing any of these on
  Twitter / LinkedIn / Slack / iMessage now renders a brand-
  consistent card with cyan accent glow, brand pill, eyebrow, big
  title, sub-line, and footer status pill. Uses `next/og`
  `ImageResponse` — no Playwright, no headless Chrome.
- **`src/lib/og-card.tsx`** — shared OG card generator. Single
  design system enforces brand-color rule (cyan = audit/infra)
  and consistent typography across every per-route OG image.
- **`<LiveReceiptCounter />`** — landing-page widget under the
  Platform Scale metrics. Fetches `/api/stats/public` on mount +
  every 30s and renders "X,XXX signed lifetime · YYY in 24h"
  with a cyan-pulse dot when 24h activity > 0, neutral dot
  otherwise. Proof-of-aliveness signal for compliance buyers —
  the same lever as Vercel's "deployed 0.4s ago" timestamp.
- **`/blog/feed.xml`** — RSS 2.0 feed. Enables syndication to
  dev.to / Medium / Substack / Hashnode, ingestion by aggregators
  (Feedly / NetNewsWire / FreshRSS / Reeder), and LLM training-
  data crawler discovery. 30-min edge cache. RFC-822 pubDates.
  Atom self-link for autodiscovery.
- **`src/lib/blog-posts.ts`** — extracted the 15 blog posts from
  the inline `ARTICLES` constant in `blog/page.tsx` so both the
  blog listing and the new RSS feed share a single source of
  truth.
- **RSS autodiscovery** — `blog/layout.tsx` now emits the proper
  `<link rel="alternate" type="application/rss+xml">` so browser
  RSS extensions + reader apps discover the feed automatically.
- **`/blog/feed.xml` in sitemap.xml** — crawlers/aggregators that
  read sitemap before robots see the feed without explicit
  discovery.

### Notes

- Brand colors: every new OG card uses cyan (`#22d3ee`) per the
  audit-grade dual-accent rule. Pre-existing root OG (`#10b981`
  emerald) and the launch / pricing OG images are out of scope
  for this pass — they're long-form marketing surfaces that can
  keep emerald until a coordinated re-skin.
- `/r/[id]` already has its own OG image generator at
  `/api/og/receipt/[id]/route.tsx` — that pre-existing endpoint
  is untouched; this PR adds OG to the SURROUNDING surfaces.

---

## [2.3.0] — 2026-05-12

The **vertical positioning launch**. The platform's audit-grade
primitives now have procurement-language landing pages for every
regulated industry that needs to evaluate AI vendors. Same product,
twelve different sales motions, one URL per ICP.

### Added

- **`/industries`** — vertical hub page. Three-tier grid: audit-grade
  surfaces (compliance, vendor-risk, insurance — cyan accent),
  sector landings (12 existing `/for-*` pages — copper accent), and
  frontier verticals (AI labs, journalism, marketplace trust, agent
  versioning — design-partner cohort). Single discoverable index for
  every ICP we sell into.
- **`/compliance`** — Vanta-for-AI positioning. SOC 2 evidence packs
  auto-generated, EU AI Act Article 12-15 audit trails, POPIA s.18-23
  Data Subject Rights exports, GDPR Art. 15/17/20 ROPA + DSAR. Three
  continuous-monitoring primitives (audit-bundle export, Merkle
  tamper-evidence, regulator API). CTA: `compliance@sovereignmatrix.agency`.
- **`/vendor-risk`** — procurement-ready positioning. Pre-answered
  versions of the four highest-frequency security-questionnaire
  questions ("Do you log AI outputs?", "Can we audit your decisions?",
  "What's your SOC 2 posture?", "Who are your sub-processors?").
  Three workflow primitives: paste-one-URL trust hub, embed
  verification badge, 24h procurement SLA. CTA:
  `vendor-risk@sovereignmatrix.agency`.
- **`/insurance`** — AI E&O underwriting positioning. Four
  cryptographic underwriting signals (per-tenant Merkle root,
  tamper-evidence, OpenTimestamps Bitcoin anchoring, risk-signal
  API). Three carrier workflows (premium tiering, subrogation-grade
  evidence, B2B2B distribution to insureds). CTA:
  `partnerships@sovereignmatrix.agency`.
- **Landing nav** — "Industries" link added between Platform and
  Marketplace (desktop + mobile).
- **Landing footer** — "Solutions" column refactored to lead with
  `/industries` + audit-grade verticals before sector landings.
- **`docs/LAUNCH-CHECKLIST.md`** — one-page index of every manual
  step from "code merged" to "fully live in production": Neon
  migrations, Vercel env vars (Clerk / Stripe / AI / DB / email),
  Stripe + Clerk webhook wiring, DNS / HSTS, MCP + GitHub Action +
  CLI publishing, SEO submission, outbound launch.

### Changed

- **`sitemap.xml`** — adds `/industries` (priority 0.92),
  `/compliance` (0.92), `/vendor-risk` (0.92), `/insurance` (0.9),
  and three previously-missing sector pages (`/for-agriculture`,
  `/for-manufacturing`, `/for-government`).

### Fixed

- TypeScript: removed a stale `@ts-expect-error` in the industries
  page after switching `SpotlightCard as={Link}` to its natural
  polymorphic-prop signature (Link is `ElementType` — the assertion
  was leftover from an earlier React 19 children-typing workaround
  that no longer applies).

### Notes

This release is **code-complete for launch**. The remaining work is
account-holder-only: Neon migrations 0002-0004 + 0021, Vercel env
configuration, Stripe webhook URL + price IDs, Clerk webhook URL +
signing secret. See `docs/LAUNCH-CHECKLIST.md` for the
section-by-section walkthrough.

---

## [2.2.0] — 2026-05-11

The **audit-grade UX pass**. Builds on the v2 launch's verifiable
receipts foundation by making the moat tangible everywhere a visitor,
customer, or compliance officer looks. Repositions the platform from
indie-hackers "founders-club" framing to audit-grade infrastructure
for AI in regulated industries.

See earlier git history for the full v2.2.0 / v2.1.0 / v2.0.0
release notes.
