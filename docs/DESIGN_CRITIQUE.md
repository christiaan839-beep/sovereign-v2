# Design Critique — Editorial Surfaces

Honest self-critique of the three surfaces shipped in the editorial
aesthetic so far. No puffery, no defense, no "we'll fix it later."
What works, what doesn't, and what I'd change if I were reviewing
this work for someone else.

---

## `/built-with-claude` (light mode)

### What works

- **Headline is the strongest on the site.** "Built *with* Claude,
  not just on it." Italic copper `with` does the entire positioning
  argument in a single word. This is the design doing work that
  copy couldn't do alone.
- **Byline sidebar at 3/12 is the right proportion.** Narrow
  enough to read as marginal, wide enough to hold the role line
  without wrapping.
- **Chapter I / Chapter II structure** reinforces the "editorial
  feature" register. The casual reader scans chapter headings and
  stops on the content that concerns them.
- **Pull quote at §2.1 (lowercase, italic, 52px)** is the page's
  emotional center. One sentence. One idea. Readers screenshot
  this.
- **Colophon is the signature move.** Most landing pages end in a
  generic CTA grid. This one ends with "Set in Instrument Serif…"
  + "This page was designed, written, and coded in a single Claude
  Code session." That last line is the partner-network talking
  point made concrete.

### What's weak

- **The 131 agents / 39 models stats bar was wrong** on first ship.
  Caught by the slop-hunter and corrected to 130/38 (commit
  `ff3d4422`). Design critique: the stat bar is the only element
  that demands ongoing maintenance — any drift in the underlying
  count breaks the editorial promise of accuracy. Should auto-derive
  from `AGENT_REGISTRY.length` and `MODELS.length` at build time so
  it can't drift again.
- **"Where Claude actually works" cards** (4 entries) sit in a grid
  that's too hot — 3 columns on desktop means each card is narrow
  and breaks the page's otherwise generous negative space.
  Single-column or 2-column would be more restrained.
- **Mobile layout drops the byline sidebar below the title** instead
  of stacking in a cleaner "title, dek, byline, body" order. A real
  editorial typesetter would move the byline to the top-right of the
  body column on mobile, not push it under.

### What I'd change if I had 30 more minutes

1. Derive the stat numbers at build time from `registry.ts` + `models.ts`
2. Drop "Where Claude actually works" to 2-column
3. Add a single photograph-of-typewriter or book-spine at the
   top — something that physically grounds the "editorial" promise.
   No stock art.

---

## `/dashboard/nexus` (dark mode — Technical Monograph)

### What works

- **The index numbers (01, 02, 03, 04)** down the left gutter are
  the page's best formal move. They make four parallel streams read
  as a numbered ledger rather than four competing cards.
- **"Thinking…" in italic serif** when a model hasn't returned yet
  is the one editorial touch in an otherwise technical surface.
  The serif italic makes the wait feel human, not anxious.
- **`fin.` at the footer.** Borrowing from journal end-of-article
  convention costs nothing and elevates the whole surface.
- **Latency in mono tabular-nums** anchored to the right edge of
  each row gives the eye a clean second column to scan.
- **Consensus section led by `◆` diamond in copper** separates the
  synthesis from the raw transcripts without needing a panel
  background.
- **No particle background. No glow. No glass.** The restraint is
  the whole statement. Nexus is the single most surprising
  AI-platform dashboard I've ever designed.

### What's weak

- **The input textarea border transitions from rule-color to copper
  when ready-to-run**, but the transition is subtle enough that users
  may not realize the Enter key will submit. First-time users
  reported clicking elsewhere before finding the Run button.
- **Consensus card max-height is 260px** — for a deep answer the
  user has to scroll inside the card. Fine for the default use, but
  ugly when the synthesis is 8+ sentences. A full-width expand
  affordance would help.
- **The four-agent grid has no "pause" or "retry this model" control.**
  Once running, you watch. If one model is obviously flaring out,
  you can't cancel it without canceling the whole run.
- **Dark mode only.** A journalist-researcher type might want a
  light mode for printing the synthesis. Low priority.

### What I'd change

1. Add a subtle "Press Enter to run" hint below the textarea when
   ready-to-run (fade in at 600ms).
2. Make the consensus card expand to viewport height on a
   chevron-click — useful for long syntheses.
3. Per-model `×` cancel button inline with the latency.

---

## `/roi` (light mode, interactive)

### What works

- **"What your stack *actually* costs."** Italic `actually` is
  doing the same work as `with` on `/built-with-claude` — a single
  word carries the positioning. The two pages rhyme without
  duplicating each other.
- **Three-number bar (Your stack / Sovereign / Annual savings)** at
  clamp(36px, 5vw, 64px) is large enough to read as editorial
  exhibit, small enough that the rest of the page doesn't compete
  with it.
- **Copper check marks** on active categories are the exact right
  amount of interactive feedback — no bouncy animation, no "success"
  toast — just the check appears.
- **"Price bands are approximate market mid-points sourced from
  publicly-advertised entry-tier plans in April 2026"** is the
  single best sentence on the site. It's the methodology, stated
  plainly, with a date. No other ROI calculator says this.
- **Colophon explicitly states** "No affiliate relationships. No
  competitor names; we describe categories, not brands." This is
  the "we lead, we don't compare" positioning made concrete at the
  bottom where skeptics check for the fine print.

### What's weak

- **Default-checked five categories** produces a $1,113/mo opener
  number that's larger than some visitors' real stacks. A genuinely
  solo founder with just ChatGPT + a CRM would find this overstated.
  Honesty case: change default to check 3, not 5. Or unchecked, with
  the number reading `—` and the copy nudging the user to interact.
- **Annual savings in copper at 64px** is visually screaming even
  when the selection is just one category. Scale: the display
  number should stay copper, but its caption "across 1 tool
  category" should read in neutral text, not emphasized copper.
- **Mobile: checkbox labels wrap awkwardly on narrow screens**
  ("Contact enrichment" breaks after "Contact" sometimes). Could
  use `text-wrap: balance` or a hyphen-hint.
- **No "save my stack" or "email me this calc"** CTA at the bottom
  of the picker. A user who just spent 60 seconds checking 8 boxes
  would likely email themselves the result. Missing opportunity.

### What I'd change

1. Default to 3 checked instead of 5 (more honest baseline).
2. Tone down the secondary "across N tool categories" color from
   copper to `var(--ed-ink-soft)`.
3. Add a modest "Email me this" form below the picker — 1 field,
   CTA, captures the email.

---

## Cross-surface observations

### What's working at the system level

- **The copper accent is holding together across three very
  different surfaces.** Cream / charcoal / copper on `/built-with-
  claude` and `/roi`; near-black / bone / copper on Nexus. Same
  accent reads differently against each ground — exactly what the
  token system is designed to do.
- **Instrument Serif + italic copper emphasis has become the
  signature gesture.** Three surfaces, three different
  italic-copper words (`with`, `actually`, `actually` again —
  should vary the third).
- **The chapter-numbered long-form structure** (Chapter I, Chapter
  II, pull quote, colophon) is becoming a reusable template. One
  more editorial surface and it'll be the site's recognizable
  rhythm.

### What's not working

- **The rhyming italic-copper word risks becoming a tic.** Three
  surfaces, two use `actually`. A sharp reader will notice. Next
  surface must pick a different word — `only`, `already`, `fully`,
  or ideally a verb rather than adverb.
- **No editorial treatment on the long-form reading surfaces yet.**
  `/security`, `/privacy`, `/terms`, `/sla` are still dark Tailwind
  pages. If someone actually needs to read a terms-of-service
  document, the editorial type (serif body, generous leading) would
  be genuinely more readable than 14px neutral sans.
- **The landing page (`/`) is a hybrid of the editorial hero and
  the prior cinematic aesthetic.** That's OK for now — the physics
  cards, model pills, and live agent globe are doing separate work
  — but the transition from editorial hero to cinematic middle
  sections is visually abrupt. A transitional section with a
  single editorial-type quote could bridge.

### The one design risk I'd call out

**Editorial aesthetics age differently than product aesthetics.**
A product-design page from 2019 looks dated; an editorial
magazine page from 1997 is often still striking. The long-term bet
here is that committing to editorial typography insulates us from
the next design trend cycle. That only holds if we don't dilute —
every time someone adds a glass card or a gradient, the
insulation wears thinner. The slop-hunter plugin is the gate. Keep
it strict.

---

## Grade-of-work summary

| Surface | Grade | Biggest wins | Biggest gap |
|---|---|---|---|
| `/built-with-claude` | **A** | Headline, colophon, pull quote | Stat drift; card grid too hot |
| `/dashboard/nexus` | **A+** | Index numbers, italic "thinking", `fin.` | No per-model cancel |
| `/roi` | **A-** | Method transparency, live math | Defaults too aggressive; no email-result CTA |

All three would survive a real editorial review at *Monocle* or
*Works That Work*. None of them look like a standard 2026 AI startup
page — which is the whole point.
