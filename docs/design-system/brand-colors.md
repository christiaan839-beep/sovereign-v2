# Sovereign brand colors — dual-accent rule

Sovereign uses **two** accent colors. They are not interchangeable, and
mixing them on the same page is a slop signal. Pick the surface, then
pick the accent.

| Token      | Hex                               | Use where                                           | Avoid where                                      |
| ---------- | --------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| **Cyan**   | `#00B7FF`                         | Audit, verification, infrastructure, status, proofs | Marketing CTAs on agency-positioning pages       |
| **Copper** | `#B5532C`                         | Marketing, agency pricing, conversion CTAs          | Anything inside `/verified`, `/spec`, `/audit-*` |
| Foreground | `#FFFFFF`                         | Primary text                                        | —                                                |
| Muted      | `#A3A3A3`                         | Secondary text (neutral-400)                        | —                                                |
| Background | `#050505`                         | Default page background                             | —                                                |
| Surface    | `bg-white/5` + `backdrop-blur-xl` | Cards, modals, nav rails                            | —                                                |
| Border     | `border-white/10`                 | All borders, default                                | Glow-style accent borders (use accent alpha)     |

## Why two accents

The product spans two distinct positionings:

1. **Audit-grade infrastructure** — verifiable receipts, OpenTimestamps,
   inclusion proofs, the VAOS standard, SOC2 controls map, /verified
   public pages. Buyer: compliance officer, security lead, lawyer.
   Visual language: technical, clinical, **cyan**.

2. **Agency / operator marketing** — pricing, landing-page hero,
   playbook positioning, demo-call CTAs, founders-club copy. Buyer:
   operator who wants to ship agents fast. Visual language: warm,
   bold, **copper**.

Trying to unify the two destroys the lawyer-credible aesthetic for the
audit surface AND the warmth of the marketing surface. Keep them
distinct, and make the rule legible.

## The rule

> If the page proves something, use cyan.
> If the page sells something, use copper.

Concrete:

- `/`, `/pricing`, `/founders`, `/agency`, `/playbooks/*` → **copper**
- `/verified/*`, `/spec`, `/audit-bundle`, `/dashboard/audit-*`,
  `/api/me/audit-*` UI surfaces → **cyan**
- Dashboard chrome (sidebar, top bar) → **cyan** (it's the operating
  surface, not marketing)
- 404 page, generic error pages → **cyan** (system surface, not pitch)
- CTAs inside cyan surfaces → cyan-on-dark or white-on-cyan, never
  copper
- CTAs inside copper surfaces → copper-on-dark or white-on-copper,
  never cyan

When you have a page that straddles (e.g., the marketing page links
out to a verified receipt) — the page accent stays the surface accent,
and the link to the other surface uses **its** accent. The user's eye
learns that "color = which kind of page you're going to."

## Tailwind tokens

Both accents are already mapped in `tailwind.config.ts`:

```ts
// excerpt — do not duplicate, just reference
colors: {
  cyan: { DEFAULT: "#00B7FF", glow: "#00B7FF80" },
  copper: { DEFAULT: "#B5532C", glow: "#B5532C80" },
}
```

Reach for `text-cyan`, `bg-cyan/10`, `border-copper/20`, etc. — never
hand-hex `#00B7FF` or `#B5532C` in component code. The tokens exist so
a future color tweak is one line, not 32 files.

## Cinematic effects

- Page-level glow blobs use the **surface** accent at 5–10% alpha,
  blur ≥ 100px, behind a `relative z-10` content container.
- `cta-glow` class works for both accents — it reads
  `currentColor` so the CTA's text-color drives the glow.
- All glows respect `prefers-reduced-motion` and disable on mobile.

## Auditing for slop

If you see any of these patterns, fix them:

- ❌ Copper button on `/verified/*` — wrong surface.
- ❌ Cyan button on `/founders` — wrong surface.
- ❌ Both accents on the same fold — pick one.
- ❌ Generic indigo/blue/purple — we use cyan only; the gradient on the
  landing CTA (`from-[#00B7FF] to-[#a855f7]`) is the one sanctioned
  exception (it's the brand mark, not a body element).
- ❌ Hard-coded `#00B7FF` or `#B5532C` in component code — use the
  Tailwind token.

## History

- **v0** (Jan 2026): single copper accent. Worked for marketing,
  felt wrong inside the audit dashboard.
- **v1** (Mar 2026): added cyan for verification surfaces. Coexisted
  inconsistently for ~6 weeks.
- **v2** (May 2026, this doc): codified dual-accent rule. Both
  preserved; usage gated by surface type.
