---
name: Typography system
description: Three-font editorial stack used by Sovereign Matrix landing — Instrument Serif headlines, Inter Tight body, JetBrains Mono micro-labels
type: project
---

Sovereign Matrix runs an editorial three-font stack on the landing page. Every non-landing surface that wants to feel like the same product must adopt it.

**Why:** The Instrument Serif + Inter Tight + JetBrains Mono combination is half of what makes the landing feel like premium magazine work instead of a SaaS template. Non-landing pages (`/trust`, `/agents`, every `/for-*`, `/dashboard`) currently fall back to default Inter `font-bold` / `font-black`, which is the single most repeatable brand regression on the site. Audit 2026-05-15.

**How to apply:**

- **Headlines (H1, H2, H3):** `font-serif` (Instrument Serif). Typical recipe: `font-serif text-4xl md:text-6xl lg:text-[68px] leading-[1.05] tracking-[-0.02em]`. Use `<em className="not-italic text-[#B5532C]">…</em>` to highlight a copper sub-clause inside a serif headline — that's the brand's signature move (see `page.tsx:779`, `page.tsx:916`, `page.tsx:1174`).
- **Body copy:** Inter Tight (default `font-sans`) at `text-[15px]` to `text-[17px]`, `text-neutral-400` for body, `text-neutral-300` for emphasis. `leading-[1.55]` to `leading-[1.65]`.
- **Micro-labels, section numerals, kbd, code:** `font-mono` (JetBrains Mono) at `text-[10px]` to `text-[12px]`, with letter-spacing `tracking-[0.18em]` to `tracking-[0.22em]` and `uppercase`. Color `text-neutral-500` to `text-neutral-700`.
- **Italic serif as accent voice:** `font-serif italic text-[13px] text-neutral-500` for section sub-labels (`SectionHead` pattern) and for the colophon/baseline in the footer.
- **Section numerals:** Format `01 / 10` in `font-mono text-[10px] text-neutral-600 tracking-[0.2em]` (see `SectionHead` at `page.tsx:209-221`).

Banned typography patterns:

- `font-black` on H1 — replace with `font-serif`. Currently violated by `trust/page.tsx:88`, `agents/page.tsx:190`, `for-banking/page.tsx:141`, every `for-*` clone.
- `tracking-tight` on serif headlines — Instrument Serif already has the right metrics; use `tracking-[-0.02em]` for precision.
- Mixing `font-bold` Inter and `font-serif` Instrument Serif in the same heading — pick one.
- Plain `text-white` for body — almost always wrong. Use `text-neutral-200` or `text-neutral-300` for body, reserve `text-white` for hero headlines and key labels.
