# Sovereign Matrix — World-Class Landing Redesign
**Date:** 2026-04-21  
**Scope:** Landing page (`/`) full rewrite + `/marketplace` + `/intelligence` + `/pricing` refresh  
**Goal:** Elite-tier design competitive with Linear, Vercel, Anthropic — positions Sovereign Matrix as "The Agent Infrastructure Stack"

---

## 1. Positioning

**Primary claim:** "The Agent Infrastructure Stack"  
Not "AI platform." Infrastructure implies permanence and that others build on top of you.

**Three-word ICP:** Build. Scale. Own.

**Category we're creating:** Agent Infrastructure — the OS layer enterprises run their AI workforce on.

**Unique moats to showcase (in order of uniqueness):**
1. A2E Economy — agents hiring agents (no competitor has this)
2. Semantic memory — compounding intelligence per user
3. 39+ model smart routing — best-model-per-task, model-sovereign
4. 5-layer verification + HITL — enterprise-safe by default
5. 137 specialized agents — breadth no one can match

---

## 2. Design Language

| Token | Value |
|---|---|
| Background | `#030303` |
| Copper accent | `#B5532C` |
| Card surface | `bg-white/[0.025]` + `backdrop-blur-xl` |
| Card border | `border-white/[0.06]` |
| Display font | Instrument Serif (headlines, editorial weight) |
| Body font | Inter Tight |
| Mono font | JetBrains Mono (numbers, labels, code) |
| Primary text | `text-white` |
| Secondary text | `text-neutral-400` |
| Accent text | `text-[#B5532C]` |

**Anti-patterns (hard NO):**
- Rainbow multi-color card system
- Emoji icons
- Cyan / violet / teal accent colors
- Stock gradient blobs
- Generic card grids with no editorial character

---

## 3. Landing Page Section Architecture

### 01 · NAV
- Hidey nav (hides on scroll-down, reappears on scroll-up) via `useHideyNav`
- Left: `SovereignLogo` wordmark
- Center: Platform · Marketplace · Intelligence · Pricing · Docs
- Right: Sign In (ghost) · "Run Free Agent" (copper, small)
- Mobile: hamburger → full-screen overlay

### 02 · HERO
- Full viewport, `min-h-screen`, vertically centered
- Pre-headline badge: `137 agents · 39+ models · LIVE` in JetBrains Mono + copper dot
- Headline: "The Agent Infrastructure Stack" — Instrument Serif, 7xl–9xl, copper on "Infrastructure Stack"
- Subheadline: "137 specialized agents. 39+ models. An economy where agents hire agents. Built for enterprises that can't afford to get AI wrong."
- CTAs: `Run a Free Playbook` (copper) + `Explore the Marketplace` (ghost)
- Background visual: Animated SVG graph — nodes = agents, copper edges fire on simulated A2E hires
- Ambient: faint copper radial gradient at center, 4% opacity max

### 03 · LIVE PROOF STRIP
- 4 live stats in JetBrains Mono, dim copper, pulled from `/api/agents/dashboard-stats`
- `137 Agents · 39+ Models · $X,XXX Creator Earnings · 14 Industries`
- Fallback to static if API unavailable

### 04 · THE THREE MOATS
- 3-column grid (stacks on mobile)
- Column 1: **A2E Economy** — "Agents that hire agents. The first self-sustaining AI marketplace."
- Column 2: **Semantic Memory** — "Every run makes it smarter. Compounding intelligence no one else has."
- Column 3: **Model Sovereignty** — "39+ models. Best-in-class routing. Your data never trains anything."
- Cards: glassmorphism + copper top border + subtle copper glow on hover

### 05 · A2E ECONOMY SHOWCASE
- Section label: `04 / 10 · agent economy`
- Headline (serif): "The First Self-Sustaining Agent Economy"
- Left: editorial copy explaining A2E — agents hire agents autonomously, creators earn 70% per hire
- Right: live visualization — animated agent node graph with copper edges, credit counter ticking
- Stats bar: "X marketplace agents · $X earned today · X active hires"
- CTA: "Explore the Marketplace →"

### 06 · SEMANTIC MEMORY MOAT
- Section label: `05 / 10 · intelligence engine`
- Headline: "Gets Smarter Every Run"
- Copper timeline (4 nodes): First Run → 10 Runs → 100 Runs → 1,000 Runs
- Each node: label + what the system now remembers at that stage
- Opacity ramp copper from 0.35 → 1.0 across nodes
- CTA: "See Your Intelligence Score →"

### 07 · MODEL ROUTER
- Section label: `06 / 10 · model infrastructure`
- Headline: "Best Model for Every Task. Always."
- Grid of provider logos: NVIDIA NIM · Anthropic · Google · Groq · Cerebras · Ollama
- Routing logic visualization: task type → model selection path (flowchart, minimal)
- DATA_SOVEREIGNTY_MODE badge: "Sovereign Mode: Zero Chinese model routing available"

### 08 · VERIFICATION PIPELINE
- Section label: `07 / 10 · trust layer`
- Headline: "5 Layers of Safety. Every Single Run."
- Five expandable rows: Jailbreak Guard → PII Redactor → Content Policy → Quality Critic → Human Override
- Each row: name + one-line description + pass rate
- Bottom callout: "HITL — human approval gates for every sensitive action"

### 09 · FEATURED PLAYBOOKS
- Section label: `08 / 10 · automation playbooks`
- 5 playbook cards from `getMarketingPlaybooks()` + PLAYBOOK_COPY
- Each: name · tagline · outcome · time · "Run Free →" CTA
- Copper glow on hover, TiltCard wrapper

### 10 · INDUSTRY GRID
- Section label: `09 / 10 · built for your industry`
- 8-card grid: HC · LG · AG · MF · CS · FI · RE · GV (monogram pills)
- Each card: monogram pill + industry name + use case headline
- Uniform copper accent, no rainbow

### 11 · PLATFORM SCALE
- Dense metric bar: "137 agents · 39+ models · 14 industries · 99.9% uptime · <100ms routing · 5-layer verified"
- JetBrains Mono, white/60, copper separators

### 12 · PRICING STRIP
- 5 tiers inline: Free · Starter $19 · Growth $49 · Node $199 · Enterprise $499
- Most popular badge (Growth)
- Minimal — link to full /pricing page

### 13 · FINAL CTA
- Full-width copper-tinted section
- Headline (serif): "Your AI Workforce Starts Free"
- Subhead: "No card required. 137 agents ready in 60 seconds."
- CTA: "Run Your First Agent Free" (large, white button on copper bg)

### FOOTER
- 4-column: Product · Solutions · Developers · Company
- Bottom row: © 2026 · Privacy · Terms · Status · Twitter/X · GitHub

---

## 4. SEO Architecture

### Landing page metadata
```tsx
export const metadata: Metadata = {
  title: "Sovereign Matrix — The Agent Infrastructure Stack",
  description: "137 AI agents. 39+ models. An economy where agents hire agents. Enterprise-grade AI infrastructure with 5-layer verification, semantic memory, and model sovereignty.",
  keywords: ["AI agents", "agent infrastructure", "AI automation", "enterprise AI", "multi-agent platform", "AI orchestration"],
  openGraph: { title, description, url, siteName, images, type: "website" },
  twitter: { card: "summary_large_image", title, description, images },
  alternates: { canonical: "https://sovereignmatrix.agency" },
  robots: { index: true, follow: true },
}
```

### JSON-LD structured data
- `Organization` schema
- `WebApplication` schema
- `FAQPage` schema on pricing

### Semantic HTML
- One `<h1>` per page
- Proper `<h2>`/`<h3>` hierarchy
- `<article>`, `<section>`, `<nav>`, `<main>`, `<aside>` where appropriate
- All images have `alt` text
- `aria-label` on interactive elements

### Core Web Vitals targets
- LCP < 2.5s: hero image replaced with CSS/SVG, no heavy external assets
- CLS 0: all dynamic content has explicit dimensions
- FID/INP < 100ms: no blocking JS in critical path

---

## 5. /marketplace Page

**URL:** `/marketplace`  
**Title:** "The Agent Marketplace — Sovereign Matrix"  
**Description:** Browse 137 specialized AI agents. See hire counts, creator earnings, and real-time usage.

### Sections
1. Hero: "The Agent Economy" — headline + live economy stats bar
2. Featured agents (top 3 by usage): large cards with hire counts + creator name
3. Filter bar: All · Voice · Vision · Content · Research · Code · Industry
4. Agent grid: name · category · price/run · hire count · rating · "Hire Agent →"
5. Creator CTA: "List Your Agent — Earn 70% of every hire"
6. Economy stats: total agents · total hires · credits in circulation · top earner

### Data sources
- Agent list: static from `AGENT_REGISTRY` keys + category metadata
- Economy stats: `/api/agents/dashboard-stats` fallback to static
- Hire counts: `a2e_hire_log` table via new API endpoint

---

## 6. /intelligence Page

**URL:** `/intelligence`  
**Title:** "Semantic Intelligence Engine — Sovereign Matrix"  
**Description:** AI that remembers everything. Every agent run builds a semantic memory that makes future runs dramatically smarter."

### Sections
1. Hero: "AI That Remembers" — headline + memory depth visualization
2. How it works: 4 steps — Run → Embed → Store → Recall
3. Memory depth timeline: 1 run → 10 → 100 → 1,000 (what you gain at each stage)
4. Technical callout: NVIDIA NIM embeddings, 1024-dim vectors, cosine similarity
5. Privacy: memories are user-scoped, cross-user retrieval architecturally impossible
6. CTA: "Start Building Your Memory →"

---

## 7. /pricing Page Refresh

### Changes
- Replace any hardcoded tier prices with values from `plans.ts`
- Add JSON-LD FAQPage schema
- Add A2E credits per plan (Free: 0 · Starter: 50/mo · Growth: 200/mo · Node: 1000/mo · Enterprise: unlimited)
- Add compare table with all features
- Ensure 5 tiers match: Free · Starter $19 · Growth $49 · Node $199 · Enterprise $499

---

## 8. Component Map

| New component | Purpose |
|---|---|
| `A2EGraph` | Animated SVG agent-economy graph for hero |
| `LiveProofStrip` | Real-time stats bar below hero |
| `ThreeMoatsGrid` | 3-column moat showcase |
| `A2EEconomySection` | Full A2E showcase section |
| `ModelRouterSection` | Model grid + routing viz + sovereignty badge |
| `VerificationPipeline` | 5-layer expandable rows |
| `PlatformScaleBar` | Dense metric bar |
| `PricingStrip` | Inline 5-tier pricing teaser |
| `MarketplaceHero` | /marketplace hero + economy stats |
| `AgentCard` | Marketplace agent card |
| `IntelligenceHero` | /intelligence hero + memory visualization |
| `HowMemoryWorks` | 4-step memory explainer |

Existing components to retain: `SectionHead`, `TiltCard`, `useHideyNav`, `MemoryMoat`, `FounderSeats`, `CommandEgg`, `StackKiller`

---

## 9. File Changes

| File | Action |
|---|---|
| `src/app/page.tsx` | Complete rewrite |
| `src/app/marketplace/page.tsx` | Create new |
| `src/app/intelligence/page.tsx` | Create new |
| `src/app/pricing/page.tsx` | Refresh |
| `src/components/landing/A2EGraph.tsx` | Create |
| `src/components/landing/LiveProofStrip.tsx` | Create |
| `src/components/landing/ThreeMoatsGrid.tsx` | Create |
| `src/components/landing/ModelRouterSection.tsx` | Create |
| `src/components/landing/VerificationPipeline.tsx` | Create |

---

## 10. Success Criteria

- [ ] Lighthouse SEO score ≥ 95
- [ ] No rainbow color system anywhere
- [ ] No emoji icons in professional UI
- [ ] All Framer Motion animations use `whileInView` + `once: true`
- [ ] Mobile responsive at 375px, 768px, 1280px, 1920px
- [ ] Every section has a `<h2>` headline
- [ ] Live data has static fallbacks
- [ ] design-slop-blocker passes all 4 pages
