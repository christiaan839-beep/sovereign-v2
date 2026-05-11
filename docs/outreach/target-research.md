# Target research — finding the human

Templates are useless if `{{first_name}}` is wrong, the role title is
stale, or `{{role_signal}}` is generic. This doc is the research method
that turns 5 templates into 25–50 individually targeted sends.

## Tier-1 targets (highest reply probability)

### Anthropic

- **Roles:** Forward Deployed Engineer, Applied AI Engineer, Solutions
  Engineer (EMEA preferred — closer to your timezone).
- **How to find the human:**
  - anthropic.com/careers → click the role → scroll to hiring manager
    if listed → cross-check on LinkedIn
  - LinkedIn search: `"Anthropic" AND ("forward deployed" OR "applied AI" OR "solutions engineer")` — filter by current company
  - Recent Anthropic engineering blog posts → byline → that author's
    LinkedIn
  - Twitter/X: search `from:AnthropicAI` for engineers who post
- **Role signal to watch for:** the AI Fluency course, the candidate
  AI guidance page, the Constitutional AI paper, the SDK launch posts.
  Reference one specifically.

### Vercel

- **Roles:** Forward Deployed Engineer, Solutions Engineer.
- **How to find the human:**
  - vercel.com/careers → role → cross-check on LinkedIn
  - GitHub: vercel/next.js commits → look at maintainer activity
  - X: most Vercel engineers post publicly with affiliation in bio
- **Role signal:** AI SDK 5 launch, v0 launches, Edge Functions posts,
  Next.js 16 features. You're shipping ON Next.js 16 — concrete signal.

### Modal / Replicate

- **Roles:** Solutions Engineer, Applied AI Engineer.
- **How to find the human:** careers page → LinkedIn → recent blog
  posts → engineers who post publicly.
- **Role signal:** their inference economics, GPU on-demand framing,
  cold-start innovations. Reference @sovereign/ai-router as artifact.

### LangChain / Cohere / Together / Mistral

- **Roles:** Applied AI Engineer, Developer Relations.
- **Role signal:** their evaluation harnesses, retrieval research, or
  recent OSS releases. Reference your 5-layer output verifier as
  parallel work.

### Cognition (Devin) / agent-startup founders

- **Roles:** Founding Engineer, Engineer #1-#5.
- **How to find the human:** Twitter/X. Pre-seed and seed founders
  post publicly daily. Funding-round announcements on Crunchbase →
  TechCrunch → bylines → LinkedIn.
- **Role signal:** their funding, their first hire, their public roadmap.

## Tier-2 targets (good fits, lower priority)

- Replicate, Fireworks, Anyscale (inference platforms)
- LlamaIndex (retrieval / agents)
- Crew, AutoGen authors (open-source agent frameworks)
- Toptal-tier contract platforms (Toptal, Arc.dev, A.Team) — different
  pitch, money-first not mission-first

## Tier-3 (skip unless reaching out is essentially free)

- Big tech (Google, Meta, AWS, Microsoft) — degree filter is heavy at
  the top of funnel. Lateral via open-source contribution gets further
  than cold email here. Not where this kit's leverage is.

## What "role_signal" actually means

A role signal is ONE concrete thing the recipient has shipped or
written publicly that you can reference in one sentence. It must be:

1. **Recent.** Last 6 months. Last 30 days is better.
2. **Specific.** Not "your work on AI" — "your post on inference
   economics for B200s" or "the Devin pricing thread you wrote on X".
3. **Real.** You actually read/watched it. The follow-up question
   they'll ask if they reply will catch you if you're bluffing.
4. **Connected to your work.** The bridge to `{{your_work}}` should be
   one short clause: "your X — that's the seam I've been working on
   for a year."

## Bad signals (don't use these)

- "I've followed your work for years" (vague, suspicious)
- "Your blog is incredible" (flattery, not signal)
- "I admire what you're building at {{company}}" (generic)
- Anything about their LinkedIn activity feed — too low-status

## Good signal examples

- "Your post on multi-tenant inference caching last month — that's
  exactly the seam I hit at scale 4 in Sovereign Matrix's playbook
  runs. We solved it with [X]."
- "The candidate AI guidance you co-authored — I built Sovereign
  Matrix as a deliberate exercise in it."
- "Your YC W26 batch announcement — congrats. Saw you're hiring eng
  #1; founding work is exactly what I'm building toward."

## Tracking sheet (Notion, Linear, or a spreadsheet)

Columns:

- target_company
- target_role
- recipient_first_name
- recipient_linkedin_url
- role_signal (one line)
- email_sent_date
- dm_sent_date
- followup_1_date
- followup_2_date
- reply_status (replied / declined / ghost / closed)
- next_action
- next_action_date

## How many to send per week

- **Quality over volume.** 5 targeted sends/week beats 50 generic
  sends/week. Ten targets in tier 1 with custom signals will outperform
  100 in tier 2 with copy-paste.
- **Don't queue the whole batch on day 1.** Send 5/week so you can
  iterate on what's getting replies. The third week of sends should be
  meaningfully better than the first because of feedback.

## When to stop

- After 3 contacts (email + DM same day = 1 contact; days 4 + 10 =
  contacts 2 + 3) with no reply: archive the target. Do not chase
  beyond 3.
- After a "no thanks": polite thank, ask if anyone else on the team
  might be a better fit, then archive.
- After a "yes, when?": send the calendar link in the next reply, not
  later that day. Same-hour response when they're warm.
