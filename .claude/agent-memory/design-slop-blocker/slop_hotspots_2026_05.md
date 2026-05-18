---
name: Recurring slop hotspots
description: Patterns of AI-generated-looking UI that keep reappearing in the Sovereign codebase
type: feedback
---

Recurring slop patterns observed in src/app/:

1. **Templated vertical pages** — src/app/for-\*/page.tsx are near-identical clones: same nav, same 5-card PRIMITIVES grid, same 3 USE_CASES, same 8-row COMPLIANCE checklist, same final CTA panel. Diff between for-banking and for-defense is ~90% color + verb swap. Reads as AI-generated.

2. **Off-brand accent colors** — for-insurance uses violet-400, for-pharma uses emerald-400, pricing uses emerald + teal + cyan + blue gradients. Brand is cyan + copper only.

3. **Stat inconsistency on the landing** — page.tsx hero says "140 agents", InvestorSignalStrip says "140", but PlatformScale SCALE_METRICS[0].n says "137" and FAQS[0] says "137 autonomous agents". Trust is built by consistency.

4. **Generic rainbow-gradient CTAs on pricing** — `bg-gradient-to-r from-emerald-500 to-teal-500` and `from-cyan-500 to-blue-500` on the buttons. Slop tell.

5. **Section-numbering says 10/10 but copy says "Eight industries"** — n="08" sections, "Three workflows landing on day one", etc. all stack against the SectionHead's `{n} / 10` convention without anyone checking the total.

**Why:** This codebase ships fast and these templated/inconsistent surfaces are how AI authorship leaks through to the reader. The brand promise is "verifiable, audit-grade" — sloppy copy and color drift contradict the thesis at first glance.

**How to apply:** When reviewing landing/vertical/pricing surfaces, scan for: (a) accent colors not in {cyan, copper, white, neutral}, (b) repeated stat values that drift across sections, (c) vertical pages that share a structural template instead of having a distinct hero shape, (d) gradient buttons that look like every other SaaS.
