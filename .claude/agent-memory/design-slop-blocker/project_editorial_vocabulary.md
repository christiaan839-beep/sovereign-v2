---
name: Editorial Museum CSS vocabulary
description: The custom CSS classes (ed-*) that define the Sovereign editorial aesthetic on bone-cream surfaces. Use these instead of ad-hoc Tailwind on editorial pages.
type: project
---

The editorial aesthetic uses a custom CSS class vocabulary (defined in globals or an editorial.css), applied inside `<div className="editorial-light">` wrappers. Key classes seen in the wild:

- `ed-page`, `ed-max`, `ed-grid-12` — layout primitives
- `ed-display`, `ed-display-italic` — Instrument Serif headline + italic variant
- `ed-body`, `ed-caption`, `ed-label` — Inter Tight hierarchy
- `ed-mono` — JetBrains Mono for data/indices
- `ed-copper` — the #B5532C accent (serves as the ONLY color accent on editorial pages)
- `ed-rule`, `ed-rule-soft` — CSS-var border colors
- `ed-ink`, `ed-ink-soft`, `ed-ink-dim` — text hierarchy via CSS vars
- `ed-enter ed-d-1..5` — staggered fade-in animation utilities
- `ed-fade-in` — simple fade utility

**Why:** These classes exist so editorial pages stay monolithic visually — one serif, one mono, one sans, one accent. Inline Tailwind gradient/color utilities on editorial pages break the system.

**How to apply:**
- When writing new editorial surfaces, use the `ed-*` classes + inline style for clamp() sizes, NOT Tailwind color utilities.
- When unifying a slop page (e.g. pricing) to the editorial system, replace: Tailwind gradients → `ed-copper` underline rule; Tailwind text colors → `style={{ color: "var(--ed-ink-soft)" }}`; Tailwind fonts → `ed-display` / `ed-body`.
- Reference implementations: `/src/app/built-with-claude/page.tsx`, `/src/app/trust/page.tsx`, `/src/app/roi/page.tsx`, `/src/app/dashboard/nexus/page.tsx`.
