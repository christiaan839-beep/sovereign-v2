# Sovereign Matrix — Launch Copy

Numbers in this file match `VIRAL-CONTENT.md`, `LAUNCH-CONTENT.md` and
`DOMINATION_PLAN.md`. The derivation for each one is in the verified-numbers
table at the bottom of `VIRAL-CONTENT.md`. If a number changes in the code,
change it in all four files in the same commit.

Nothing here names another company or describes another company's product,
pricing, security posture or infrastructure. We cannot substantiate claims
like that.

---

## Product Hunt

**Tagline (60 chars):**
140 AI agents. Flat pricing. Runs on your own hardware.

**Description:**
Sovereign Matrix is an agent platform for marketing and sales work: lead
research, content, competitor analysis, outbound sequences, voice calls.

140 specialised agents and 29 one-click playbooks. Point the router at your
own Ollama endpoint and inference runs on your hardware — the prompt, the
retrieved context and the output never leave your network. Prefer hosted
models and the router covers 20 models across 8 providers, choosing one per
task and falling back Gemini → NVIDIA NIM → Groq if the default path fails.

What makes it different:

- Flat pricing. Sovereign Node is $199/mo for 2,000 runs; Enterprise is
  $499/mo for 10,000 runs and the white-label dashboard. No credits, no
  per-token bill on the open-model routes.
- A 5-check pipeline on every output: jailbreak detection, PII scanning,
  content safety, quality scoring, and a critic pass by a second model.
- Consensus mode runs the same prompt through two or three different models
  and synthesises the answer.
- Four trust levels, from approve-everything to full auto with an audit trail.
- Voice agents that place real phone calls and identify themselves as AI.
- White-label for agencies: your logo, your domain, isolated client portals.

Try it free: scan any competitor's URL and get a written brief back. No
signup required.

**First Comment:**
Hey PH. I'm the builder behind Sovereign Matrix.

Most agent platforms bill per credit, per token or per seat, which means the
bill scales with how useful the thing is. We went the other way: a flat
monthly price and a router that prefers free open-model inference, so the
marginal cost of one more run is close to nothing.

The part I care most about is the local path. If you set an Ollama endpoint,
the router sends work there ahead of every hosted provider. For anyone
handling client records, case files or patient data, that turns "where does
this prompt go" from a policy question into a network question you can answer
yourself.

Try the free competitor scan — paste any URL, no signup, no card. Judge the
output yourself.

Happy to answer questions about the architecture, the router, or the pricing.

---

## LinkedIn Post

We just launched Sovereign Matrix.

140 autonomous agents that:
→ Find and qualify leads
→ Write content for blog, social and email
→ Produce a competitor brief from a URL
→ Place AI phone calls
→ Build landing pages
→ Run on a schedule or a webhook, without you in the loop

29 one-click playbooks across growth, content, intelligence and operations.
Flat pricing: $199/mo for the Sovereign Node tier, $499/mo for Enterprise
with the white-label dashboard.

The reason we built it this way:

Agent platforms are being handed real work — client lists, case files,
patient records, unsigned contracts. Most of them send that content to a GPU
somebody else owns, and the honest answer to "where did my data go" is a
vendor's sub-processor list.

Sovereign Matrix routes to your own Ollama endpoint first when you configure
one. Nothing leaves your network on that path. Alongside it:

• A 5-check pipeline on every output
• Four trust levels, from approve-everything to full auto
• An immutable execution audit trail
• Data export at /api/me/export

Try free: sovereignmatrix.agency/free/competitor-scan
No signup required. Paste any URL. Get a real brief back.

#AI #AgentOS #SovereignMatrix #AIAgents #Startup

---

## Twitter/X Thread

1/ We just shipped Sovereign Matrix.

140 agents. 29 playbooks. Flat pricing. Optional local-only execution.

Not a chatbot. Infrastructure for running business work autonomously.

Here's what it does 🧵

2/ Pricing is flat, not metered:

Starter $19/mo — 200 runs
Sovereign Node $199/mo — 2,000 runs, local execution
Enterprise $499/mo — 10,000 runs, white-label dashboard

No credits to top up. No per-token bill on the open-model routes.

3/ Every output passes 5 independent checks before you see it:

- Jailbreak detection
- PII scanning and redaction
- Content safety
- Quality scoring
- A critic pass by a second model

4/ The routing:

20 models across 8 providers, selected per task.

If you set an Ollama endpoint, that path is tried before any hosted provider
and your prompt never leaves your network.

If the default hosted path fails: Gemini → NVIDIA NIM → Groq.

5/ Four trust levels, because "autonomous" should be a dial:

L1 Supervised: you approve everything
L2 Guided: auto for routine, approve anomalies (default)
L3 Autonomous: auto, approve critical only
L4 Full Auto: with an audit trail

6/ Ask for a verified answer and consensus mode runs the same prompt through
two or three different models and synthesises where they agree.

Disagreement between models is a signal, and we surface it rather than
picking a winner silently.

7/ Try it. Free, no signup.

Paste a competitor URL, get weaknesses, market gaps and a plan.

sovereignmatrix.agency/free/competitor-scan

8/ Built in South Africa 🇿🇦

The models will change. The routing, the safety pipeline and the audit trail
are the parts that stay.

sovereignmatrix.agency/launch

---

## Compliance language (use verbatim, do not upgrade)

These are the only compliance statements cleared for launch copy. They match
what /security and /for-healthcare say on the live site.

- **SOC 2 Type II:** a readiness programme, not a certification we hold. The
  Trust Services Criteria are mapped and self-assessed on /trust. No audit
  firm has been engaged and we hold no report. Do not name a target date.
- **HIPAA:** HIPAA-aware controls. The Ollama local path supports air-gapped
  processing where patient data stays on the customer's infrastructure. A BAA
  is available for enterprise deployments. Not "HIPAA-compliant", not
  "HIPAA-certified".
- **GDPR and POPIA:** designed to be compliant, with PII scanning and
  redaction in the output pipeline and data export at /api/me/export. Say
  "designed to be compliant", not "compliant".
- **ISO 27001 and PCI DSS:** no claim. We hold neither and have no programme
  in flight. Leave them out of the copy entirely.
