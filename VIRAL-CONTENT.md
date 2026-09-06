# Sovereign Matrix — Viral Content Strategy

All numbers below are drawn from the repository and re-derivable. See
"Verified numbers" at the bottom for the command or file behind each one.
Do not publish a number that is not on that list.

**No competitor claims.** Nothing in this file names another company or
characterises how another company handles customer data, prices its product,
or performs. We cannot substantiate claims like that, and a comparison we
cannot defend is worth less than a capability we can demonstrate. Lead with
what the platform does.

---

## Demo Video Script (screen record /demo/mission)

```
[open]  Black screen → "SOVEREIGN MATRIX" fades in with emerald glow
        Text types: "Find 50 fintech companies in London and draft outreach"
        Step 1 lights up: "Finding prospects..." → completes → ✅
        Step 2 lights up: "Analyzing market..." → completes → ✅
        Step 3 lights up: "Drafting emails..." → completes → ✅
        Summary card: read the elapsed time and step counts off the actual run
        Cut to: "Point it at your own Ollama instance and the prompt never
                 leaves your network."
        Show: Mission Control with a second goal executing
        Show: "First 10 users get the Founder plan free"
        CTA: "sovereignmatrix.agency — built in South Africa 🇿🇦"
```

Record the run before writing the caption. Whatever duration and result
counts the run prints on the summary card are the numbers that go in the
post. Do not pre-write a timing and then hunt for a run that matches it.

---

## LinkedIn Post (copy this)

Most AI agent tools send your prompt to somebody else's GPU. That is fine
until the prompt contains a client list, a patient record, or an unsigned
contract.

Sovereign Matrix runs the same agents against inference you control.

Set an Ollama endpoint in settings and the router sends work there first.
The prompt, the retrieved context, and the output stay inside your network.
No provider key required for that path, and nothing to redact after the fact
because nothing left.

When you do want hosted models, the router covers 20 models across 8
providers and picks one per task. If the default path fails it falls back
Gemini → NVIDIA NIM → Groq before it gives up.

What the platform ships with:

→ 140 specialised agents
→ 29 one-click playbooks across growth, content, intelligence and operations
→ A 5-check output pipeline on every response: jailbreak detection, PII
scanning, content safety, quality scoring, and a critic pass by a second
model
→ Four trust levels, from approve-everything to full auto with an audit trail

One goal in. The system picks the agents, runs the pipeline, returns the work.

The first 10 users get the Founder plan free: 10,000 runs a month, every
playbook, no card.

Watch the demo: [link to screen recording]
Sign up: sovereignmatrix.agency

#AI #SaaS #AIAgents #BuildInPublic

---

## X/Twitter Thread (copy this)

Tweet 1:
Your AI agent stack has a data question nobody asks out loud: where does the
prompt go?

I built one where the answer can be "nowhere".

Thread 🧵

Tweet 2:
Sovereign Matrix routes to a local Ollama endpoint first when you set one.

Prompt, context, output — all on your hardware. Air-gapped runs are a
configuration, not a special edition.

Tweet 3:
When you want hosted inference instead, the router covers 20 models across
8 providers and selects per task.

Default path falls back Gemini → NVIDIA NIM → Groq before it errors.

Tweet 4:
What's in the box:

• 140 specialised agents
• 29 one-click playbooks
• 5-check output pipeline on every response
• 2-3 model consensus when you ask for a verified answer
• Webhook triggers, so agents run without you in the loop

Tweet 5:
Pricing is flat, not metered.

Sovereign Node: $199/mo, 2,000 runs, local execution.
Enterprise: $499/mo, 10,000 runs, white-label dashboard.
Starter: $19/mo, 200 runs.

No credits. No per-token bill on the open-model routes.

Tweet 6:
First 10 users get the Founder plan free — 10,000 runs a month, no card.

sovereignmatrix.agency

Built in South Africa 🇿🇦

---

## TikTok/Reels Script (15 seconds)

[Screen recording of Mission Control]
Voiceover: "Where does your AI agent send your data?"
[Step 1 completes] "This one can send it nowhere."
[Step 2 completes] "Local inference. 140 agents."
[Step 3 completes] "One goal in, finished work out."
[Summary appears] "Sovereign Matrix. First 10 users free."
Text overlay: sovereignmatrix.agency

---

## Reddit Posts

r/SaaS:
"I built an agent platform with 140 agents that can run entirely on your own
hardware — giving 10 people the Founder plan free"

r/Entrepreneur:
"I got tired of not knowing where my AI tools send client data, so I built a
platform that routes to local inference first"

r/ArtificialIntelligence:
"20 models, 8 providers, a 5-check output pipeline and a local-first router —
here's the architecture"

r/selfhosted:
"Multi-agent platform that routes to your Ollama endpoint before it touches a
hosted provider"

---

## Verified numbers (the only ones cleared for publication)

| Claim                                     | Where it comes from                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| 140 agents                                | `npm run check:registry` prints "registry up to date — 140 agents"                         |
| 29 playbooks, 4 categories                | `PLAYBOOKS` array in `src/lib/playbooks.ts`                                                |
| 20 models across 8 providers              | entries and distinct `provider` values in the `MODELS` record, `src/lib/model-registry.ts` |
| Fallback order Gemini → NVIDIA NIM → Groq | the nested catch chain in `_aiInternal`, `src/lib/ai.ts`                                   |
| Local path routed first                   | `if (userKeys.ollama)` branch ahead of every hosted provider, `src/lib/ai.ts`              |
| 5-check output pipeline                   | `src/lib/output-verifier.ts`                                                               |
| 2-3 model consensus                       | `models?: 2 \| 3` in `consensusAi` options, `src/lib/consensus.ts`                         |
| 4 trust levels                            | `type TrustLevel = 1 \| 2 \| 3 \| 4`, `src/lib/trust-levels.ts`                            |
| 4,510 passing tests across 295 files      | `npm test` on this tree (4 additional tests skipped)                                       |
| 252,000 non-blank lines of TypeScript     | non-blank line count over `src/**/*.ts{,x}`                                                |
| Prices and run quotas                     | `PLANS` in `src/lib/plans.ts`                                                              |
| Founder plan free, 10,000 runs/month      | `founder` entry in `src/lib/plans.ts`                                                      |
| Built in South Africa 🇿🇦                  | —                                                                                          |

Claims deliberately absent, because the repository cannot support them:
pipeline timings, competitor pricing, market-size forecasts, failover depth
beyond the three-step chain above, and any statement about another company's
product or infrastructure.
