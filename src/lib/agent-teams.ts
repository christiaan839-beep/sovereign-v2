/**
 * SOVEREIGN MATRIX — Agent Teams
 *
 * Multi-agent debate system where specialized agents work in separate
 * contexts, coordinated by a lead agent. Each agent brings a different
 * perspective, and the lead synthesizes the final output.
 *
 * Members run in parallel rather than in a sequential chain, so each
 * writes its critique without having seen the others' conclusions. That
 * independence is what makes the lead's synthesis worth more than the
 * first member's answer.
 *
 * Usage:
 *   const result = await runAgentTeam({
 *     objective: "Analyze competitor HubSpot and find their weak points",
 *     team: "war-room",
 *   });
 */

import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-teams");

interface TeamMember {
  role: string;
  perspective: string;
  systemPrompt: string;
}

interface TeamConfig {
  name: string;
  lead: TeamMember;
  members: TeamMember[];
  maxDebateRounds: number;
}

interface TeamResult {
  team: string;
  objective: string;
  perspectives: Array<{ role: string; analysis: string }>;
  debate: Array<{
    round: number;
    critiques: Array<{ from: string; to: string; critique: string }>;
  }>;
  synthesis: string;
  confidence: number;
  duration: number;
}

// ── Pre-built Team Configurations ──

const TEAMS: Record<string, TeamConfig> = {
  "war-room": {
    name: "War Room",
    lead: {
      role: "Strategic Commander",
      perspective: "synthesis",
      // Opus 4.7 prompt pattern (Wave 83): literal-execution CRISPE
      // + XML tags + step-by-step. The Strategic Commander synthesises
      // 4 specialist analyses + 4 critiques into ONE battle plan; the
      // model must NOT re-analyse or summarise, it must DECIDE.
      systemPrompt: `<role>
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
</search_first>`,
    },
    members: [
      {
        role: "Market Analyst",
        perspective: "market",
        systemPrompt:
          "You are a Market Analyst. Analyze market positioning, pricing strategy, target audience, and competitive landscape. Identify gaps and opportunities. Use data-driven reasoning.",
      },
      {
        role: "Technical Auditor",
        perspective: "technical",
        systemPrompt:
          "You are a Technical Auditor. Analyze technology stack, infrastructure, performance, security posture, and engineering decisions. Identify technical advantages and vulnerabilities.",
      },
      {
        role: "Growth Hacker",
        perspective: "growth",
        systemPrompt:
          "You are a Growth Hacker. Analyze acquisition channels, conversion funnels, content strategy, SEO positioning, and viral mechanics. Find the fastest path to market share.",
      },
      {
        role: "Devil's Advocate",
        perspective: "critique",
        systemPrompt:
          "You are the Devil's Advocate. Challenge every assumption. Find holes in the analysis. Identify risks the team is blind to. Be constructively contrarian — your job is to make the plan stronger by stress-testing it.",
      },
    ],
    maxDebateRounds: 2,
  },

  "content-council": {
    name: "Content Council",
    lead: {
      role: "Editor-in-Chief",
      perspective: "editorial",
      // Opus 4.7 prompt pattern (Wave 83) — see Strategic Commander above.
      systemPrompt: `<role>
You are the Editor-in-Chief. Three specialists (SEO, copywriting,
distribution) have debated a content objective. Your job is to ship
a content calendar — not to summarise the debate.
</role>

<step_by_step>
(1) Read all three specialist analyses + critiques.
(2) Output a prioritised content calendar for the next 4 weeks. Each
    row: piece title, format (post/video/long-form/email), week to
    ship, channel owner, target audience, expected primary metric
    (clicks / leads / sign-ups / shares).
(3) For each piece, name ONE distribution moment that turns it from
    "content" into "leverage" (re-cut for X, syndicate to Reddit,
    pitch to a podcast, etc.).
(4) End with a single "kill criteria" — what would make us pull a
    piece from the queue.
</step_by_step>

<output_requirements>
- Output the calendar as a table or numbered list. Not prose.
- Every entry must be a piece someone can start writing today.
- No fluff entries ("a thoughtful exploration of…").
- If the specialists disagreed, you decide and state the trade-off
  briefly in one sentence.
</output_requirements>

<search_first>
SEO + keyword data may be stale; tag with "[VERIFY VOLUME]" where
search volumes are claimed.
</search_first>`,
    },
    members: [
      {
        role: "SEO Strategist",
        perspective: "seo",
        systemPrompt:
          "You are an SEO Strategist. Analyze keyword opportunities, content gaps, search intent, and ranking potential. Every recommendation must have search volume and difficulty data.",
      },
      {
        role: "Copywriter",
        perspective: "copy",
        systemPrompt:
          "You are a Senior Copywriter. Focus on messaging, tone, hooks, and conversion copy. Every piece must have a clear CTA and emotional resonance.",
      },
      {
        role: "Distribution Expert",
        perspective: "distribution",
        systemPrompt:
          "You are a Distribution Expert. For every content piece, define the optimal channels, posting times, repurposing strategy, and amplification tactics.",
      },
    ],
    maxDebateRounds: 1,
  },

  "deal-room": {
    name: "Deal Room",
    lead: {
      role: "Sales Director",
      perspective: "strategy",
      // Opus 4.7 prompt pattern (Wave 83) — same family as the other leads.
      systemPrompt: `<role>
You are the Sales Director. Three specialists (account researcher,
competitive intel, objection coach) have analysed a prospect. Your
job is to ship a deal strategy a closer can walk into a call with
tomorrow morning.
</role>

<step_by_step>
(1) Read all three specialist analyses + critique rounds.
(2) Output a tight qualification assessment: GO / NO-GO / HOLD with
    the SINGLE biggest reason.
(3) If GO: list 3 negotiation anchors (price, term, scope) ranked by
    leverage.
(4) Build an objection-handling table: top 5 likely objections with
    one-sentence counters that name a proof point (case study,
    receipt, signed customer).
(5) Project a close timeline: meeting cadence, key decision dates,
    drop-dead date past which we walk.
(6) End with one "deal-breaker" — what would cause us to disqualify
    on the next call.
</step_by_step>

<output_requirements>
- Lead with GO / NO-GO / HOLD. One word. Then the reason.
- No vague "build rapport" advice. Concrete moves.
- Prices and timelines must come from the analyses, not from memory.
- If the analyses disagreed, you decide — name the trade-off.
</output_requirements>

<search_first>
Funding-round / headcount / customer-count claims from the account
researcher may be stale — tag with "[VERIFY]" before quoting them
back to the prospect.
</search_first>`,
    },
    members: [
      {
        role: "Account Researcher",
        perspective: "account",
        systemPrompt:
          "You are an Account Researcher. Analyze the prospect's company, decision-makers, recent news, funding, tech stack, and pain points. Every insight must be actionable for sales.",
      },
      {
        role: "Competitive Intel",
        perspective: "competitive",
        systemPrompt:
          "You are the Competitive Intelligence agent. Identify what competitors are pitching this account, their pricing, and their weaknesses. Find the angle that makes us the obvious choice.",
      },
      {
        role: "Objection Coach",
        perspective: "objections",
        systemPrompt:
          "You are the Objection Coach. Anticipate every objection the prospect will raise (price, timeline, risk, switching cost, internal politics). For each, provide a specific counter with proof points.",
      },
    ],
    maxDebateRounds: 1,
  },
};

// ── Core Team Execution Engine ──

/**
 * Run an Agent Team — parallel analysis, adversarial debate, unified synthesis.
 */
export async function runAgentTeam(options: {
  objective: string;
  team: keyof typeof TEAMS;
  context?: string;
}): Promise<TeamResult> {
  const { objective, team: teamKey, context } = options;
  const team = TEAMS[teamKey];
  if (!team)
    throw new Error(
      `Unknown team: ${teamKey}. Available: ${Object.keys(TEAMS).join(", ")}`,
    );

  const startTime = Date.now();
  log.info(`[${team.name}] Starting team analysis`, {
    objective: objective.slice(0, 100),
  });

  // Phase 1: Parallel independent analysis from each team member
  const analysisPromises = team.members.map(async (member) => {
    const prompt = context
      ? `Objective: ${objective}\n\nAdditional context:\n${context}\n\nProvide your ${member.role} analysis.`
      : `Objective: ${objective}\n\nProvide your ${member.role} analysis.`;

    // Cost: parallel member analyses are short reasoning chunks. Route to
    // Cerebras (free, 2k+ tok/s) — falls back to Groq if no Cerebras key.
    // Paid Gemini here cost ~10× per debate with no quality lift.
    const analysis = await ai(prompt, {
      system: member.systemPrompt,
      model: "cerebras",
      maxTokens: 2000,
    });

    return { role: member.role, analysis };
  });

  const perspectives = await Promise.all(analysisPromises);
  log.info(`[${team.name}] ${perspectives.length} perspectives collected`);

  // Phase 2: Adversarial debate rounds
  const debate: TeamResult["debate"] = [];

  for (let round = 0; round < team.maxDebateRounds; round++) {
    const critiques: Array<{ from: string; to: string; critique: string }> = [];

    // Each member critiques one other member's analysis
    for (let i = 0; i < perspectives.length; i++) {
      const critic = perspectives[i];
      const target = perspectives[(i + 1) % perspectives.length];

      const critiquePrompt = `You are ${critic.role}. Review this analysis from ${target.role} and provide constructive critique. What did they miss? What assumptions are wrong? What should they reconsider?

Their analysis:
${target.analysis}

Original objective: ${objective}

Keep your critique to 3-4 specific points. Be constructive but rigorous.`;

      // Cost: critiques are short (~800 tokens). Cerebras is purpose-built
      // for this — falls back to Groq if no key. Was paid Gemini per critique.
      const critique = await ai(critiquePrompt, {
        system:
          critic.role === "Devil's Advocate"
            ? "You are the Devil's Advocate. Be especially rigorous. Challenge assumptions with specific counter-examples."
            : `You are ${critic.role}. Critique from your area of expertise.`,
        model: "cerebras",
        maxTokens: 800,
      });

      critiques.push({ from: critic.role, to: target.role, critique });
    }

    debate.push({ round: round + 1, critiques });

    // If there's another round, let members update their analysis based on critiques
    if (round < team.maxDebateRounds - 1) {
      for (let i = 0; i < perspectives.length; i++) {
        const member = perspectives[i];
        const receivedCritiques = critiques
          .filter((c) => c.to === member.role)
          .map((c) => `${c.from}: ${c.critique}`)
          .join("\n\n");

        if (receivedCritiques) {
          // Cost: refinement is structured reasoning over received critiques.
          // Cerebras handles this without quality drop; Gemini was paid noise.
          const refinedAnalysis = await ai(
            `Refine your original analysis based on this feedback:\n\n${receivedCritiques}\n\nOriginal objective: ${objective}\n\nYour original analysis:\n${member.analysis}\n\nProvide your updated analysis addressing the valid critiques.`,
            {
              system: team.members[i].systemPrompt,
              model: "cerebras",
              maxTokens: 2000,
            },
          );
          perspectives[i] = { ...member, analysis: refinedAnalysis };
        }
      }
    }
  }

  log.info(`[${team.name}] ${debate.length} debate rounds completed`);

  // Phase 3: Lead synthesizes all perspectives + debate into final output
  const synthesisPrompt = `You are leading a team of ${perspectives.length} specialists. They have each analyzed this objective independently and debated their perspectives.

OBJECTIVE: ${objective}

TEAM ANALYSES:
${perspectives.map((p) => `\n### ${p.role}\n${p.analysis}`).join("\n")}

${debate.length > 0 ? `\nDEBATE HIGHLIGHTS:\n${debate.map((d) => d.critiques.map((c) => `${c.from} → ${c.to}: ${c.critique}`).join("\n")).join("\n\n")}` : ""}

Synthesize everything into a single, decisive output. Include:
1. Executive summary (3 sentences)
2. Key findings (prioritized by impact)
3. Recommended actions (specific, with owners and timelines)
4. Risks and mitigations
5. Confidence assessment (how confident is the team in these conclusions?)

Be concise, specific, and actionable. No fluff.`;

  // Cost: synthesis is the one call that benefits from a strong model.
  // NIM Nemotron-Ultra-253B is free and outperforms Gemini Flash on
  // structured synthesis; pin to NIM rather than paid Gemini.
  const synthesis = await ai(synthesisPrompt, {
    system: team.lead.systemPrompt,
    model: "nim",
    maxTokens: 3000,
  });

  const duration = Date.now() - startTime;
  log.info(`[${team.name}] Synthesis complete`, { duration: `${duration}ms` });

  // Extract confidence from the synthesis (look for percentage or rating)
  const confidenceMatch = synthesis.match(/(\d{1,3})%?\s*confiden/i);
  const confidence = confidenceMatch
    ? parseInt(confidenceMatch[1]) / 100
    : 0.75;

  return {
    team: team.name,
    objective,
    perspectives,
    debate,
    synthesis,
    confidence: Math.min(confidence, 1),
    duration,
  };
}

/** List available teams */
export function getAvailableTeams() {
  return Object.entries(TEAMS).map(([key, team]) => ({
    key,
    name: team.name,
    members: team.members.map((m) => m.role),
    lead: team.lead.role,
  }));
}
