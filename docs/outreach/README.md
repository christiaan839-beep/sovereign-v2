# Outreach kit — Sovereign Matrix → AI labs + agent startups

Templates and a sequencing playbook for cold outreach. Built to convert
the work in this repo into 20-min calls with hiring managers at
Anthropic, Vercel, Modal, LangChain, Cognition, Replicate, and
pre-seed-to-Series-A agent startups.

The kit is templated, not pre-filled. Names, role signals, and personal
links go in via slots before sending. Don't paste templates raw — every
recipient gets one specific observation about their work.

## Files

| File                 | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `cold-emails.md`     | 5 email templates, one per target archetype                |
| `linkedin-dms.md`    | 5 DM variants matching the email archetypes                |
| `disclosure.md`      | The AI-pair-programming disclosure block (reusable footer) |
| `target-research.md` | How to find the right person at each target                |
| `sequencing.md`      | When to send what, follow-up cadence, response handling    |

## How to use

1. **Pick a target.** Anthropic FDE, Vercel FDE, Modal SE, LangChain
   applied AI, agent-startup founding eng, or direct contract.
2. **Find the human.** Use `target-research.md` to identify a real
   first name + role + recent public signal (blog post, talk, PR, tweet).
3. **Fill the slots.** Replace `{{first_name}}`, `{{role_signal}}`,
   `{{role_title}}`, `{{company}}` in the chosen template.
4. **Verify the receipts.** Every link in the body must resolve to real
   evidence:
   - `sovereignmatrix.agency/anthropic` — partnership thesis
   - `sovereignmatrix.agency/now` — current focus + recently shipped
   - `github.com/christiaan839-beep/sovereign-v2` — public source
   - `npmjs.com/package/@sovereign/ai-router` — open-source artifact
5. **Send email + LinkedIn DM same day.** Different channels, same
   message. Increases reply rate without doubling perceived effort.
6. **Track in a sheet.** Date sent · target · channel · reply status ·
   next-action date.

## Quality bar

- Subject line: under 60 characters.
- Body: under 120 words.
- Lead with one specific signal about THEIR work (not generic flattery).
- One link to evidence — never two competing CTAs.
- One ask: 20 minutes, with a calendar link.
- Disclosure block in footer, every send, every channel.
- No "world-class," "elite," "honored," "humbled," or "passionate."
  These templates were written after killing those exact words from
  140 agent system prompts in this repo. Don't add them back.

## What this kit does NOT do

- Apply for jobs through ATS portals — those go through HR funnels and
  filter on degree. Cold outreach goes around that.
- Spam. Three contacts max per target, then archive.
- Hide the AI workflow. Disclosure is mandatory per Anthropic's
  candidate guidance, and it's a feature: it shows judgment about
  tooling, not a flaw to hide.

## Honest caveats

- This kit assumes the work in this repo is what it claims to be.
  Before sending, run `npm run lint && npm test && npm run build`
  green; the platform pages have to load when a recruiter clicks.
- Every recipient who replies will read `/now` first. Update it weekly
  so the "Recently shipped" list isn't stale.
- Anthropic's candidate AI guidance allows AI tool use _with disclosure_.
  Don't sand off the disclosure to look more "raw" — that's the trap
  the guidance exists to prevent.
