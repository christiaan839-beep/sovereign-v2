---
name: Landing + vertical audit findings 2026-05-20
description: Concrete state of /, /for-*, /agents, /enterprise on 2026-05-20 — what's elite, what's slop, where the gaps live
type: project
---

Findings from a brutal audit of the front-end pages on 2026-05-20.

**The landing page (`src/app/page.tsx`, 1692 lines) is mid-tier with elite moments.**
What works: A2EGraph constellation behind hero, HeroProofPill live receipt id, CliTabs verify-the-math one-liner, LiveVerifierDemo, FilmGrain, copper radial dust, brand-sweep gradient. Section counter `nn / 09`, Instrument Serif H1, JetBrains Mono micro-labels. CommandEgg easter egg. This is the actual Stripe-tier work in the codebase.
What doesn't: zero `useScroll`/`useTransform` anywhere on landing — no scroll-linked parallax, no pinned section, no scroll-driven reveal. Every grid (`page.tsx:729,864,1002,1089,1361,1556`, `ThreeMoatsGrid.tsx:299`) is uniform `md:grid-cols-N`. No `col-span`/`row-span` asymmetry → no real bento.

**The 24 `/for-*` vertical pages are pure template clones.**

- All use `bg-[#010101]` (not the mandated `#030303`) — `src/app/for-realestate/page.tsx:69` and 23 siblings
- All use white-pill CTAs (`px-5 py-2 rounded-full bg-white text-xs font-semibold text-black`) — violates the global PrimaryCTA / copper accent rule
- Zero copper, zero `brand-sweep`, zero `backdrop-blur-xl`, zero glassmorphism on any vertical
- Structural diff between for-realestate and for-cybersecurity is ONE word (the title noun) + accent color token. Pages are byte-identical after stripping color names and proper nouns
- Animation is pure `initial={opacity:0,y:20} whileInView={opacity:1,y:0}` boilerplate — no stagger, no AnimatePresence, no scroll links

**Agentic capability is told, not shown.**
`LiveActivityTicker` exists but is fixed bottom-right — not a primary surface. No swarm visualization, no live agent telemetry panel, no real-time receipt feed scrolling on the landing. Claims like "140 agents", "11-model failover", "Ed25519 + ML-DSA-65 dual-sign", "5-layer pipeline" exist only as text. VerificationPipeline is the closest thing to a visualization but it's static SVG-style nodes, not data-driven.

**Why:** Landing was rebuilt in audit-2026-05 Wave 12 to elite spec. Vertical pages were never touched in that wave — they're the original AI-generated batch from earlier sprints. Investor demos go through `/` (looks good); first-touch SEO traffic on `for-*` pages (looks generic).

**How to apply:** When asked about landing quality, distinguish `/` (elite) from `/for-*` (slop) — they are different generations of work. Any vertical-page edit should start by ripping the white-pill CTA and `bg-[#010101]` and reusing `PrimaryCTA`/`SectionDivider`/`SectionHead` from the landing primitives.
