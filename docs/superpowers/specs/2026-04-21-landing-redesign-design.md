# Landing Page Redesign — Design Spec

**Status:** Proposed — awaiting user review before implementation.
**Date:** 2026-04-21
**Target file:** `src/app/page.tsx` (1,073 lines currently) + supporting
landing components under `src/components/landing/`.

---

## 1. Goal

Elevate the first-touch impression from "capable but busy" to "inevitable
and precise." Match the perceived quality of Linear, Vercel, and Anthropic
without sacrificing the Sovereign brand DNA (copper #B5532C, editorial
serif, dark mode).

Specifically:

- **Cut visual noise.** Current page has 10 numbered sections + 7+ cinematic
  components (ConstellationField, A2EGraph, TiltCard, particles, etc.).
  It reads as "maximalist." Target: 5–6 sections, each doing one job.
- **Tighten typography.** Hero drops a type size. Body text shrinks one
  step but gains letter-spacing precision.
- **Add one "live proof" element** to differentiate from static competitor
  pages — but cap it so the bundle doesn't bloat.
- **Ship same day.** No new media assets required.

---

## 2. Chosen Direction

**A base (operator's terminal) + selective live-proof element from C.**

What we keep from A:
- Strip 4 redundant sections (StackKiller as standalone, IndustrySection
  standalone, PricingStrip standalone, PlatformScale standalone) →
  consolidate into two new denser "proof" blocks.
- Kill `useHideyNav` — the nav stays pinned so readers never lose navigation.
- Drop `A2EGraph` backdrop at hero (duplicative with ConstellationField).
- Halve ConstellationField opacity (45% → 22%).
- No `whileInView` animations below the fold (prefer static content).
- Instrument Serif drops one step at hero (`text-9xl` → `text-8xl`).

What we borrow from C:
- **LiveProofStrip** (already exists) gets *one* new row below it: a
  rolling ticker of the last 5 real playbook completions, pulled from
  `/api/playbooks/runs`. If the endpoint returns empty, the ticker
  gracefully hides (no "fake activity" problem).
- **No** interactive cost estimator (deferred — belongs in `/pricing`).
- **No** embedded `/world` mini-constellation (deferred — too heavy for
  first paint).

---

## 3. Section Map — Before vs. After

| # | Current | After | Change |
|---|---------|-------|--------|
| 1 | Hero | Hero (tighter) | Typography shrinks one step, drops A2EGraph backdrop, constellation opacity halved, sub-headline shortened to one line |
| — | LiveProofStrip | LiveProofStrip + NEW RecentRunsTicker | Small addition |
| 2 | ThreeMoatsGrid | ThreeMoatsGrid | Unchanged |
| 3 | A2EEconomySection | A2EEconomySection | Unchanged, but internal padding reduces `py-28` → `py-20` |
| 4 | MemoryMoat | MemoryMoat | Unchanged |
| 5 | ModelRouterSection | ModelRouterSection | Unchanged |
| 6 | VerificationPipeline | VerificationPipeline | Unchanged |
| 7 | FeaturedPlaybooks | FeaturedPlaybooks | Unchanged |
| 8 | IndustrySection | **Merged into new "ProofStrip" with stats + industries** | Consolidated |
| — | StackKiller | **Removed** — already covered by ThreeMoats + Pricing | Cut |
| 9 | PlatformScale | **Merged into ProofStrip** | Consolidated |
| 10 | PricingStrip | PricingStrip (tightened) | One-sentence explanation removed; pricing pills become denser |
| — | FounderSeats | FounderSeats | Unchanged |
| — | FinalCTA | FinalCTA (tightened) | Drops the sub-badge, keeps just headline + 2 buttons |
| — | Footer | Footer | Minor type-size polish |
| — | CommandEgg | CommandEgg | Unchanged |

**Net:** 10 → 7 distinct sections. The deleted sections migrate their
content into the new `ProofStrip` block, which is a two-column layout:
[platform scale metrics] on the left, [8 industry tags] on the right.
One section doing the work of three.

---

## 4. Typography — Before vs. After

| Element | Current | After | Rationale |
|---|---|---|---|
| Hero headline | `text-5xl sm:text-7xl md:text-8xl lg:text-9xl` | `text-5xl sm:text-6xl md:text-7xl lg:text-8xl` | Shrinks one step across every breakpoint. Linear-like restraint. |
| Hero leading | `leading-[1.02]` | `leading-[1.04]` | Slightly more air — avoids the "wall of type" feeling. |
| Section heads | `text-4xl md:text-6xl lg:text-[68px]` | `text-3xl md:text-5xl lg:text-[58px]` | Same one-step shrink. Lines read as headers, not posters. |
| Body copy | `text-[17px] md:text-[19px]` | `text-[15px] md:text-[17px]` | Denser; matches the editorial aesthetic. |
| Mono labels | `text-[10px] tracking-[0.2em]` | Unchanged | Already precise. |

---

## 5. Motion Philosophy

**Before:**
- Every section has `whileInView` slide-in on scroll.
- Nav hides on scroll-down, reappears on scroll-up.
- ConstellationField animates aggressively (proximity lines at full opacity).
- TiltCard 3D hover on every playbook card.

**After:**
- Hero retains its 5 existing entrance animations (they set the tone).
- Below-the-fold: **no entrance animations**. Content is present on load.
- Nav: **always pinned**. Kill `useHideyNav`.
- ConstellationField: opacity cap at 22%. Line alpha multiplier 0.5×.
- TiltCard: keep on playbook cards only. Everywhere else → static.
- Hover micro-interactions (button glow, link underline sweep): keep.

**Why:** scroll-triggered animations feel polished on first visit but
become friction on the 2nd/3rd. Linear/Vercel made this call years ago.

---

## 6. New Component: `RecentRunsTicker`

Place: `src/components/landing/RecentRunsTicker.tsx`

Shape: a single row below `LiveProofStrip`, ~40px tall, showing a
rolling list of the last 5 real playbook completions.

```
┌─────────────────────────────────────────────────────────────┐
│ ●  3 min ago · Lead Blitz found 12 prospects · London SaaS │
└─────────────────────────────────────────────────────────────┘
  (rolls every ~4s)
```

Source: `GET /api/playbooks/runs?limit=5&status=done` (already exists).
If the response is empty OR returns a network error, the component
returns `null` — no fake activity.

Privacy: anonymize user details server-side. Only show:
- How long ago (`3 min ago`)
- Playbook name
- A count or headline number from the result (existing `summary` field)
- Optionally a generic location (city only, never precise)

Animation: copper pulse dot + framer-motion `AnimatePresence` for the
slide-out/in transitions. ~50 lines of TSX total.

---

## 7. New Component: `ProofStrip` (consolidates 3 old sections)

Place: `src/components/landing/ProofStrip.tsx`

Replaces: `IndustrySection`, `PlatformScale`, `StackKiller`.

Layout: two-column (stacks on mobile):

```
┌────────────────────────────────┬───────────────────────────┐
│  137  Agents                   │   Healthcare  Legal       │
│  90+  Integrations             │   Agriculture  Manuf.     │
│  8    Model providers          │   Cybersecurity  Fintech  │
│  5    Verification layers      │   Real Estate  Government │
│                                │                           │
│  Each clickable → /platform    │   Each clickable → /for-* │
└────────────────────────────────┴───────────────────────────┘
```

Single section, single tone, no nested animations. ~80 lines vs. the
current ~170-line combination.

---

## 8. Information Architecture Wins

**Before:** 10 section headers, 7 major CTAs, 5 hover-animated card
variants, 3 different nav states (hidden, visible, scrolled).

**After:** 7 section headers, 4 major CTAs, 2 card variants, 1 nav
state (pinned).

Numerical reduction == cognitive load reduction == conversion lift.

---

## 9. What Doesn't Change

- Copper #B5532C accent. Full palette untouched.
- Instrument Serif + Inter Tight + JetBrains Mono stack.
- Dark mode `bg-[#030303]`.
- Playbook tiles stay with their current TiltCard treatment.
- Memory Moat, Model Router, Verification Pipeline blocks — all strong,
  all stay.
- `/marketplace`, `/world`, `/agents/[slug]` — not in scope. Only the
  landing.

---

## 10. Rollout Plan

1. **Section 1** — Hero tightening + A2EGraph removal. Commit.
2. **Section 2** — `RecentRunsTicker` component + wire below `LiveProofStrip`. Commit.
3. **Section 3** — Motion strip-back (remove `whileInView` below fold, kill `useHideyNav`, tune ConstellationField opacity). Commit.
4. **Section 4** — `ProofStrip` component + delete StackKiller import + remove PlatformScale + IndustrySection wiring. Commit.
5. **Section 5** — Typography pass (global size adjustments via `page.tsx` class edits). Commit.
6. **Section 6** — PricingStrip + FinalCTA polish. Commit.
7. **Final** — Full-suite test, TS, lint, commit a runbook note.

Each of those 7 commits is independently reversible. Rollback is `git
revert <commit>` and the page stabilizes to the previous state.

---

## 11. Risks

- **Fragmented visual coherence** if we don't land all 7 commits — e.g.,
  keeping old typography with new section layout looks worse than
  either endpoint. Mitigation: commits 1 + 5 (hero + typography) are
  "phase 1," commits 2–4 are "phase 2." Ship phase 1 before starting
  phase 2 if time is short.
- **`RecentRunsTicker` showing nothing on fresh deploy.** By design — it
  returns null when no runs exist. Looks worse if a user expects it
  but it's gone. Mitigation: the ticker is optional; LiveProofStrip
  above stays populated from the static stats.
- **A/B delta unclear** without instrumentation. PostHog events are
  already wired (see Plan 4); we don't need new analytics. The
  existing `trackCtaClick` on hero CTAs will surface the conversion
  delta within 48h of traffic.

---

## 12. Testing Plan

- No new unit tests needed for the page edits (they're purely visual).
- `RecentRunsTicker` gets a unit test: renders the list, hides on empty
  response, hides on fetch error.
- `ProofStrip` gets a unit test: renders all 4 metrics + 8 industries,
  links are correct.
- Full `npx tsc --noEmit` pass after each commit.
- Full `npx vitest run` pass after each commit.
- Manual screenshot review on mobile (375px), tablet (768px), desktop
  (1280px+).

---

## 13. Out of Scope (explicitly)

- Video assets in the hero (requires production).
- Bento grid (Direction B).
- Interactive cost estimator (belongs in `/pricing`, not landing).
- Embedded `/world` mini-constellation (too heavy for first paint).
- Pricing page redesign.
- Dashboard layout changes.

---

## 14. Definition of Done

- `page.tsx` section count: 10 → 7.
- `useHideyNav` import removed from `page.tsx`.
- `A2EGraph` no longer referenced from `page.tsx`.
- `RecentRunsTicker` live and either rendering or gracefully hiding.
- `ProofStrip` replaces the 3 consolidated sections.
- All hero type sizes shifted one step smaller.
- All `whileInView` calls below the fold replaced with static render.
- ConstellationField opacity = 22%.
- Tests: 1533 → 1533+n (n = 2 for new components).
- TypeScript: 0 errors.
- Lint: 0 errors.
