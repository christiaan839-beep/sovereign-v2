# Sovereign Matrix — Editorial Design System

**Last updated:** April 19, 2026
**Source file:** `src/app/_editorial.css`
**In-use on:** `/built-with-claude`, `/dashboard/nexus`, `/roi`
(partial on landing hero, `/pricing` hero)

---

## The one-paragraph statement

A two-mode editorial design language for an AI-agent platform that
deliberately rejects the dark-matrix-emerald-glow template look common
to the category. It uses three typefaces (Instrument Serif display,
Inter Tight body, JetBrains Mono data), a single copper accent
`#B5532C`, and two ink-on-ground modes: bone-on-charcoal (light) for
editorial/magazine surfaces, warm-near-black-on-bone (dark) for
product surfaces that need ink-like legibility against a deep field.

---

## The three rules

1. **One accent, used sparingly.** The copper `#B5532C` appears on
   exactly three kinds of things per surface: (a) a single italicized
   word in the display type, (b) numeric emphasis (active checkmark,
   live figure), (c) the primary CTA underline. If a fourth thing
   is copper, remove one.

2. **Typefaces have roles, not decorations.** Serif = display.
   Sans = body. Mono = data and labels. Never mix — no serif body,
   no sans numerics, no mono for prose.

3. **Rules over boxes.** Separation is achieved by thin horizontal
   rules (`var(--ed-rule)`) and generous negative space — not by
   card backgrounds or borders on everything. Cards exist only where
   content genuinely needs containment.

---

## Tokens — the CSS variables

All tokens live in `src/app/_editorial.css` and are scoped inside
`.editorial-light` / `.editorial-dark` wrappers so different surfaces
can use different modes without bleed.

### Colors — shared across both modes

| Token | Value | Usage |
|---|---|---|
| `--ed-copper` | `#B5532C` | The single accent. Italicized words, active checks, CTA underline |
| `--ed-copper-soft` | `#D08B6B` | Lighter variant for hover states (rarely used) |
| `--ed-copper-wash` | `rgba(181, 83, 44, 0.06)` | Background chips for model IDs, tags |

### Colors — light mode (Editorial Museum)

| Token | Value | Usage |
|---|---|---|
| `--ed-bg` | `#F4EFE6` | Bone / unbleached linen — page background |
| `--ed-bg-raised` | `#FBF7EE` | Marginal cream for raised surfaces |
| `--ed-ink` | `#1A1712` | Deep charcoal — primary text |
| `--ed-ink-soft` | `#5C544A` | Secondary body text |
| `--ed-ink-dim` | `#8F8576` | Tertiary labels, captions |
| `--ed-rule` | `#C7B9A1` | Dust — strong horizontal rule |
| `--ed-rule-soft` | `#D8CDB7` | Softer rule for minor separators |

### Colors — dark mode (Technical Monograph)

| Token | Value | Usage |
|---|---|---|
| `--ed-bg` | `#0B0A08` | Near-black with warm undertone (not `#000`) |
| `--ed-bg-raised` | `#131109` | Slight raise for cards / modals |
| `--ed-ink` | `#EDE5D6` | Warm bone — primary text |
| `--ed-ink-soft` | `#A8A090` | Secondary body text |
| `--ed-ink-dim` | `#6B6557` | Tertiary labels |
| `--ed-rule` | `#3A342B` | Dust shadow — strong rule |
| `--ed-rule-soft` | `#272319` | Soft rule |

### Typography tokens

```css
--ed-font-display : "Instrument Serif", "GT Sectra", "Cormorant Garamond", Georgia, serif;
--ed-font-body    : "Inter Tight", "Söhne", system-ui, -apple-system, sans-serif;
--ed-font-mono    : "JetBrains Mono", "Berkeley Mono", ui-monospace, monospace;
```

Fonts loaded once in `src/app/layout.tsx` via Google Fonts link tag.
Latency: ~40ms blocking on first paint (acceptable for editorial
aesthetic).

---

## Utility classes

### Typography

| Class | Role | Typical size |
|---|---|---|
| `.ed-display` | Serif display — headlines | `clamp(48px, 9vw, 112px)` |
| `.ed-display-italic` | Italic display — emphasis inside display type | same as `.ed-display` |
| `.ed-body` | Sans body — prose, descriptions | 13–17px |
| `.ed-mono` | Mono — numerics, codes, agent names | 10–13px |
| `.ed-label` | Mono small-caps — section eyebrows | 10px, `letter-spacing: 0.18em`, uppercase |
| `.ed-caption` | Mono dim — photo captions, footnotes | 11px |

### Color helpers

- `.ed-copper` — sets `color: var(--ed-copper)`
- `.ed-copper-bg` — sets copper background with bg text
- `.ed-copper-border` — sets `border-color: var(--ed-copper)`
- `.ed-copper-underline` — 2px copper underline with 6px offset

### Rules + grid

- `.ed-rule` — 1px horizontal line in rule color
- `.ed-rule-dotted` — 1px dotted horizontal (6px gap)
- `.ed-grid-12` — 12-col CSS grid with responsive gap
- `.ed-page` — page gutter (`padding-inline: clamp(24px, 6vw, 88px)`)
- `.ed-max` — `max-width: 1240px; margin-inline: auto`
- `.ed-max-narrow` — `max-width: 820px` for reading surfaces

### Motion

- `.ed-enter` — 900ms rise + fade (cubic-bezier(0.16, 1, 0.3, 1))
- `.ed-enter-slow` — 1400ms version
- `.ed-fade-in` — 1200ms fade only
- `.ed-d-1` through `.ed-d-8` — stagger delays for chained entrances
- All disabled under `prefers-reduced-motion: reduce`

---

## Component patterns

### Masthead (used on every editorial page)

```tsx
<div className="flex items-baseline justify-between mb-10 ed-fade-in">
  <Link href="/" className="ed-label hover:ed-copper transition-colors">
    ← Sovereign Matrix
  </Link>
  <p className="ed-caption">Vol. 01 · No. 01 · 2026</p>
</div>
```

Two elements only. Left: return-home label in mono small-caps. Right:
issue marker in mono caption. Never add a nav menu to this row —
navigation goes in the footer.

### Title block

```tsx
<header className="ed-grid-12 mb-16">
  <div className="col-span-12 md:col-span-9">
    <p className="ed-label mb-6 ed-enter ed-d-1">Field Note · Partnership</p>
    <h1
      className="ed-display ed-enter ed-d-2"
      style={{ fontSize: "clamp(56px, 10vw, 132px)", lineHeight: 0.88 }}
    >
      Built <em className="ed-display-italic ed-copper">with</em> Claude,
      <br />
      not just on it.
    </h1>
  </div>
  <aside
    className="col-span-12 md:col-span-3 md:pl-6 md:border-l ed-enter ed-d-3"
    style={{ borderColor: "var(--ed-rule)" }}
  >
    <p className="ed-label mb-4">By</p>
    <p className="ed-body text-[15px]">Christiaan de Wet</p>
    <p className="ed-caption mt-1">Founder · Sovereign Matrix</p>
  </aside>
</header>
```

Asymmetric 9:3 split. Headline dominates; byline sidebar has a
vertical rule on its left.

### Dek (secondary headline in italic serif)

```tsx
<p
  className="ed-display"
  style={{ fontSize: "clamp(22px, 2.6vw, 32px)", lineHeight: 1.3, color: "var(--ed-ink-soft)" }}
>
  A solo founder shipped <em className="ed-display-italic ed-copper">one hundred and thirty-one</em>…
</p>
```

### Stat bar

```tsx
<section className="ed-grid-12 py-10 border-y mb-20" style={{ borderColor: "var(--ed-rule)" }}>
  {STATS.map(s => (
    <div key={s.label} className="col-span-6 md:col-span-3">
      <div
        className="ed-display tabular-nums ed-copper"
        style={{ fontSize: "clamp(48px, 6vw, 80px)", lineHeight: 0.9 }}
      >
        {s.n}
      </div>
      <div className="ed-label mt-3">{s.label}</div>
    </div>
  ))}
</section>
```

Three or four stat tiles. Number in copper serif, label in mono
small-caps.

### Pull quote

```tsx
<section className="my-24 ed-grid-12">
  <div className="col-span-12 md:col-span-10 md:col-start-2">
    <div className="ed-mono ed-copper text-[60px] mb-4" style={{ lineHeight: 0.5 }}>&ldquo;</div>
    <blockquote
      className="ed-display-italic"
      style={{ fontSize: "clamp(30px, 4vw, 52px)", lineHeight: 1.15 }}
    >
      The quote content, lowercase, with one copper word of emphasis.
    </blockquote>
    <div className="flex items-center gap-4 mt-8">
      <div className="ed-rule w-16" style={{ background: "var(--ed-copper)" }} />
      <p className="ed-label">Operating principle · §1</p>
    </div>
  </div>
</section>
```

### Chapter divider (for long-form)

```tsx
<div className="ed-grid-12 mb-10">
  <div className="col-span-12 md:col-span-3">
    <p className="ed-label">Chapter I</p>
  </div>
  <div className="col-span-12 md:col-span-9">
    <h2 className="ed-display" style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 0.95 }}>
      Where Claude <em className="ed-display-italic">actually</em> works
    </h2>
  </div>
</div>
```

### Colophon (footer)

```tsx
<footer className="border-t pt-8 pb-4 ed-grid-12" style={{ borderColor: "var(--ed-rule)" }}>
  <div className="col-span-12 md:col-span-6">
    <p className="ed-label mb-3">Colophon</p>
    <p className="ed-body text-[13px]" style={{ color: "var(--ed-ink-soft)", lineHeight: 1.7 }}>
      Set in Instrument Serif (display), Inter Tight (body), JetBrains Mono (data).
      Copper accent (#B5532C) tonally adjacent to Anthropic's wordmark. This page was
      designed, written, and coded in a single Claude Code session.
    </p>
  </div>
  <div className="col-span-12 md:col-span-6 md:text-right mt-8 md:mt-0">
    <p className="ed-caption">Sovereign Matrix · Cape Town · 2026</p>
    <p className="ed-caption mt-1">
      <Link href="/pricing" className="hover:ed-copper">Pricing</Link>
      {" · "}
      <Link href="/dashboard/nexus" className="hover:ed-copper">Nexus</Link>
    </p>
  </div>
</footer>
```

---

## Developer handoff — building a new editorial page

1. Wrap your page component with `<div className="editorial-light">`
   or `<div className="editorial-dark">` depending on mode.
2. Use `<div className="ed-page py-12 md:py-20"><div className="ed-max">…`
   as the outer container for gutters + max-width.
3. Never write raw `color` or `background-color` hex values — use
   `var(--ed-ink)`, `var(--ed-bg)` etc. This keeps mode switching
   automatic.
4. Typography: always use `.ed-display`, `.ed-body`, `.ed-mono`, or
   `.ed-label` — never `font-serif`, `font-mono` Tailwind classes.
5. Copper is the only accent. Reserve it for one italicized word,
   one numeric emphasis, and one CTA underline per surface.
6. Use `ed-grid-12` for layout. 9:3, 8:4, 3:9 are the preferred
   asymmetric splits. Centered full-width columns are for CTAs
   only.
7. Animation: `.ed-enter` with `.ed-d-N` for a staggered page-load
   sequence. Don't add Framer Motion on editorial surfaces — the
   restraint is the point.

---

## Anti-patterns (things to reject in code review)

- **Multiple accent colors.** If you want emerald AND copper on a
  single surface, pick one.
- **Gradient text.** `text-transparent bg-clip-text bg-gradient-to-r`
  is the #1 AI-slop pattern. Use the italic-serif + copper trick
  instead.
- **Glass cards.** `backdrop-blur-xl` with `bg-white/5` reads as
  generic product aesthetic. Use rules + margins.
- **Emoji in headlines.** Ever.
- **Cursor glow, particle backgrounds, nebula clouds.** Reserved for
  the Nexus landing hero where the cinematic register is intentional
  — not for editorial pages.
- **Sentry-beacon status pills.** On editorial pages, status is
  communicated by typography color and rule placement, not by
  pulsing colored dots.

---

## Audit — current state

Surfaces adopting the system:

| Surface | Mode | Status |
|---|---|---|
| `/built-with-claude` | light | Fully adopted. Reference implementation. |
| `/dashboard/nexus` | dark | Fully adopted. Technical-monograph aesthetic. |
| `/roi` | light | Fully adopted (April 19, 2026). |
| `/` (landing hero) | dark, partial | Hero typography updated but rest of page uses prior matrix aesthetic |
| `/pricing` (hero) | dark, partial | Title re-typeset; table below still uses Tailwind emerald |

Surfaces not yet adopting:

- Most `/dashboard/*` pages — pending incremental migration
- `/for-*` sector pages — low priority
- Agent-run detail views — would benefit; future work

Pre-editorial surfaces to leave untouched:

- The cinematic landing elements (physics cards, live model health,
  agent globe). They're specifically signaling "alive product" — a
  different register than editorial.
