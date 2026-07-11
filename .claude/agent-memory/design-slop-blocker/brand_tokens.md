---
name: Brand color & accent vocabulary
description: Sovereign Matrix dual-accent rule — copper for marketing/agency surfaces, cyan for audit/infra; emerald/violet/pink/blue/amber are slop in this codebase
type: project
---

The Sovereign Matrix design system has exactly two brand accents — confirmed by `docs/design-system/brand-colors.md` and enforced by `<SectionDivider accent="copper|cyan">` in `src/components/landing/`.

**Why:** Dual-accent rule is the brand's most distinctive aesthetic signal. Landing uses it consistently (copper hero, copper playbooks, cyan verification pipeline, cyan trust). Every non-landing surface I audited 2026-05-15 had palette pollution (emerald CTAs on /trust + /pricing, rainbow gradient cards on /agents + /dashboard).

**How to apply:**

- Marketing surfaces (landing, for-\*, pricing, agency pages, footer): copper `#B5532C` for accent. Use the `PrimaryCTA` variant=hero from `src/components/landing/PrimaryCTA.tsx`.
- Audit/infra surfaces (trust, security, spec, explorer, dashboard monitoring, dashboard security): cyan-300/500 with low-alpha border (`text-cyan-300 border-cyan-500/30`). Never solid `bg-cyan-500 text-black` pills — that pattern reads as Webflow template, not Sovereign.
- Background base: `#030303` (landing) or `#010101` (other surfaces). Both acceptable but pick one per surface.
- Glass panel surface: `border-white/[0.06] bg-white/[0.025]` with `inset 0 1px 0 rgba(255,255,255,0.08)` shadow.
- Banned-without-justification: `bg-emerald-500`, `bg-violet-500`, `bg-pink-500`, `bg-purple-500`, `bg-amber-500`, `bg-rose-500`, `from-X-500 to-Y-500` gradient text/buttons (the rainbow slop signature).
- Status colors (pass/warn/fail dots in audit posture lists) are the one exception — emerald/amber/rose can appear as status indicators, never as primary brand actions.

**Token reality (Tailwind v4 — verified 2026-07-11):** `brand-colors.md` tells you to use `text-copper` / `text-cyan` tokens "mapped in tailwind.config.ts". That is stale. There is **no `tailwind.config.ts`** (v4 project) and the `@theme` block in `globals.css` defines **neither `--color-copper` nor a `--color-cyan` DEFAULT** — only `--color-electric-blue: #00b7ff`. So `text-copper`/`text-cyan` are **undefined utilities that render no color**. The `/anthropic` and `/learning` editorial templates therefore hand-hex copper as `text-[#B5532C]` / `style={{ color: "#B5532C" }}`, and that is currently **correct** — do NOT "fix" hard-coded `#B5532C` to `text-copper` (it silently drops the accent). The doc's anti-hex slop rule cannot be honored until someone adds `--color-copper`/`--color-cyan` to `@theme`; treat that as a separate codebase-wide task, not a per-page defect. (Standard Tailwind `cyan-300/500` etc. DO exist — those are the default scale, not the custom token.)
