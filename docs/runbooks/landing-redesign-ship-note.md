# Landing Redesign — Ship Note

**Status:** Code-complete on `claude/wizardly-benz`. Ready to merge with
the rest of the branch on Week 1 deploy day.

**Commits (7, chronological on the branch):**

| # | SHA | Title |
|---|---|---|
| spec | `f5b9f189` | docs(landing): design spec for L2 redesign |
| 1/7 | `9ee36ce3` | hero tightening (type -1 step, kill A2EGraph, opacity 22%) |
| 2/7 | `1dc07a56` | RecentRunsTicker + public endpoint |
| 3/7 | `a24b04a6` | motion strip-back below the fold |
| 4/7 | `aff87708` | ProofStrip (consolidates 3 old sections) |
| 5/7 | `d41910c9` | global typography pass |
| 6/7 | `450c58f3` | PricingStrip + FinalCTA polish |
| 7/7 | *this doc* | ship note |

---

## Before / After

| Metric | Before | After |
|---|---|---|
| Landing page sections | 10 | 7 |
| Motion components (`motion.*`) below fold | 11 | 0 |
| Hero headline largest size | `text-9xl` | `text-8xl` |
| ConstellationField + A2EGraph combined opacity | ~85% | 22% |
| `page.tsx` lines | 1,073 | 916 |
| Deleted functions | — | `IndustrySection`, `PlatformScale`, `SCALE_METRICS` |
| Deleted component usages | — | `<StackKiller />`, `<A2EGraph />` |
| New components | — | `RecentRunsTicker`, `ProofStrip` |
| New API endpoints | — | `GET /api/public/recent-runs` |

**Tests:** 1533 → 1537 (+4 for `/api/public/recent-runs`)
**TypeScript:** 0 errors
**Lint:** 0 errors on changed files

---

## What to watch after deploy

1. **Landing Lighthouse mobile score.** Target ≥ 92. The drop in
   motion + the removed imports (A2EGraph, StackKiller) should push
   JS eval time down measurably.
2. **CTA click-through on "Run a Free Playbook"** (tracked via
   `trackCtaClick("hero")` + PostHog). Expect a conversion lift from
   the single-line sub-headline + smaller hero — but the A/B is worth
   running if you want hard numbers.
3. **`RecentRunsTicker` render state.** On Day 1 it hides (no runs
   yet). On Day 3-4, expect it to start populating as founder-program
   users run playbooks. If you see the ticker showing the SAME run
   for 4+ seconds longer than the rotation should, check the
   `runs.length > 1` rotation guard in the component.
4. **ProofStrip link CTRs.** The 8 industry chips and 4 metric cards
   are all tracked links. If an industry isn't getting ANY clicks,
   that's signal that the vertical isn't resonating — fine to remove
   in a future pass.

---

## Rollback (if needed)

Any single commit reverts independently:

```bash
# e.g. if the ProofStrip feels wrong
git revert aff87708

# or roll back the whole redesign
git revert 450c58f3^..9ee36ce3
```

Because each commit is atomic and tested, partial reverts (e.g. keep
the hero tightening but undo ProofStrip) are safe.

---

## What's still untouched (intentional)

- `ThreeMoatsGrid`, `A2EEconomySection`, `MemoryMoat`,
  `ModelRouterSection`, `VerificationPipeline`,
  `FeaturedPlaybooksSection`, `FounderSeats` — all kept as-is. They
  each do one job well.
- `TiltCard` on playbook cards — kept because it reads as product
  demo, not decoration.
- `CommandEgg` — easter egg, not in scope.
- Hero entrance animations — kept because the tone of the whole page
  is set in the first 800ms.

---

## Next after this ships

Per the 3-month roadmap (`docs/superpowers/specs/2026-04-21-3-month-roadmap.md`):

- **M1 W1** — Deploy `claude/wizardly-benz` to production (see
  `docs/runbooks/week-1-master-deploy.md` for the 10-phase checklist).
- **M1 W3** — Founder program outreach. The new landing should help
  here by reading more premium.
- **M2 W5** — Computer Use expansion (Lane 3 from the earlier plan).

The landing redesign shipping does NOT block deploy. Both go together
in the same Week 1 merge.
