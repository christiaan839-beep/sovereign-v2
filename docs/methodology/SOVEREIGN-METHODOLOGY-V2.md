# Sovereign Methodology v2

**Audit-grade agentic prompting for Claude Opus 4.7, Sonnet 4.6, and beyond.**

_Field-tested on the Sovereign Matrix platform — 140+ production agents,
3,827 conformance tests, 354 static pages, 9 OSS packages._

_Updated 2026-05-19 to incorporate the Opus 4.7 literal-execution shift._

---

## TL;DR

If you take three things from this doc:

1. **Prompts are now contracts.** Opus 4.7 stopped inferring intent.
   Every requirement must be literal, enumerated, and tagged.

2. **`<search_first>` is not optional.** For any present-day factual
   claim, the model must defer to live data. The tag is a documented
   anti-hallucination primitive — use it.

3. **Specialise, then delegate.** A coordinator with one giant
   capability set hallucinates more than three specialist agents with
   one capability each. Decompose by responsibility, not by model.

The rest of this doc shows the exact patterns the Sovereign Matrix
platform uses in production.

---

## Part 1 — The literal-execution shift

### Before Opus 4.7

A one-sentence prompt like:

```
"You are a strategic business intelligence analyst.
Provide structured, actionable insights. No generic commentary."
```

…worked. The model would infer "actionable" means "concrete next steps",
"structured" means "bullets or sections", "no generic commentary" means
"skip the closing 'in conclusion' paragraph". Sonnet 4.0 → Opus 4.6
inferred liberally and often went above-and-beyond on intent.

### After Opus 4.7

Opus 4.7 follows the prompt literally. The same one-sentence prompt
produces:

- Generic 5-paragraph essay
- Closing "in conclusion" paragraph
- Hedged recommendations ("you may want to consider")
- No clear action verbs

Why: with literal execution, "actionable insights" can be hedged
recommendations because the prompt didn't forbid hedging. "Structured"
can be one big paragraph because the prompt didn't specify the structure.
"No generic commentary" can still allow closing flourishes because the
prompt didn't define "generic".

### The fix: spell out every constraint

Same task, Opus 4.7-ready:

```xml
<role>
You are a strategic business intelligence analyst working for an
operator who must make a decision in the next 24 hours.
</role>

<capacity>
- Synthesise complex inputs into structured, actionable intelligence
- Surface non-obvious second-order effects
- Quantify risk and opportunity where the input supports it
- Refuse to produce generic commentary, hedging, or filler
</capacity>

<output_requirements>
- Lead with the single most important insight (one sentence)
- Follow with 3-5 concrete recommendations, each with a clear action verb
- Identify 2-3 risks the operator may not have considered
- Numbers, dates, and proper nouns must be verbatim from the input
  unless the input is silent — never fabricate facts to fill structure
</output_requirements>

<search_first>
For any factual claim about present-day market state, competitor
moves, regulation, or pricing, you MUST flag it as "verify before
acting" — do not assert pre-training-cutoff facts as if they were
current.
</search_first>
```

This is the actual prompt deployed at
`src/app/api/_agents/god-brain/route.ts` (Wave 82). The pattern is:

| Section                 | What it does                                                       |
| ----------------------- | ------------------------------------------------------------------ |
| `<role>`                | Who is the model + who is the operator + what is the time pressure |
| `<capacity>`            | Bulleted list of duties + a refusal clause                         |
| `<output_requirements>` | Format, structure, faithful-to-input rules                         |
| `<search_first>`        | What present-day claims need verification                          |

---

## Part 2 — The CRISPE framework

CRISPE = **C**apacity, **R**ole, **I**nsight, **S**tatement,
**P**ersonality, **E**xperiment. Six components. Map them to XML tags
and Opus 4.7 follows them literally.

### Capacity

What the model can do. List the duties + the refusals.

```xml
<capacity>
- Validate input schemas against published JSON Schema
- Reject any input that doesn't parse — never coerce
- Quote regulation-clause numbers verbatim from the input
</capacity>
```

### Role

Who the model is + who they're talking to.

```xml
<role>
You are a senior compliance auditor reviewing a regulator's
draft objection letter on behalf of an operator who must
respond in 5 business days.
</role>
```

### Insight

Context the model needs but isn't in the user message.

```xml
<insight>
The operator has 12 months of VAOS receipts. The receipts are
cryptographically signed and reproducible. The auditor has access
to the same receipts and will re-derive any numbers you cite.
</insight>
```

### Statement (the actual task)

This goes in the user message. Keep the system prompt about the
agent's identity, not the immediate task.

### Personality

Voice and stance. Concrete tone constraints.

```xml
<personality>
Authoritative, not deferential. Surgical, not exhaustive. State
positions; do not present every side.
</personality>
```

### Experiment

Few-shot examples (positive AND negative).

```xml
<examples_good>
"§ 3 block-rate of 0.34% is below the Annex IV warning threshold."
</examples_good>

<examples_bad>
"It's important to note that block rates can vary widely..."
(rejected — hedged, doesn't decide)
</examples_bad>
```

---

## Part 3 — `<search_first>` and the anti-hallucination contract

The `<search_first>` tag is documented in Anthropic's extracted Claude
4 system prompts. It tells the model: for any factual claim about the
present-day world, defer to live data instead of training-cutoff
knowledge.

Three deployment patterns:

### Pattern A — block-and-search

If your agent has web-search tools, force it to search before
answering:

```xml
<search_first>
For any factual question about the present-day world (prices,
leaders, regulation, company status, current events), you MUST call
the web_search tool before answering. Your confidence about a topic
is not an excuse to skip the search.
</search_first>
```

### Pattern B — flag-and-defer

If your agent has no live data access (like every Claude inside an
API request without tool-use), force it to mark stale claims:

```xml
<search_first>
You do not have live web access. For any present-day claim (current
pricing, current regulation, current competitor status), append the
string "[VERIFY]" immediately after the claim. Do not assert
pre-training-cutoff facts as if they were current.
</search_first>
```

This is the pattern Sovereign Matrix uses on every customer-facing
analytical agent (`competitor`, `god-brain`, the war-room leads).

### Pattern C — domain-restricted

For agents that ARE supposed to use pre-training-cutoff knowledge in
narrow domains:

```xml
<search_first>
For mathematical proofs, RFC specifications, and ISO/IEC standards,
your training data is authoritative — do not flag these. For
company-specific claims (pricing, headcount, funding), flag with
"[VERIFY]" since these change frequently.
</search_first>
```

---

## Part 4 — Multi-agent delegation patterns

When you orchestrate multiple Claude agents, three patterns dominate
the win column.

### Parallelisation

Fan out independent sub-tasks simultaneously, synthesise their
outputs. Sovereign Matrix's war-room runs 4 parallel specialist
analyses (Market, Technical, Growth, Devil's Advocate) before the
Strategic Commander synthesises.

```ts
const analysisPromises = team.members.map(async (member) => {
  return await ai(prompt, {
    system: member.systemPrompt, // ← CRISPE-shaped
    model: "cerebras", // ← fast, free, parallel-safe
    maxTokens: 2000,
  });
});
const perspectives = await Promise.all(analysisPromises);
```

Pattern fit:

- Independent analyses with no causal dependency
- Different angles on the same input (perspective-based)
- Different documents to read in parallel
- Different rule sets to apply to the same payload

### Specialisation

Route each task to a highly-scoped worker. Don't load a single agent
with "be an SEO strategist + a copywriter + a distribution expert" —
deploy three agents, each with a single role.

```ts
// Bad — one bloated prompt
const result = await ai(prompt, {
  system:
    "You are an SEO strategist, a copywriter, and a distribution expert. Do all three.",
});

// Good — three specialised agents
const [seo, copy, dist] = await Promise.all([
  ai(prompt, { system: SEO_PROMPT }),
  ai(prompt, { system: COPY_PROMPT }),
  ai(prompt, { system: DIST_PROMPT }),
]);
const synthesis = await ai(synthesisPrompt, { system: EDITOR_PROMPT });
```

The specialist prompts are short and sharp; the editor prompt is
CRISPE-shaped because it must DECIDE.

### Escalation

Lightweight routers (cheap models) handle 80% of traffic; heavyweight
specialists handle the long tail.

```ts
const routing = await ai(prompt, {
  system: ROUTER_PROMPT,
  model: "cerebras", // free, 2k+ tok/s
  maxTokens: 200,
});

if (routing.complexity === "high") {
  return await ai(prompt, {
    system: SPECIALIST_PROMPT,
    model: "claude", // Opus 4.7, expensive
    useOpus: true,
    thinking: true,
  });
}
return routing.answer;
```

Sovereign Matrix's `smart-router` and `intent-router` follow this
pattern. ~12× cost savings vs always-on Opus.

---

## Part 5 — Extended thinking and chain-of-thought

For deep planning, routing, and multi-step reasoning, Opus 4.7 +
extended thinking shows large gains. The trade-off: ~3× more output
tokens, but the output quality is qualitatively different — the model
explicitly considers second-order effects rather than just producing
plausible-sounding text.

### When to enable

| Task                            | Extended thinking? |
| ------------------------------- | ------------------ |
| Single-pass classification      | No                 |
| Short summarisation             | No                 |
| Routing decisions               | No                 |
| Strategic synthesis (3+ inputs) | **Yes**            |
| Adversarial debate output       | **Yes**            |
| Regulatory drafting             | **Yes**            |
| Compliance gap analysis         | **Yes**            |
| Code review of critical paths   | **Yes**            |

### How to wire it

```ts
const result = await ai(prompt, {
  model: "claude",
  thinking: true,
  useOpus: true,
});
```

The `thinking: true` flag activates extended thinking. The model
reasons in a private `<thinking>` block before producing the final
answer. You see only the final answer, but the answer is qualitatively
better.

---

## Part 6 — Heuristics over hardcoded logic

Brittle, deeply-prescribed prompts break on the first edge case. The
correct prompt-engineering posture is to:

1. State the SUCCESS CRITERIA (what does a good output look like?)
2. State the BOUNDARY CONDITIONS (what's allowed / forbidden?)
3. Provide 1-3 few-shot examples (both positive AND negative)
4. Trust the model to find the path within those guardrails

```xml
<success_criteria>
A good output:
- Names the SINGLE most important next move (one sentence)
- Gives 3-5 concrete actions, each with an owner role + deadline
- Identifies risks the operator may not have considered
</success_criteria>

<boundary_conditions>
You MUST NOT:
- Recommend "consider X" without naming the action
- Fabricate numbers, dates, or proper nouns
- Produce a closing paragraph of generic encouragement
You MAY:
- Decline to recommend an action if the input is genuinely insufficient
- Tag any claim with "[VERIFY]" if you're uncertain about it
</boundary_conditions>

<example_good>
"Cut the enterprise tier from $499/mo to $299/mo this quarter. Owner:
CFO. Trigger: completion of pricing experiment 2026-Q3."
</example_good>

<example_bad>
"Consider exploring various pricing strategies that might appeal
to enterprise customers in the coming months."
(rejected — hedged, no owner, no trigger, no numbers)
</example_bad>
```

The example_bad is critical. Without it, Opus 4.7 will sometimes
produce exactly that sentence and consider the task done.

---

## Part 7 — The Sovereign Matrix tag taxonomy

Across the platform, these XML tags appear consistently. Adopt them
for cross-team prompt readability.

| Tag                     | Where it goes    | Purpose                                     |
| ----------------------- | ---------------- | ------------------------------------------- |
| `<role>`                | System prompt    | Who is the model + who is the operator      |
| `<capacity>`            | System prompt    | What the model can do; what it refuses      |
| `<step_by_step>`        | System prompt    | Multi-stage tasks; enforces ordering        |
| `<output_requirements>` | System prompt    | Format, structure, faithfulness rules       |
| `<search_first>`        | System prompt    | Anti-hallucination contract                 |
| `<success_criteria>`    | System prompt    | What a good output looks like               |
| `<boundary_conditions>` | System prompt    | MUST NOT / MAY                              |
| `<example_good>`        | System prompt    | Positive few-shot                           |
| `<example_bad>`         | System prompt    | Negative few-shot (rejected output)         |
| `<frontend_aesthetics>` | UI-coding agents | Forbid generic design defaults              |
| `<context>`             | User prompt      | Background the model needs                  |
| `<task>`                | User prompt      | The specific thing to do right now          |
| `<received>`            | User prompt      | Inputs from other agents (for synthesisers) |

---

## Part 8 — Worked example: the four-framework compliance pipeline

Here is the full prompt used in production for the Strategic
Commander synthesising war-room debate. Production file:
`src/lib/agent-teams.ts` (Wave 83).

```xml
<role>
You are the Strategic Commander. Four specialist analysts and one
devil's advocate have already debated the objective. Your job is to
DECIDE — to merge the perspectives into a single executable battle
plan and own the trade-offs the team disagreed on.
</role>

<step_by_step>
(1) Read all four specialist analyses + all critique rounds.
(2) Identify the SINGLE move with the highest expected impact. Lead
    your output with this. One sentence. No hedging.
(3) Identify the next 3-5 moves, ranked by impact × confidence.
(4) For each move, name: owner role, deadline (this week / this
    quarter / this year), and a binary success criterion the
    operator can measure on day-N.
(5) Identify 2-3 specific risks the team raised that you are
    explicitly accepting (with the rationale).
(6) End with a one-line "Kill criteria" — what observable signal
    would cause you to abandon this plan in the next 30 days.
</step_by_step>

<output_requirements>
- Lead with the central decision. No setup paragraph.
- No "Based on the analyses…" preamble. The operator knows.
- Use action verbs (ship, retire, raise, lower, hire, fire, replace).
- Numbers and proper nouns must come from the analyses verbatim.
- Refuse to recommend "we should consider" — recommend specifically.
</output_requirements>

<search_first>
Tag every present-day market claim (competitor pricing, regulation
state, customer-count claims) with "[VERIFY]" since the underlying
analyses may have used stale facts.
</search_first>
```

Notice:

- The `<role>` ends with a verb ("Your job is to DECIDE")
- `<step_by_step>` has 6 specific numbered steps with binary
  outcomes (no "consider" verbs)
- `<output_requirements>` lists 5 explicit refusals
- `<search_first>` instructs the synthesiser to tag stale claims
  from the analysts upstream

This prompt produces battle plans that fit on one page and make
decisions the team can execute Monday morning.

---

## Part 9 — Checklist for new agent prompts

Before deploying any new system prompt:

- [ ] Does the prompt say WHO the operator is and what time pressure they're under?
- [ ] Does `<capacity>` enumerate both duties AND refusals?
- [ ] Does `<output_requirements>` explicitly forbid generic patterns
      (hedging, "consider", closing paragraphs)?
- [ ] Is there a `<search_first>` tag if the agent makes present-day
      factual claims?
- [ ] If the task is multi-step, is `<step_by_step>` enumerated?
- [ ] Are there at least one `<example_good>` AND one `<example_bad>`?
- [ ] Does the prompt avoid baking in brittle hardcoded logic (lists
      of specific strings to match, fixed-length outputs)?
- [ ] Does the prompt fit in the operator's mental model — could a
      new team member read it and understand the agent's job in 60
      seconds?

---

## Part 10 — What we learned in production

After ~6 weeks of running CRISPE/XML prompts in production at
Sovereign Matrix:

1. **Output length compresses by ~20-30%** because Opus 4.7 stops
   producing hedge-padding. The signal-to-token ratio rises.

2. **Cross-agent reliability rises sharply.** When the war-room's
   Strategic Commander returns a structured plan, downstream pipelines
   (Slack post-and-archive, CRM action-creation, Notion log-update)
   no longer break on free-form text variations.

3. **`<search_first>` produces visible "[VERIFY]" tags in customer-
   facing outputs.** This is GOOD — it surfaces uncertainty to the
   operator and stops compliance teams from blindly quoting model
   claims as fact.

4. **Few-shot negative examples (`<example_bad>`) are the single most
   effective addition.** A prompt with a single rejected example
   nearly always beats a prompt with three positive examples and no
   negatives.

5. **Specialist + escalation is cheaper at scale than one-big-Opus.**
   The Sovereign Matrix routing layer drops ~75% of traffic onto free
   Cerebras / NIM / Groq models; only the long tail (genuinely hard
   reasoning) hits paid Opus + thinking. ~12× cost reduction at
   identical quality on internal benchmarks.

---

## Provenance

This document is licensed CC0 — copy, fork, paste into your team's
docs, no attribution required. Pull requests welcome.

Companion code (all Apache 2.0):

- `@sovereign-matrix/verifiable-receipts` — receipt primitive
- `@sovereign-matrix/annex-iv` — EU AI Act Annex IV exporter
- `@sovereign-matrix/iso-42001` — ISO/IEC 42001 AIMS exporter
- `@sovereign-matrix/nist-ai-rmf` — NIST AI RMF 1.0 profile exporter
- `@sovereign-matrix/soc2-evidence` — SOC 2 evidence binder
- `@sovereign-matrix/openai-receipts` — OpenAI SDK wrapper
- `@sovereign-matrix/anthropic-receipts` — Anthropic SDK wrapper
- `@sovereign-matrix/google-receipts` — Google Gemini SDK wrapper
- `@sovereign-matrix/ai-sdk-receipts` — Vercel AI SDK wrapper
- `@sovereign-matrix/mcp` — MCP server exposing all of the above as
  tools to Claude Code / Cursor

The patterns in this doc are deployed in
`src/app/api/_agents/god-brain/route.ts`,
`src/app/api/_agents/competitor/route.ts`, and
`src/lib/agent-teams.ts`.

---

_Sovereign Matrix · 2026-05-19 · v2.0 · Cape Town_
