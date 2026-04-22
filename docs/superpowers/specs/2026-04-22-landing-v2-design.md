# Landing v2 — Elite Tier Design Spec

**Status:** Proposed — awaiting user review before implementation.
**Date:** 2026-04-22
**Branch:** `claude/wizardly-benz`
**Target:** `src/app/page.tsx` + supporting components under `src/components/landing/`
**Parallel staging:** `src/app/(landing-v2)/page.tsx` (route group override — production `page.tsx` stays live the entire build)
**Companion spec:** `docs/superpowers/specs/2026-04-22-platform-tier1-gap-audit.md`
**Supersedes:** `docs/superpowers/specs/2026-04-21-landing-redesign-design.md` (yesterday's iterative pass — this is a structural rethink, not a polish)

---

## 1. Goal

Move the landing from **"capable but busy"** (10 sections, abstract constellation graphics, decorative motion) to **"inevitable and precise"** (8 sections, 137 real agents as the protagonist, live demos instead of descriptions, zero fabricated stats).

Quantitative targets:

- **Section count:** 10 → 8
- **Total scroll height:** ~30% shorter
- **Lighthouse mobile:** current unknown → ≥95
- **Lighthouse desktop:** current unknown → ≥98
- **Time-to-interactive on hero:** current unknown → ≤1.8s on 4G
- **Fabricated-stats count:** currently 0 (confirmed via prior `honest` commits) → stays 0
- **Net JS bundle (landing route):** measured-and-capped vs current baseline (no regression)

Qualitative targets:

- Match Linear + Vercel + Anthropic in polish while keeping Sovereign DNA (copper `#B5532C`, Instrument Serif, dark `#030303`, JetBrains Mono captions).
- Every section shows the product rather than describing it.
- 137 agents are *visible as characters*, not a mono caption stat.

---

## 2. Chosen Direction — A+B+C Layered

We confirmed with the user: **A + B + C combined as three layers of one page**, not three aesthetics competing. Stripe executes this exact pattern (editorial type + real product UI + one cinematic globe). It is the world-class pattern.

| Layer | Role | Where it lives |
|---|---|---|
| **A — Editorial (voice)** | Instrument Serif headlines + copper accents + dark-mode + hand-written copy. The *brand*. Always on. | Every section. |
| **B — Product (proof)** | Real dashboard data, real agent output, real stats. Shows the product instead of describing it. | Hero Staff Directory, sections 03–05 live demos. |
| **C — Spatial (map)** | One focused interactive map moment — the 137 agents visualized as a clustered graph you can pan/zoom/click. | Exactly one section: Section 02 "The Atlas". |

**Discipline rule:** C appears *once*. Not decoratively reused. If a later iteration wants another spatial moment, it replaces 02, not duplicates it.

---

## 3. Section Map — 8 Sections (down from 10)

| # | Section | Primary Layer | Replaces | Live Data Source |
|---|---|---|---|---|
| 01 | **Hero — Staff Directory** | A + B | Current hero + `LiveProofStrip` + `RecentRunsTicker` | `/api/public/catalog` (new — see gap spec) |
| 02 | **The Atlas** | C | `ThreeMoatsGrid` + `A2EEconomySection` | `/api/public/catalog` + graph layout in-component |
| 03 | **Memory at Work** | A + B | `MemoryMoat` | `/api/public/memory-demo` (new — see gap spec) |
| 04 | **Routing in the Open** | A + B | `ModelRouterSection` | `/api/public/router-demo` (new — see gap spec) |
| 05 | **Verification You Can Watch** | A + B | `VerificationPipeline` | `/api/public/verify-demo` (new — see gap spec) |
| 06 | **Three Flagship Playbook Profiles** | A | `FeaturedPlaybooksSection` + `ProofStrip` | Static curated content; links to real `/dashboard/playbooks?auto=<slug>` + related `/agents/[slug]` pages |
| 07 | **Pricing + Founders** | A | `PricingStrip` + `FounderSeats` | Static (pulls from `plans.ts` at build time) |
| 08 | **Final CTA + Footer** | A | `FinalCTA` + `Footer` | Static |

**Components deprecated in this pass** (removed from import graph after cutover):

- `ThreeMoatsGrid` — its "three moats" copy absorbed into Atlas region names and Section 06 playbook-profile subtitles.
- `A2EEconomySection` — the A2E story is embodied in the Atlas (edges between agents visualize A2E calls).
- `ProofStrip` (2026-04-21 version) — its metrics become live hover-counters in the hero's category filter pills.
- `LiveProofStrip` — replaced by the hero's live agent count + success rate display.
- `RecentRunsTicker` — replaced by live stats embedded in Section 03 (memory demo naturally uses recent runs as its data).

**Components retained and reused (unchanged):** `SovereignLogo`, `PrimaryCTA`, `StatusIndicator`, `CommandEgg`, `ConstellationField` (as a subtle backdrop in Section 02 only, not the hero).

---

## 4. Section 01 — Hero — Staff Directory

**Goal:** In the first 1.5 seconds, a visitor sees 137 named, clickable agents with real 30-day stats. That is the product. Everything else is support.

**Layout (desktop):**

```
┌─────────────────────────────────────────────────────────────────┐
│ [NAV]                                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   01 / 08 — the bureau                                           │
│                                                                  │
│   Meet the 137                                                   │
│   agents.                                                        │
│                                                                  │
│   Not a framework. Not a no-code builder. Not a promise.         │
│   137 named, verified, production-grade agents. Each has         │
│   shipped real output for real operators this month. Click       │
│   any of them.                                                   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │  [All 137] [Lead Gen 24] [Research 18] [Content 22]...  │    │  ← filter pills
│   │  [🔍 Search 137 agents...]                              │    │
│   └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │ APEX ·············· Lead-gen blitz · 1,204 runs · 96%    │    │  ← row 1
│   │ VELOX ············· Competitor intel · 842 runs · 94%    │    │
│   │ SCRIBE ············ Content engine · 2,103 runs · 98%    │    │
│   │ ARGUS ············· Verification · 4,782 runs · 99%      │    │
│   │ [... 133 more, densely listed]                           │    │
│   └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│   [ Run a Free Agent → ]    [ Browse the marketplace ]           │
│                                                                  │
│   $49/mo when it clicks · no card on free tier                   │
└─────────────────────────────────────────────────────────────────┘
```

**Grid rendering rules:**

> Note: the 4 sample rows shown in the mockup above (`APEX`, `VELOX`, `SCRIBE`, `ARGUS`) are *illustrative*. At render time, rows are fetched from `/api/public/catalog` and sorted by 30-day run count descending. Real first-row names will come from the actual `PublicAgent.displayName` field.

- Airline-departure-board aesthetic: dense rows, tabular-nums, mono for agent name, sans-serif for tagline, tabular-nums for stats.
- Category-colored left border (2px) per row — 8 categories, 8 muted hues all within the copper family (warm variants).
- Row height: 40px desktop, 56px mobile.
- On hover: row lifts 2px, background goes to `rgba(181,83,44,0.04)`, category border deepens to full saturation, a "Run" glyph appears on the right.
- On click: row expands inline to show the dossier (description, 3 use cases, sample output, Run CTA + link to `/agents/[slug]`). Expanded row: ~280px tall. Other rows dim to 40% opacity.
- Dossier data fetched lazily (only on click, not preloaded for all 137).
- Keyboard: ↑/↓ to navigate rows, Enter to expand, Esc to collapse. Full keyboard ≠ "nice to have" — it's a signature that the product is for operators.

**Filter pills:**

- `All 137` default. Click a category pill → instant client-side filter. Counts are real (from catalog response).
- Numbers update live as categories filter.

**Search:**

- Fuzzy match against agent name + tagline + tags.
- Uses the already-shipped `CommandPalette` fuzzy implementation for consistency.

**Copy direction (headline options — to pick):**

1. `Meet the 137 agents.` (simplest, Anthropic-feeling — recommended)
2. `137 agents. Hired and waiting.` (more commercial)
3. `The agents your business should have hired.` (punchy, longer)

**My recommendation: option 1.** Bold in its restraint. Let the grid do the talking.

**Motion budget:**

- Headline: no entrance animation (it's the first thing seen — already present).
- Grid: first 20 rows fade-in staggered over 400ms, remaining rendered instantly (virtualized below the fold).
- Row hover: 180ms ease-out.
- Dossier expand: 260ms custom cubic-bezier `(0.16, 1, 0.3, 1)`.
- No `whileInView` anywhere in this section.

**Data source:** `/api/public/catalog` (new endpoint — see gap spec #4). Returns the `PublicAgent[]` shape with 30-day stats already computed server-side. Cached `s-maxage=300`.

**Fallback:** If the catalog endpoint fails, render a static grid of agent names from `AGENT_REGISTRY` (build-time import), with a mono caption `Live stats unavailable` and no counts. The directory never appears broken.

**Mobile treatment:**

- Filter pills become a horizontally-scrolling strip with momentum.
- Rows are 56px tall with stat pair (runs · success%) on the right in mono.
- Dossier expansion takes full viewport height on mobile (overlay, not inline).
- Search becomes a sticky top bar when scrolled.

**Section height target:** 100vh desktop, 100dvh mobile. Full-bleed hero, no scroll-reveal for the grid itself.

---

## 5. Section 02 — The Atlas

**Goal:** A single, memorable spatial moment that visualizes the scale (137) + the ecosystem (A2E relationships between agents). Done once, done well.

**Implementation choice: force-directed graph, not 3D city map.**

Rationale: A 3D isometric "city map" is the highest-ceiling visual but also the highest execution risk without a dedicated motion designer / WebGL engineer. A force-directed 2D graph using the existing constellation DNA is achievable, stable, and beautiful.

**Layout:**

- Full-width section, ~700px tall desktop / 560px tall mobile.
- 137 nodes (one per agent), sized by 30-day run count (tabular square root scaling so the largest doesn't dominate).
- Colored by category (same 8-hue family as Hero).
- Edges drawn between agents that have A2E relationships (agent A calls agent B in its chain). Edge data from `agent-spawn.ts` call graph.
- Region labels (`Lead Gen`, `Research`, `Content`, ...) float at cluster centroids, in mono tracking-wide.
- Pan by drag, zoom by scroll wheel (or pinch on mobile).
- Hover a node → tooltip with agent name + run count. Click → nav to `/agents/[slug]`.
- Idle state: gentle pulse animation on 5 rotating "hot" nodes (highest 30-day runs).

**Copy block (to the side or overlaid):**

> Section head: `02 / 08 — the atlas`
> Headline: `All of them. At once.`
> Body: `Every agent is a node. Every line is an A2E call — one agent hiring another. The whole ecosystem, as it works today.`
> Caption: `Pan · Zoom · Click any node to open its page.`

**Technical:**

- Use D3 force simulation (`d3-force`) for layout, rendered to Canvas (not SVG — 137 nodes + edges on SVG tank interactive perf on mobile).
- Initial simulation runs server-side at build time → component hydrates with precomputed positions → re-simulates only on explicit user interaction.
- Color palette: 8 hues, desaturated copper family, all WCAG AA against `#030303`.
- Failure mode: if data unavailable, render a static SVG snapshot from the last successful build.

**Data source:** `/api/public/catalog` (reused from Section 01) + new `/api/public/atlas-edges` endpoint for A2E edge list.

**Mobile treatment:** Same interaction model (pan, pinch-zoom) but simplified edges (hide edges at low zoom to reduce visual clutter).

**Motion budget:**

- Entrance: 800ms simulation settle animation when section scrolls into view. Nodes emerge from center, fan out to final positions. One-time.
- Hover tooltip: 160ms.
- Click → route transition: Next.js default.

**A11y:** Atlas has a keyboard-accessible fallback: Tab cycles through nodes in category groups, Enter opens the agent. Screen reader sees a `<ul role="tree">` with `<li>` per agent nested under category labels. The visual graph is `aria-hidden`.

---

## 6. Section 03 — Memory at Work

**Goal:** Show that every run gets smarter. Not with a timeline illustration — with real recalled context from a real past run.

**Layout (desktop, two-column):**

```
┌──────────────────────────┬──────────────────────────────────────┐
│  03 / 08 — semantic       │  LIVE · pulled 3 min ago             │
│                           │                                      │
│  Every run remembers.     │  ┌────────────────────────────────┐  │
│                           │  │ Run · Lead Blitz (1,204)       │  │
│  Every execution gets     │  │ Prompt: Find SaaS prospects... │  │
│  embedded as a 1024-dim   │  │                                │  │
│  vector in your private   │  │ Agent recalled context from:   │  │
│  namespace. Future runs   │  │ · Run 1,202 (2 days ago)       │  │
│  retrieve the relevant    │  │   London SaaS · 8 prospects    │  │
│  context automatically.   │  │ · Run 1,198 (6 days ago)       │  │
│  No re-briefing. Ever.    │  │   London ICP · outreach angles │  │
│                           │  │ · Run 1,195 (12 days ago)      │  │
│  After six months, your   │  │   B2B tone calibration         │  │
│  agents know your niche,  │  │                                │  │
│  your tone, your past     │  │ Similarity: 0.87 / 0.84 / 0.79 │  │
│  campaigns. Yours.        │  └────────────────────────────────┘  │
│                           │                                      │
│  [Start building memory →]│  Powered by NVIDIA NIM embeddings    │
└──────────────────────────┴──────────────────────────────────────┘
```

**Content rules:**

- The "live run" card must show REAL data from a public demo tenant (anonymized, consented). No lorem.
- Vector similarity scores are real cosine distances, displayed tabular.
- "Pulled 3 min ago" updates with actual recency — polled every 60s on the client.

**Data source:** `/api/public/memory-demo` (new endpoint — see gap spec).

**Fallback:** If no public demo data available, the right column renders a caption card: `Memory demos available on the Growth tier and above. [Start a free trial →]`. Never a fake screenshot.

**Motion budget:**

- Right-column card: subtle pulse on the similarity scores (1s interval, 10% opacity swing).
- Recall line-items: fade-in one-by-one on initial load (80ms stagger).

---

## 7. Section 04 — Routing in the Open

**Goal:** Show the smart router deciding between 39+ models in real time.

**Layout (desktop, two-column; right column is a router pass visualization):**

```
┌───────────────────────────┬───────────────────────────────────────┐
│  04 / 08 — smart routing   │  ROUTING PASS · 240ms                │
│                            │                                       │
│  Every task gets the       │  Incoming: "Summarize this contract"  │
│  right model.              │  ↓                                    │
│                            │  Classifier: legal · short-context    │
│  Sovereign's router        │  ↓                                    │
│  classifies your task,     │  Candidates ranked:                   │
│  ranks 39 models across    │  1. Claude Sonnet 4.5  — $0.003/k    │
│  8 providers, and          │  2. Gemini 3.1 Pro     — $0.002/k    │
│  fallbacks through         │  3. Nemotron Ultra 253B— $0.001/k    │
│  eleven deep if any one    │  ↓                                    │
│  stalls.                   │  Selected: Claude Sonnet 4.5          │
│                            │  Fallback chain: [11 models ready]    │
│  Your data never trains    │  ↓                                    │
│  anything.                 │  Latency: p50 820ms · p95 2.1s        │
│                            │                                       │
│  [ Run a routing pass → ]  │                                       │
└───────────────────────────┴───────────────────────────────────────┘
```

**Interactivity:**

- `Run a routing pass →` button triggers a real `/api/public/router-demo` call with a preset prompt.
- Response streams into the right column animating the steps (classification → ranking → selection → latency).
- Rate-limited: 3 passes per IP per hour (demo endpoint).

**Data source:** `/api/public/router-demo` (new — see gap spec).

**Fallback:** Static screenshot of a real pass, with a caption `Live router paused. Run a free trial to use it live.`

---

## 8. Section 05 — Verification You Can Watch

**Goal:** Show the 5-layer verification pipeline running on a real input, live.

**Layout (desktop, single column with pipeline visualization centered):**

```
┌─────────────────────────────────────────────────────────────────┐
│  05 / 08 — verification                                          │
│                                                                  │
│  Every output gets audited.                                      │
│                                                                  │
│  Paste an output. Watch it run the 5-layer pipeline.             │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ [ Textarea: paste a draft email, post, or doc... ]        │   │
│  │                                                           │   │
│  │                                      [ Verify this → ]    │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│   Jailbreak ──→ PII ──→ Content ──→ Quality ──→ Critic           │
│      ✓           ✓         ✓          ✓          ✓               │
│                                                                  │
│   All 5 layers passed in 1.2s                                    │
│                                                                  │
│  Every run on every playbook goes through this. Full audit       │
│  trail lives in /dashboard/audit-trail — yes, including when     │
│  a layer flags and we ship the redacted version instead.         │
└─────────────────────────────────────────────────────────────────┘
```

**Interactivity:**

- User pastes an output into the textarea (limit: 500 chars for demo).
- `Verify this →` triggers `/api/public/verify-demo`.
- The 5-node pipeline animates each layer as pass/fail arrives (staged reveals).
- If a layer fails, it shows in red with the specific reason ("PII: email detected").

**Data source:** `/api/public/verify-demo` (new — see gap spec).

**Rate limit:** 5 verifications per IP per hour.

**Fallback:** Static image of a clean verification pass.

---

## 9. Section 06 — Three Flagship Playbook Profiles

**Goal:** Long-form editorial treatment of the 3 flagship *playbooks* — the user-facing products most customers run first. Feature-article quality. This is the section that makes someone close the tab and say "this team knows their craft."

**Taxonomy note:** In Sovereign's model, a **playbook** is a curated orchestration of multiple **agents** working together (see `src/lib/playbooks.ts`). The hero directory (Section 01) and Atlas (Section 02) show the 137 individual agents. Section 06 zooms into the 3 most-shipped playbooks that compose them. Users buy/run playbooks; they inspect individual agents. Both deserve a home on the landing — and this section is specifically about the playbook story, not the agent story.

**Layout:** Three stacked profile cards, each ~500px tall desktop / full-viewport on mobile. Editorial magazine aesthetic — pull-quotes, generous whitespace, type hierarchy that breathes.

**Profile template:**

```
┌─────────────────────────────────────────────────────────────────┐
│  06.1 / 08 — the lead-gen blitz                                  │
│                                                                  │
│  Apex.                                                           │
│                                                                  │
│  (Playbook · lead-blitz · runs 4 agents in sequence)             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ [Tight editorial paragraph, 3 sentences max]         │        │
│  │                                                      │        │
│  │ Apex chains four agents: ICP Profiler → Prospect     │        │
│  │ Hunter → Contact Enricher → Angle Generator. It      │        │
│  │ searches LinkedIn, Apollo, Hunter, Crunchbase, then  │        │
│  │ cross-references against your past outreach. Output: │        │
│  │ 5+ enriched prospects with contact angles,           │        │
│  │ guaranteed, or the run doesn't count.                │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
│  Real output (last week):                                        │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ "Monday, 14:22 — Found 12 SaaS founders in London    │        │
│  │  who raised in the last 60 days, 3 of whom use       │        │
│  │  Stripe but not Lemon Squeezy. Suggested angle:      │        │
│  │  EU VAT compliance cost arbitrage."                  │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
│  1,204 runs · 96% success · avg 2m 40s                           │
│                                                                  │
│  [ Run Apex → ]    [ See its 4 agents → ]                        │
└─────────────────────────────────────────────────────────────────┘
```

**Three profiles — playbooks from `src/lib/playbooks.ts`:**

| Character name | Playbook slug (system) | What it does |
|---|---|---|
| **Apex** | `lead-blitz` | Lead-gen chain — 4 agents |
| **Velox** | `competitor-takedown` | Competitive intel — 5 agents |
| **Scribe** | `content-machine` | Content engine — 3 agents |

**Character-name rationale:** The codebase uses functional slugs (`lead-blitz`, `competitor-takedown`, `content-machine`) — we keep those as system-of-record. The character names (Apex, Velox, Scribe) are **editorial surface only** — they give each playbook a persona on the landing and in marketing collateral without forcing any code change. Functional slug stays on the page as a mono caption underneath; the character name is the headline.

**"See its agents →" CTA** opens a modal or anchors down to show the actual 4 individual agents (from `playbook.steps`) that compose the playbook, each linkable to its `/agents/[slug]` page. This is the bridge between Section 06 (playbook story) and Sections 01/02 (agent directory) — same ecosystem, two zoom levels.

**Sample outputs must be real.** Pulled from actual run records (anonymized), not written by us. This is non-negotiable for editorial credibility.

**Data source:** Curated at build-time from 3 real run IDs (one per flagship playbook). When any of the three referenced runs is older than 30 days, the build emits a warning and we refresh.

**Motion:** None on profiles. Static, editorial. Hover micro-interactions on buttons only.

---

## 10. Section 07 — Pricing + Founders

**Goal:** Compact, confident pricing summary + founder program in one tight block. Full comparison lives on `/pricing` (already elite — per audit).

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  07 / 08 — pricing                                               │
│                                                                  │
│  Start free. Scale when it clicks.                               │
│                                                                  │
│  ┌───────────────────────────────────────────────────────┐       │
│  │ Free          Starter        Growth         Node      │       │
│  │ 50 runs       $19/mo         $49/mo         $199/mo   │       │
│  │ no card       500 runs       2,000 runs     unlimited │       │
│  │                                                       │       │
│  │                                               [ ★ Most popular ]│
│  └───────────────────────────────────────────────────────┘       │
│                                                                  │
│  Enterprise — $499/mo or custom — SAML, SLA, white-label,        │
│  on-prem option. [ Talk to founder → ]                           │
│                                                                  │
│  [ See the full comparison → ]                                   │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  10 founder seats remaining — enterprise features free for 12    │
│  months. Apply → name, company, what you'd build.                │
│                                                                  │
│  [ Claim a founder seat → ]                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Data source:** `plans.ts` (build-time import). Founder seats remaining via `/api/founders/seats-remaining` (existing endpoint).

**Motion:** None. Static card.

---

## 11. Section 08 — Final CTA + Footer

**Goal:** Closing moment — warm, confident, editorial. Footer is dense but navigable.

**Final CTA:** Retain the current copper-glow card design (`FinalCTA` component), but tighten copy:

```
   Your AI workforce starts free.

   No card. 137 agents. Run your first in 60 seconds.

   [ Run Your First Agent Free → ]   [ Email the founder ]

   · Claude critic on every run
   · Full audit trail
   · Cancel anytime
```

**Footer:** Current structure is strong (per audit — colophon, 4 link columns, status, built-with-claude, operator/dev toggle). Keep it, tighten type sizes to match the v2 scale.

**New footer additions (per Tier 1 gap spec):**

- `/cookies` link (GDPR completeness — to be built)
- Sub-processors link → existing `/dpa` page
- SLA link → existing `/sla` page
- Security page link → existing `/security` page

---

## 12. Typography System — 5 Scales, Used With Conviction

Current system has 10+ sizes in active use. v2 collapses to 5:

| Scale | Usage | Desktop | Mobile |
|---|---|---|---|
| **Display** | Hero + section openers | `text-6xl` (60px) | `text-4xl` (36px) |
| **Headline** | Section subheads | `text-3xl` (30px) | `text-2xl` (24px) |
| **Body** | Paragraphs | `text-[15px]` (15px) | `text-[14px]` (14px) |
| **Small** | Captions, meta | `text-[12px]` (12px) | `text-[11px]` (11px) |
| **Micro** | Mono labels, section numbers | `text-[10px]` (10px) | `text-[10px]` (10px) |

**Rules:**

- Instrument Serif: Display + Headline only.
- Inter Tight: Body.
- JetBrains Mono: Small + Micro (tracking-wide).
- No `text-4xl`, `text-5xl`, `text-7xl`, `text-8xl`, `text-9xl`, or custom `text-[58px]`/`text-[68px]` anywhere in v2. If something feels like it wants one of those, it needs a layout fix, not a type fix.
- Letter-spacing: Display = `tracking-[-0.02em]`, Headline = `tracking-[-0.01em]`, Body = default, Mono = `tracking-[0.15em]`.

---

## 13. Motion Philosophy — Motion Serves Meaning

**Rules:**

1. **No motion decorates.** Every animation either (a) teaches the product (e.g., router pass reveals steps) or (b) provides feedback on an interaction the user just made.
2. **No `whileInView` anywhere.** Content is present on load. Scroll-triggered reveals are a 2019 pattern.
3. **One-time animations only for narrative moments** — the Atlas settles from center on first entry, then stays still.
4. **Hover state budget:** 180ms ease-out. No longer. No scale > 1.02.
5. **Respect `prefers-reduced-motion`:** every animation has a reduced fallback (fade, no translate, no scale).

**Motion inventory for the page:**

| Section | Motion | Duration | Trigger |
|---|---|---|---|
| 01 Hero | First 20 rows fade-in stagger | 400ms total | Load |
| 01 Hero | Row hover lift | 180ms | Hover |
| 01 Hero | Dossier expand | 260ms | Click |
| 02 Atlas | Force settle | 800ms | First scroll-in |
| 02 Atlas | Node hover pulse | 200ms | Hover |
| 03 Memory | Similarity-score pulse | 1s loop @ 10% opacity | Always |
| 04 Router | Stage reveals | 1.5s total | After user click |
| 05 Verify | Pipeline pass animation | 1.2s total | After user click |
| 06 Profiles | None | — | — |
| 07 Pricing | Hover border color | 180ms | Hover |
| 08 CTA | Button glow | 300ms | Hover |

Total motion weight is ~8 distinct animations across the whole page. Current page has ~30+. That compression is itself part of elite-tier polish.

---

## 14. Component Inventory

### New components to build

| Component | Purpose | Est. lines | Location |
|---|---|---|---|
| `StaffDirectory` | Hero agent grid with filter, search, dossier expansion | ~400 | `src/components/landing/StaffDirectory.tsx` |
| `AgentDossier` | Inline/overlay dossier with 3 use cases, sample, CTA | ~180 | `src/components/landing/AgentDossier.tsx` |
| `AtlasGraph` | Force-directed graph of 137 agents + edges | ~300 | `src/components/landing/AtlasGraph.tsx` |
| `MemoryDemoCard` | Live recalled-context card | ~150 | `src/components/landing/MemoryDemoCard.tsx` |
| `RouterPassVis` | Live router pass visualization | ~200 | `src/components/landing/RouterPassVis.tsx` |
| `VerificationDemo` | Textarea + pipeline animation | ~220 | `src/components/landing/VerificationDemo.tsx` |
| `PlaybookProfile` | Single profile card for Section 06 (one per flagship playbook) | ~120 | `src/components/landing/PlaybookProfile.tsx` |

### Reused unchanged

`SovereignLogo`, `PrimaryCTA`, `StatusIndicator`, `CommandEgg`, `Footer` (copied from current page, type tightened).

### Deprecated (removed from landing import graph)

`ThreeMoatsGrid`, `A2EEconomySection`, `MemoryMoat` (old timeline version), `ModelRouterSection` (old version), `VerificationPipeline` (old version), `FeaturedPlaybooksSection`, `ProofStrip`, `LiveProofStrip`, `RecentRunsTicker`.

Deprecated components are **not deleted** in this sprint — they're marked `// @deprecated — removed in landing-v2 cutover 2026-04-22. Safe to delete after 2026-05-22.` Actual deletion lands in a cleanup commit one month post-cutover, in case we need to roll back.

---

## 15. Data Dependencies — What the Landing Requires

The landing cannot ship until these endpoints exist. Full treatment is in the companion gap spec; here's the summary:

| # | Endpoint | Purpose | Status | Effort |
|---|---|---|---|---|
| 1 | `/api/public/catalog` | Hero + Atlas: 137 agents with 30d stats | Missing (catalog endpoint exists but not under `/public/`) | S |
| 2 | `/api/public/atlas-edges` | Atlas: A2E edges between agents | Missing | S |
| 3 | `/api/public/memory-demo` | Section 03: recalled context for demo run | Missing | M |
| 4 | `/api/public/router-demo` | Section 04: live router pass | Missing | M |
| 5 | `/api/public/verify-demo` | Section 05: 5-layer verification on user input | Missing | M |

**Rate limits** (all 5 endpoints): 60 req/min per IP on catalog/edges, 5 req/hour per IP on the demo endpoints. Middleware rule added in `src/lib/rate-limits.ts`.

---

## 16. Safety Plan — Nothing Breaks in Production

1. **Parallel page staging.** New landing is built at `src/app/(landing-v2)/page.tsx` using a route group. Current `src/app/page.tsx` stays the live production homepage the entire build. We optionally expose `(landing-v2)` at `/v2` via a feature-flagged rewrite during development for preview URLs.
2. **One PR per section.** Each of the 8 sections ships as its own reviewable commit. Each commit must be independently TypeScript-clean (`npx tsc --noEmit`), lint-clean (`npm run lint`), test-passing (`npx vitest run`). Any of those 8 can be reverted independently without breaking the others.
3. **Preview URLs.** Vercel automatically creates a preview for every commit. Every section lands on its own preview URL that we visually review on mobile (375px), tablet (768px), desktop (1280px, 1920px) before merging.
4. **Atomic cutover.** When all 8 sections are merged + reviewed + Lighthouse-verified, a single final commit renames `(landing-v2)/page.tsx` → `page.tsx` (and archives the old `page.tsx` as `page.v1.tsx.bak` alongside). If the cutover goes live and looks wrong, `git revert <cutover-commit>` restores the old page in <5 minutes.
5. **No silent deletions.** Every component we stop using gets a `// @deprecated — removed in landing-v2 cutover 2026-04-22` marker before removal from the import graph. Actual file deletion is deferred one month.
6. **Lighthouse budget enforced.** Before each section merges, Lighthouse CI (or manual run) on mobile and desktop must meet: Performance ≥95 mobile / ≥98 desktop, Accessibility ≥95, Best Practices ≥95, SEO ≥95. If a section drops below, we fix before merge.
7. **No breaking data contracts.** Every new `/api/public/*` endpoint ships its handler and route registration in one commit, with a corresponding unit test. If any of the 5 endpoints aren't live, the section that depends on it renders its static fallback — the page never shows a broken state.
8. **Rollback playbook.** Written before cutover. `git revert`, monitor for 15 min, check Sentry for spike, check `/api/health` for degradation. If clean, green-light.

---

## 17. Testing Plan

### Unit tests (vitest)

Each new component ships with a test file at `src/components/landing/__tests__/<Component>.test.tsx`:

- `StaffDirectory.test.tsx` — renders agent rows, filter pills work, search filters correctly, dossier opens on click, keyboard navigation works.
- `AgentDossier.test.tsx` — renders dossier content, handles missing data, CTA links correctly.
- `AtlasGraph.test.tsx` — renders nodes, edges, handles zoom, handles keyboard fallback (tree list).
- `MemoryDemoCard.test.tsx` — renders live data, renders fallback on fetch error, updates timestamp.
- `RouterPassVis.test.tsx` — triggers demo on click, renders stages, handles rate limit response.
- `VerificationDemo.test.tsx` — textarea input, verify button disabled until input, pipeline renders on response.
- `PlaybookProfile.test.tsx` — renders playbook profile card with real run data + "See its agents" expansion.

Target: +7 test files × avg 8 specs = **~56 new unit tests**. Expected total after merge: current ~1,533 → ~1,589.

### Integration tests

- `/api/public/catalog` — returns 137 agents with expected shape.
- `/api/public/atlas-edges` — returns edge list with proper source/target/weight.
- `/api/public/memory-demo` — returns real recall data or graceful null.
- `/api/public/router-demo` — triggers real router, respects rate limit.
- `/api/public/verify-demo` — runs 5-layer pipeline, respects rate limit, redacts input.

### E2E tests (Playwright)

Extend existing `e2e/landing.spec.ts`:

- Hero directory renders 137 agents.
- Clicking any agent row opens its dossier.
- Filter pills narrow the grid correctly.
- Search input filters live.
- Atlas renders without JS errors.
- Memory/Router/Verify sections render their live data OR their fallback.
- Mobile viewport (iPhone 13) renders all sections without overflow.

---

## 18. Timeline — 3 Weeks, 15 Working Days

Aligned with the Month 1 Sprint (`docs/superpowers/specs/2026-04-21-month-1-sprint.md`) — we absorb W2–W4 and extend by one week.

| Week | Days | Scope | Deliverable |
|---|---|---|---|
| **W1** | Day 1 | This spec + gap spec written + committed. User review. | 2 specs in `docs/superpowers/specs/` |
| W1 | Day 2 | Implementation plan via writing-plans skill | Plan doc committed |
| W1 | Days 3–4 | 5 new `/api/public/*` endpoints + tests | All endpoints live, 1 PR |
| W1 | Day 5 | Section 01 — Hero Staff Directory | Preview URL |
| **W2** | Day 6 | Section 02 — The Atlas | Preview URL |
| W2 | Days 7–9 | Sections 03, 04, 05 — live demos | 3 preview URLs |
| W2 | Day 10 | Section 06 — Flagship Playbook Profiles | Preview URL |
| **W3** | Day 11 | Section 07 — Pricing + Founders | Preview URL |
| W3 | Day 12 | Section 08 — Final CTA + Footer | Preview URL |
| W3 | Day 13 | Full QA pass: mobile, tablet, desktop, Lighthouse, a11y, Sentry | Regression report |
| W3 | Day 14 | **Atomic cutover commit**. Production deploys. | Live |
| W3 | Day 15 | Monitor + hotfix buffer | Stable |

---

## 19. Out of Scope (Explicitly)

- **`/platform` palette conversion.** Flagged as an open question (§21). Decision before cutover but not part of this spec.
- **Per-vertical SEO deepening** (`/for-healthcare` expansion). Tier 3.
- **I18n / localization.** Tier 3.
- **Light mode toggle.** Tier 3.
- **Multi-agent chain builder UI.** Tier 3.
- **Video assets in hero.** Not needed; directory is the hero.
- **Agency client dashboard / multi-tenant branding.** Separate project.
- **MCP server enhancements.** Separate project.

---

## 20. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `/api/public/memory-demo` reveals sensitive tenant data | Medium | Public demo tenant, server-side anonymization, content review before launch |
| Atlas graph perf on low-end mobile (137 nodes + edges) | Medium | Canvas render + LOD (hide edges at low zoom), tested on low-end device |
| Lighthouse mobile drops below 95 with new bundle | Medium | Bundle budget enforced per section merge; code-split Atlas + VerificationDemo |
| User hates character names (Apex, Velox, Scribe) | Low | Names are additive — functional slugs stay; we swap in a later commit if rejected |
| Cutover reveals latent bug in deprecated component still imported somewhere | Low | Full `grep` pass before cutover for old component names; each deprecated file has a `@deprecated` marker scanning step |
| Real sample outputs age / go stale | Low | Build-time warning if any curated run is >30 days old; monthly refresh cadence |

---

## 21. Open Questions — User Decision Needed

1. **`/platform` palette.** Currently editorial cream (`#F4EFE6`). Convert to dark `#030303` for consistency with v2, or keep as intentional developer-audience split? Recommendation: **convert to dark.** Rationale: landing v2 is the entry point for everyone (operators and devs); a different palette one click away feels like two companies.

2. **Hero headline — pick one:**
   - `Meet the 137 agents.` (recommended)
   - `137 agents. Hired and waiting.`
   - `The agents your business should have hired.`

3. **Playbook character names — Apex / Velox / Scribe — or functional slugs only?** Character names give editorial weight to Section 06 and future marketing collateral without touching code. Recommendation: **use character names in Section 06 only**, functional slugs (`lead-blitz`, `competitor-takedown`, `content-machine`) remain the system-of-record everywhere else.

4. **Profile photos / monograms for Section 06?** We can commission tight editorial monogram illustrations (~$200 each × 3 = $600, 2-week turn) or use typographic-only treatments (free, ships Day 11). Recommendation: **typographic-only for launch**, commission later.

5. **Public memory demo tenant.** We need one (or more) consented demo tenant with real, public-safe run data. Do you want to create a dedicated `sovereign-public-demo` tenant and seed it, or reuse a founder tenant with a flag?

---

## 22. Definition of Done

- [ ] Section count: 10 → 8.
- [ ] `src/app/(landing-v2)/page.tsx` atomically renamed to `src/app/page.tsx` on cutover.
- [ ] Old `page.tsx` archived as `page.v1.tsx.bak`.
- [ ] 9 components deprecated + marked; 7 new components shipped.
- [ ] 5 new `/api/public/*` endpoints live, each with unit + integration tests.
- [ ] 56+ new unit tests added.
- [ ] Playwright E2E tests updated and passing.
- [ ] Lighthouse mobile ≥95, desktop ≥98.
- [ ] WCAG 2.2 AA audit passes (contrast, keyboard, focus order, aria labels).
- [ ] Sentry shows no new error class 24h post-cutover.
- [ ] Rollback playbook tested in staging.
- [ ] All 5 open questions in §21 resolved.
- [ ] User has reviewed and approved this spec + the companion gap spec.
