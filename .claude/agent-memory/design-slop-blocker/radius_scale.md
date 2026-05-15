---
name: Radius scale rule
description: Allowed border-radius values in Sovereign Matrix — rounded-2xl and rounded-3xl are banned
type: project
---

Sovereign Matrix uses a tight, intentional radius scale. Anything outside this list is slop.

**Why:** Landing uses bracket-syntax pixel radii (`rounded-[3px]`, `rounded-[4px]`, `rounded-[6px]`, `rounded-[10px]`) for an editorial-software feel — Linear / Vercel / Stripe radius vocabulary, not Bootstrap. Non-landing pages use `rounded-xl` / `rounded-2xl` / `rounded-3xl` everywhere, which softens the brand into generic-SaaS territory. Confirmed across `trust/page.tsx`, `agents/page.tsx`, every `/for-*` page (2026-05-15 audit).

**How to apply:**

Allowed radii:

- `rounded-[3px]` — buttons, tags, kbd elements, small status badges
- `rounded-[4px]` — primary CTAs, mid-size buttons
- `rounded-[6px]` — cards (the main card radius on landing)
- `rounded-[10px]` — large panels, final-CTA shell, hero cards
- `rounded-full` — only for: status pill dots, avatar/logo containers, the kbd `/` indicator
- `rounded-px` / `rounded-none` — okay when intentional

Banned (treat as slop):

- `rounded-xl` — too generic Tailwind-default; replace with `rounded-[6px]`
- `rounded-2xl` — pervasive on non-landing pages; replace with `rounded-[6px]` or `rounded-[10px]`
- `rounded-3xl` — softens brand into Webflow territory; replace with `rounded-[10px]`
- `rounded-lg` / `rounded-md` — generic; pick the bracket value instead

If you see `rounded-2xl` or `rounded-3xl` during review, flag it. There is no legitimate use of those in this codebase.
