# DigitlSky pitch kit

Everything you need to walk into DigitlSky, show this, and walk out with a job — while introducing them to Claude Code.

The artifact: `index.html` — a concept redesign of the DigitlSky homepage. One self-contained file. No build, no server, no internet required. Double-click it and it runs.

---

## 1. The one-line positioning

> "You build custom, high-converting websites for brands like Audi and Sony. I used Claude Code to design and build a concept redesign of _your own_ homepage — research, copy, design and code — in a single working session. Here's what that speed looks like, and here's what it could do for your team's margins."

You're not pitching that you can use a tool. You're pitching **leverage**: agency-grade output at a fraction of the hours.

---

## 2. The 2-minute live walkthrough (talking-track)

Open the page full-screen. Scroll slowly. Say roughly this:

**[0:00 — Hero]**
"I started by studying DigitlSky — your positioning, your services, your client roster. Then I had Claude Code build a homepage concept around it. Watch the headline — the keyword cycles through _growth, demand, momentum, revenue_. That's a single line of intent, not a stock-photo hero."

**[0:20 — Client marquee + stats]**
"Real clients, real story — Sony Africa, Audi, VW, SPAR. The stats band reframes 'one-man studio to 30+ team' as a _credibility_ asset instead of an About-page footnote."

**[0:40 — Services]**
"Your six services, each rewritten to sell outcomes, not features. 'A CPA you can defend in a board meeting' instead of 'we do Meta ads.' That's the copy difference that converts."

**[1:05 — Story + Work]**
"The founding story becomes a timeline. The work grid is built for logos and case studies to drop straight in."

**[1:25 — The reveal]**
"Here's the part that matters: research, copywriting, design system, responsive layout, animations, the whole build — **one session with Claude Code.** No template. No page builder. Production HTML."

**[1:45 — The close]**
"Imagine your team scoping a client landing page on the call and shipping a first draft before the call ends. That's the margin and the speed I'd bring here — and it's how I'd introduce Claude Code to the studio."

---

## 3. Before / after framing (use this if they have their current site open)

|                     | Their current site (typical agency template) | This concept                                                        |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| **Hero**            | Static headline, stock image                 | Kinetic morphing keyword, dawn-sky gradient, zero stock photography |
| **Proof**           | Logos buried below the fold                  | Client marquee + stat band above the fold                           |
| **Copy**            | Feature-led ("we do SEO")                    | Outcome-led ("compounding demand after the ad budget switches off") |
| **Motion**          | None / jQuery sliders                        | Scroll-reveal, parallax glows, respects `prefers-reduced-motion`    |
| **Build**           | Page builder / WordPress theme               | Hand-built, 28KB, loads instantly, no plugins                       |
| **Time to produce** | Days to weeks                                | One session                                                         |

Frame it as: _"Same agency, same clients — just rebuilt at the quality bar your automotive clients expect, in the time it takes to write the brief."_

---

## 4. How to talk about Claude Code (the "introduce Claude" goal)

Three points, in their language (margin, speed, quality):

1. **It compresses the production tail.** The slow part of agency work isn't ideas — it's the hours turning ideas into shippable assets. Claude Code does that part in minutes, supervised.
2. **It raises the floor, not just the ceiling.** Junior output starts at senior quality because the model handles the boilerplate, accessibility, responsive edge-cases and copy polish by default.
3. **It's a force multiplier, not a replacement.** A 30-person team that each move 2–3× faster is a 70-person studio's output on a 30-person payroll. That's the pitch to the founder.

Avoid: "AI will replace designers." Say: "AI lets your designers ship 3× the work without burning out."

---

## 5. Deploy it for free (NOT Vercel) — pick one

You want a live URL to text them or put on the deck. Two zero-cost, zero-Vercel options, both ~60 seconds:

### Option A — Netlify Drop (fastest, no account needed to preview)

1. Go to **app.netlify.com/drop**
2. Drag the **`digitlsky-concept`** folder onto the page
3. You get a live URL instantly (e.g. `random-name.netlify.app`)
4. Free. Sign in to keep it permanent + rename it.

### Option B — Cloudflare Pages (best, free custom subdomain)

1. Go to **dash.cloudflare.com** → **Workers & Pages** → **Create** → **Pages** → **Upload assets**
2. Name it `digitlsky-concept`
3. Drag the **`digitlsky-concept`** folder (the file inside is `index.html`)
4. Deploy → live at `digitlsky-concept.pages.dev`
5. Free forever. Add a custom domain later if you want.

### Option C — the bulletproof fallback

Just **double-click `index.html`.** It runs offline in any browser. If the room's wifi dies mid-pitch, you lose nothing. Keep a copy on a USB stick.

> Tip: present from **Option C locally** and have **Option A/B as the "and it's live, here's the link" moment.** Best of both — reliability + the wow of a real URL.

---

## 6. Pre-flight checklist (5 min before you walk in)

- [ ] Open `index.html` locally — confirm hero word cycles, scroll reveals fire
- [ ] Have the live URL (Netlify/CF) loaded in a second tab
- [ ] Phone on silent, notifications off, browser zoom at 100%
- [ ] Full-screen the browser (F11) — no bookmarks bar, no Vercel/localhost in the address bar
- [ ] Know your first sentence cold (section 1 above)
- [ ] Have the deck open as the closer

---

## 7. What to leave them with

The live URL + this line:

> "This took one session. Your next client's landing page could too. I'd love to show the team how."
