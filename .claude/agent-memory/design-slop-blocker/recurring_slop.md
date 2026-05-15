---
name: Recurring slop signatures in Sovereign Matrix
description: Two AI-generated patterns that keep reappearing on non-landing surfaces — flag them on every review
type: feedback
---

When auditing this codebase, two slop signatures show up on nearly every non-landing page. They are the first thing to grep for on any UI review.

**Why:** Audit on 2026-05-15 found both patterns on `/trust`, `/agents`, every `/for-*` vertical landing, and most of `/dashboard`. They are the primary reason those surfaces feel like a different product than the (premium) `/` landing.

**How to apply:**

1. **`font-black tracking-tight` H1** — every non-landing page uses Inter `font-black` instead of `font-serif` (Instrument Serif). Examples: `trust/page.tsx:88`, `agents/page.tsx:190`, `for-banking/page.tsx:141`. Brand H1 is always Instrument Serif at `font-serif text-4xl md:text-6xl leading-[1.05] tracking-[-0.02em]`. If you see `font-black` in a hero H1, that's slop — flag and fix.

2. **Solid pill CTAs in non-brand colors** — `bg-cyan-500 text-black`, `bg-emerald-500 text-black`, `bg-white text-black` rounded-full. Looks like a Webflow / generic-SaaS template. Sovereign vocabulary is:
   - Marketing primary: copper `bg-[#B5532C]` rectangular `rounded-[3px]` or `rounded-[4px]` (see landing nav CTA `page.tsx:311-330`)
   - Marketing hero CTA: `<PrimaryCTA variant="hero">` from `src/components/landing/`
   - Final-CTA: `bg-white text-[#030303] rounded-[4px]` (rectangular, not pill)
   - Audit/infra: ghost cyan `text-cyan-300 border-cyan-500/30 bg-cyan-500/10`, never solid
   - Secondary action: ghost outline `border-white/[0.12] text-neutral-400`

Adjacent slop to watch for:

- Rainbow `from-X-500/20 to-Y-700/5` gradient backgrounds on card grids (worst on `agents/page.tsx:50-62` `CATEGORY_COLOR` map, and `dashboard/page.tsx:98-131` tour cards).
- `rounded-2xl` / `rounded-3xl` — banned by the radius scale (see radius_scale.md).
- Per-page bespoke navs that don't import `SovereignLogo` and don't carry the copper "Run Free Agent" CTA.
