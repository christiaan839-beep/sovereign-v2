---
name: Landing primitives library
description: Editorial components in src/components/landing/ that should be re-used on every non-landing surface to keep brand cohesion
type: reference
---

The landing page (`src/app/page.tsx`) achieves its premium feel via a small library of editorial primitives. None of these are imported by `/trust`, `/agents`, `/dashboard`, `/pricing`, or `/for-*` pages as of 2026-05-15 — that's the primary reason those surfaces feel like a different product.

Primitives (all under `src/components/landing/`):

- `SectionHead` — `01 / 10` font-mono numeral + dash + italic serif label. Defined locally in `page.tsx` (lines 209-221) but trivially extractable.
- `SectionDivider` — accent-aware section break, `accent="copper|cyan"`.
- `FilmGrain` — sub-3% alpha analog texture overlay. Already client-only, respects reduced-motion.
- `PrimaryCTA` — landing's primary CTA component with hero/inline variants.
- `TiltCard` (from `src/components/ui/EliteEffects.tsx`) — 3D tilt + inset highlight, used on playbook cards.
- `HeroProofPill` — live receipt-id pill, fetches `/api/agent-runs/latest-public` on mount.
- `StatusIndicator` — system status badge used in footer.

Shared shell components that don't exist yet but should:

- `<MarketingNav />` — the landing nav (logo + 6 NavLinks + ghost log-in + copper "Run Free Agent"). Currently inlined in `page.tsx:223-395`; every other public page has its own stripped-down nav.
- `<MarketingFooter />` — same story for the landing footer.
- `<VerticalLandingShell />` — extract the for-banking template so for-utilities + for-clinical-trials + 14 other /for-\* pages share one source.
