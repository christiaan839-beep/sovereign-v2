---
name: Two design languages in Sovereign codebase
description: Editorial-light (cream/copper/Instrument Serif) vs dark-dashboard (emerald/cyan/violet glass). Dashboard pages drift into generic SaaS slop.
type: project
---

The codebase runs two visual systems side-by-side:

1. **Editorial Museum** — `/built-with-claude`, `/trust`, `/roi`, `/dashboard/nexus`. Uses `editorial-light` class, `ed-display` / `ed-display-italic`, Instrument Serif, #B5532C copper, asymmetric 12-col grid. This is the Sovereign voice.
2. **Dark-dashboard slop** — most `/dashboard/*` pages. Uses `bg-[#0A0A0A]` (drift from spec `bg-[#030303]`), rotating emerald/cyan/violet border tints on `rounded-2xl` stat cards, gradient CTAs (`from-emerald-500 to-teal-500`), Lucide icon in gradient tile headers.

**Why:** Editorial pages were rebuilt from scratch in v7; dashboard pages still carry late-2025 aesthetic patterns that were copy-pasted across files.

**How to apply:**
- When reviewing or building any dashboard/pricing/landing page, audit whether it matches the editorial vocabulary or reverts to generic dark-mode SaaS chrome.
- Flag these specific patterns as slop when found on Sovereign surfaces:
  - `bg-[#0A0A0A]` (use `bg-[#030303]`)
  - 3-column stat grids with rotating cyan/emerald/violet border tints (consolidate to single accent)
  - `bg-gradient-to-r from-emerald-500 to-teal-500` CTAs (replace with editorial bone/copper button)
  - Uppercase emerald pill above an h1 that says the same word (redundant ornament)
  - Hover-glow radial blur blobs in brand colors (decorative, no purpose)
- `/src/app/pricing/page.tsx` is the worst offender of language-mixing — editorial hero over SaaS-template cards. Rebuilding the tier grid with editorial vocabulary is the highest-leverage unification target.
