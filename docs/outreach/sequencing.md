# Sequencing — when to send, when to follow up, when to stop

The kit is the easy part. The compound effect comes from cadence.

## Default cadence per target

| Day | Action        | What goes through                                                      |
| --- | ------------- | ---------------------------------------------------------------------- |
| 0   | First contact | Cold email + LinkedIn DM (same day, both channels)                     |
| 4   | Follow-up 1   | One reply to the original email thread, with one new piece of evidence |
| 10  | Follow-up 2   | Final reply: short, "still relevant?" — no new pitch                   |
| 11+ | Archive       | Move target to `closed: ghost` in tracking sheet                       |

Three contacts max. Beyond that you're noise.

## Follow-up 1 (day 4) — the new-evidence ping

Reply to your own email thread. Subject line: keep the original (gets
threaded in their inbox).

```
Hi {{first_name}} — quick follow-up: shipped {{new_evidence}} since I
emailed Monday. Still keen on a 20-min conversation about
{{role_title}}. {{cal_link}}
```

`{{new_evidence}}` examples (real things from this repo):

- "the @sovereign/ai-router npm package as a standalone artifact"
- "a real customer-wins layer at /case-studies"
- "DB-backed daily $ spend cap (replaced an in-memory Map that reset
  on cold starts)"
- "Stripe payment-intent verification + idempotent redemption — closed
  a credit-minting bypass"
- "a /now page following the nownownow.com convention"

The new-evidence ping reframes the second contact: it's not "did you
see my email" — it's "I shipped X since." Higher reply rate because
it shows momentum, not desperation.

## Follow-up 2 (day 10) — the close-the-loop ping

```
Hi {{first_name}} — last note from me on this. If {{role_title}} is
filled or off the table, no problem; happy to be told. If still open,
{{cal_link}}.

— Christiaan
```

Two purposes:

1. Gives them a clean way to close the thread ("It's filled, sorry").
2. Filters: people who reply now are warm. People who don't, archive.

## Response handling

### "Yes, let's talk"

- Send calendar link **in the next reply** — same hour if you can.
  Warm leads cool fast.
- Default to 20 minutes. Don't propose 30 unless they ask.
- Pre-call prep: read their last 3 LinkedIn posts, last public PR,
  last public talk. Mention one in the call.

### "Send me your CV"

- Send a CV that matches the role. Don't send a generic one.
- Lead the email with one line: "Tailored for {{role_title}} —
  highlights at top, full ship list at /now."

### "Not a fit right now"

- Polite thank.
- Ask: "Anyone else on the team I should talk to?"
- This converts ~15% of declines into a warm intro.
- Don't argue the rejection — that's a reply nobody enjoys reading.

### "We don't hire without a degree" (rare but happens)

- Polite acknowledgment.
- Move on. Their loss; do not negotiate.
- Anthropic, Vercel, Modal, LangChain, Cognition — none of these
  filter on degree. If a recruiter says they do, escalate to the
  hiring manager (you have their name from research).

### Ghost

- Archive after follow-up 2.
- Don't add them to a "nurture sequence." That's spam infrastructure
  and it's beneath what this kit is for.

## Volume calibration

| Tier                                                    | Sends/week | Why                                        |
| ------------------------------------------------------- | ---------- | ------------------------------------------ |
| Tier 1 (Anthropic, Vercel, Modal, LangChain, Cognition) | 3-5        | Quality cap; each needs custom research    |
| Tier 2 (other AI infra/agent companies)                 | 5-10       | Templates can be reused with light editing |
| Tier 3 (skip)                                           | 0          | Degree-filter risk too high; ROI too low   |

**Cap: 15 outbound contacts per week.** Past 15, quality drops, and
quality is the only thing that gets replies.

## What to update weekly

- `/now` page — recently shipped section, last-updated stamp
- Tracking sheet — every send, every reply, every archive
- This sequencing doc — if a pattern stops working, write it down

## What success looks like

- **Week 1:** 5 sends. Realistically: 0–1 reply. That's normal cold
  outreach math.
- **Week 4:** 20 sends total. 1–3 replies. 1 call booked.
- **Week 8:** 40 sends total. 4–8 replies. 2-3 calls booked. By now,
  you're iterating on signals based on what landed.
- **Week 12:** First offer or contract should be in motion.

If after week 8 you have zero replies, the bottleneck is upstream of
the kit — most likely:

- LinkedIn profile is empty / inconsistent with the email's claims
- Email going to spam (warm up the sending domain)
- `/now` and `/anthropic` pages are slow / 404 / look broken
- Targets are wrong (wrong role, wrong company size, wrong region)

Re-audit upstream before changing the templates.

## What NOT to do

- Don't A/B test subject lines on humans you respect. The kit is
  already tight; the leverage is in better targets, not better copy.
- Don't BCC yourself en masse and mail-merge 100 recipients. The
  templates are templates so you can customize, not mail-merge.
- Don't follow people on Twitter/X right after sending — they'll
  notice and it reads as desperate.
- Don't apologize in the follow-up. Just send the new evidence.
- Don't switch recipients within a company without restarting the
  cadence — that reads as scattershot.
