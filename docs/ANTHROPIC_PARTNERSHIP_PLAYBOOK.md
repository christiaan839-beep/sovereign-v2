# Anthropic Partnership Playbook

> How to maximize the Claude Partner Network relationship, framed as
> mutual value creation. Not a pitch deck — an engineering + commercial
> plan.
>
> Audience: Karl Kadon's team at Anthropic, and our own team 12 months
> from now when we've forgotten why we made each decision.
>
> Updated: 2026-04-20

## The partnership thesis

Anthropic wants three things from partners:
1. **Distribution** — more end-users running Claude through third-party platforms
2. **Usage diversity** — varied production workloads that surface edge cases
3. **Positive brand reference** — "built on Claude" as a quality signal

Sovereign Matrix can be an unusually strong partner because we:
- Put Claude in the **critic position** of every agent run (not just generation)
- Route to **cheaper models by default**, reserving Claude for high-value quality gates
- Publicly document our architecture, **showing exactly how we use Claude well**
- Operate the `.agent.md` spec — every agent has a machine-readable capability card

This playbook commits to specific actions that compound the partnership
over 12 months.

## What we already do that serves Anthropic

### 1. Claude as the consensus critic

Every agent run that passes the initial model output through a
"generate → critique → revise" loop. The critic is **always Claude**
(Sonnet 4.5 in 2026) via `src/lib/consensus.ts`. This:
- Catches hallucinations in cheaper-model output before it reaches the user
- Creates a "Claude-verified" quality signal customers can cite
- Generates per-agent quality metrics we share with Anthropic quarterly

Code: `src/lib/consensus.ts` — `verifiedAi()`, `confidentAi()`.

### 2. `/built-with-claude` editorial page

Live at `sovereignmatrix.agency/built-with-claude`. Not a pitch —
an **integration narrative** showing:
- Where Claude sits in our architecture
- The problems we solve with Claude that we wouldn't solve as well with
  other models
- Honest trade-offs where other models win (latency, cost)
- Architecture diagram rendered from actual code

This is the page we link in vendor-selection conversations. It's
worked: three enterprise prospects in 2026-Q1 mentioned reading it
before the first call.

### 3. Anthropic-first `.agent.md` metadata

Every agent in the platform has a public `.agent.md` resume at
`/api/agents/<slug>.agent.md`. The front-matter tags include:
```
models: [claude-sonnet-4.5, nemotron-ultra]
critic: claude-sonnet-4.5
```

Anthropic's discovery crawlers can read this to map which capabilities
are exposed through which providers.

### 4. Robots.txt explicit welcome

```
User-agent: anthropic-ai
Allow: /

User-agent: ClaudeBot
Allow: /
```

We're opted IN for Claude training on our public surfaces. Most
competitors opt out. This is a pro-Anthropic signal at zero cost.

### 5. Never claim Anthropic partnership we don't have

Our `/built-with-claude` page has a deliberate disclaimer:
> "Built with Claude. Not formally affiliated with Anthropic."

When we DO earn Partner status, we update that line truthfully. This
protects Anthropic's trademark and our credibility.

## What we commit to next

Ranked by ease × impact.

### Tier 1 — Zero-cost visibility wins (this month)

- [ ] **Weekly LinkedIn post tagging @anthropic** with a specific
  architectural detail about how we use Claude. Start: 4 posts.
- [ ] **Public case study** once 10 paying customers exist: "How
  Sovereign Matrix uses Claude to catch hallucinations in 70B-model
  output." Publish on sovereignmatrix.agency/blog + cross-post to
  Anthropic's community.
- [ ] **Open-source the `.agent.md` spec** as a standalone GitHub
  repo (`sovereign-matrix/agent-md`). Reference implementation +
  validator. Anthropic's agents can adopt the spec.
- [ ] **Monthly architecture write-up** in a public `/changelog`
  page that ships with every release. Mention Claude's role
  factually where relevant.

### Tier 2 — Platform integrations (next 90 days)

- [ ] **MCP server** — expose Sovereign's agents via Model Context
  Protocol so Claude Code / Claude.ai users can call them natively.
  Repo: `mcp-server/` (already started). Ship v1 with 10 agents,
  grow from there.
- [ ] **Claude Code plugin** — "Sovereign Matrix agents as Claude
  Code slash commands." Makes it trivial for Claude Code users to
  fan out work to our agents. Target: 50 installs in month 1.
- [ ] **Artifact-aware agents** — when an agent generates HTML/CSS/JS,
  return it in a format Claude can render directly as an Artifact.
  Increases Claude-assistant usefulness, increases our distribution.
- [ ] **Computer-use tier-3 agent** — if Anthropic gives early access
  to Computer Use v2, ship an agent that uses it. Feedback to
  Anthropic on production UX. Already scaffolded — `/api/_agents/computer-use/`.

### Tier 3 — Commercial alignment (next 6 months)

- [ ] **Formal Claude Partner Network application** once we hit 50
  paying customers + SOC 2 Type I. That's the credibility bar.
- [ ] **Revenue share pilot** — if Anthropic offers co-sell / revenue
  share for Enterprise deals, adopt it. We prefer long-term partnership
  over short-term margin.
- [ ] **Quarterly business review** with Anthropic's partner team.
  Share: usage metrics, customer feedback, feature gaps, integration
  wishlist. Ask for: earlier access to beta models, case-study
  collaboration, joint webinars.
- [ ] **Claude-Exclusive Enterprise tier** — an optional plan where
  all inference goes through Claude (never a cheaper model). For
  customers who value brand-trust over cost. Higher margin, higher
  Anthropic spend.

### Tier 4 — Research contributions (next 12 months)

- [ ] **Publish agent-platform benchmark** — open-source the evaluation
  harness we use internally. Other AI platforms can run it; Anthropic
  gets a third-party evaluation surface.
- [ ] **Safety + compliance case study** — document how Claude's
  Constitutional AI approach interacts with TCPA / FTC §5 / CAN-SPAM
  compliance. Anthropic uses the write-up in enterprise sales.
- [ ] **Open weights alternative paper** — honest comparison:
  when does a Llama-3.3-70B-local agent beat a Claude-Sonnet agent,
  and vice versa. Published via our blog + arxiv preprint. Builds
  our credibility + helps buyers make informed choices.

## What we need from Anthropic

Framed as specific asks, not vague "support":

### Technical
1. **Early access to Claude model releases** (1-week embargo OK) —
   so our `/changelog` can launch support same-day as Anthropic's
   announcement.
2. **Prompt caching parameters** visible per request — helps us tune
   caching strategy in `src/lib/ai.ts`.
3. **MCP-first documentation** for computer-use + file-system tools.
4. **Beta access to the next Computer Use version** once stable.
5. **API-level cost transparency** — a webhook or API endpoint that
   tells us per-request cost so we can surface it to customers.

### Commercial
6. **Formal Partner badge** once we meet the bar (target Q4 2026).
7. **Co-sell agreement** — Anthropic refers enterprise prospects
   who need Claude-native agent orchestration to Sovereign; we pay
   a referral fee or revenue share.
8. **Joint customer story** — one enterprise customer case study
   written together. Cross-posted on both sites.
9. **Enterprise pricing tier** for API usage once we consistently
   spend $10k+/month on Anthropic API. Volume discount with locked
   committed pricing.

### Brand
10. **Speaking slot at a Claude Summit / Anthropic event** — share
    production lessons learned from building on Claude. Zero-cost
    marketing for us, real-world content for Anthropic.
11. **Partner directory listing** — even a simple "Sovereign Matrix
    builds multi-agent orchestration on Claude" line on
    anthropic.com/partners is a meaningful inbound driver.
12. **Reference calls** for our prospects — 2-3 per year, with
    Anthropic folks vouching for the technical relationship.

## Partnership health metrics

We track these quarterly and share with Anthropic's partner team:

| Metric | Q1 2026 | Q4 2026 target |
|---|---|---|
| Monthly Anthropic API spend | ~$150 | $5,000+ |
| End-user agent runs through Claude | ~500 | 50,000+ |
| Claude-verified quality-gate pass rate | 94% | 97%+ |
| Public LinkedIn mentions of @anthropic by Sovereign | 0 | 50+ |
| Enterprise customers citing Claude as a buy reason | 0 | 5+ |
| `/built-with-claude` page visits | 200/mo | 2,000/mo |
| MCP server installations | 0 | 500+ |
| Open-source repos related to Claude integration | 1 (this) | 4+ |

## The "partnership graduation ladder"

Where we want the relationship to be over 18 months:

```
Q1 2026    : Individual developer with Anthropic account
           : ↓
Q2 2026    : Claude Build partner (after 10 paying customers)
           : ↓
Q3 2026    : Formal Claude Partner Network member (SOC 2 Type I live)
           : ↓
Q4 2026    : Featured partner with joint case study
           : ↓
Q2 2027    : Co-sell agreement + enterprise volume pricing
           : ↓
Q4 2027    : Speaking slot at Claude Summit + partner directory
```

Each step is gated by meeting the criteria of the previous one — we
don't ask for what we haven't earned.

## Operational — how we maintain the relationship

- **Monthly**: 15-min async update email to Karl's team covering
  usage trends, upcoming features, questions
- **Quarterly**: 30-min sync call with the partner team
- **Annually**: In-person meeting at a major AI conference (NeurIPS,
  Anthropic's own events)
- **Ad hoc**: Any incident that affects Anthropic's services (their
  outage → our pager) gets reported + we share what we learned

## Boundaries we enforce

Things we won't do even if asked:
1. **Train on customer data** to improve Claude (ironic given the
   ask — we promise customers we don't, so we can't)
2. **Share customer PII** with Anthropic beyond aggregate metrics
3. **Migrate customers OFF Claude** to save cost without telling them
4. **Overclaim partnership status** in marketing materials
5. **Use "Anthropic" / "Claude" in ways that dilute the brand**

These boundaries make us a safer partner.

## What a successful Q4 2026 looks like

- $10k/month in Anthropic API spend
- 50 paying customers
- SOC 2 Type I signed
- Formal Claude Partner Network badge on our site
- One joint Anthropic-Sovereign case study published
- MCP server listed in Anthropic's registry
- Speaking slot confirmed at a 2027 AI event

That's what we're building toward. Every commit on the main branch
should move us incrementally closer.
