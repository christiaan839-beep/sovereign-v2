import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";
import { research_ai } from "@/lib/ai";

/**
 * NEMOCLAW ORCHESTRATOR — The God-Chain.
 * 
 * Chains multiple NemoClaw agents together automatically.
 * Input a target URL or task → it runs the full kill chain:
 * 1. RECON: Scrape + analyze the target (Tavily + Nemotron Ultra)
 * 2. AUDIT: Score UX, SEO, security, performance (Nemotron Ultra)
 * 3. STRATEGY: Generate counter-strategy (DeepSeek V3.2 + Mistral)
 * 4. BUILD: Generate superior assets (Devstral 123B)
 * 5. DEPLOY: Produce deployment-ready deliverables
 * 
 * This is the feature that spreads like fire — one click to
 * annihilate any competitor's entire digital presence.
 */

interface OrchestratorStep {
  phase: string;
  agent: string;
  model: string;
  status: "pending" | "running" | "complete" | "failed";
  result?: string;
  duration_ms?: number;
}

export async function POST(request: Request) {
  try {
    const { target, chain_type = "full-audit", custom_instructions } = await request.json();

    if (!target) {
      return NextResponse.json({ error: "target URL or task description required." }, { status: 400 });
    }

    const globalStart = Date.now();
    const steps: OrchestratorStep[] = [];

    // ═══════════════════════════════════════════
    // PHASE 1: RECONNAISSANCE
    // ═══════════════════════════════════════════
    const reconStart = Date.now();
    let reconIntel = "";
    try {
      reconIntel = await research_ai(
        `${target} website analysis business model marketing`,
        `Deep recon on target: ${target}. Analyze their entire business: pricing model, tech stack, marketing approach, team size indicators, funding status, customer reviews, social media presence, traffic estimates, and competitive positioning. Be exhaustive.${custom_instructions ? `\n\nAdditional focus: ${custom_instructions}` : ""}`
      );
    } catch {
      reconIntel = `Target: ${target}. Unable to perform live recon — proceeding with domain analysis.`;
    }
    steps.push({
      phase: "RECON",
      agent: "NemoClaw Scout",
      model: "tavily + nemotron-ultra",
      status: "complete",
      result: reconIntel.substring(0, 500),
      duration_ms: Date.now() - reconStart,
    });

    // ═══════════════════════════════════════════
    // PHASE 2: MULTI-VECTOR AUDIT
    // ═══════════════════════════════════════════
    const auditStart = Date.now();
    const audit = await nimChat(
      "nvidia/llama-3.1-nemotron-ultra-253b",
      [
        { role: "system", content: "You are an elite business intelligence analyst. Produce structured JSON audits with scoring." },
        { role: "user", content: `Based on this recon data, produce a comprehensive multi-vector audit of ${target}.

RECON DATA:
${reconIntel}

Score each dimension 0-100 and provide specific findings. Output JSON:
{
  "target": "${target}",
  "ux_score": 0,
  "seo_score": 0,
  "tech_score": 0,
  "marketing_score": 0,
  "overall_threat_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "vulnerabilities": [{"vector": "name", "severity": "CRITICAL|HIGH|MEDIUM", "detail": "specific exploit"}],
  "strengths": ["what they do well"],
  "market_position": "brief assessment"
}` },
      ],
      { maxTokens: 2000, temperature: 0.3 }
    );

    let auditParsed;
    try {
      auditParsed = JSON.parse(audit.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      auditParsed = { raw: audit };
    }
    steps.push({
      phase: "AUDIT",
      agent: "NemoClaw Analyst",
      model: "nemotron-ultra-253b",
      status: "complete",
      result: JSON.stringify(auditParsed).substring(0, 500),
      duration_ms: Date.now() - auditStart,
    });

    // ═══════════════════════════════════════════
    // PHASE 3: COUNTER-STRATEGY
    // ═══════════════════════════════════════════
    const stratStart = Date.now();
    const strategy = await nimChat(
      "deepseek-ai/deepseek-v3.2",
      [
        { role: "system", content: "You are a ruthless growth strategist. Create battle plans that exploit every competitor weakness." },
        { role: "user", content: `Create a counter-strike strategy based on this audit.

AUDIT RESULTS:
${JSON.stringify(auditParsed)}

Generate a battle plan with:
1. 3 immediate counter-strike actions (this week)
2. 3 medium-term dominance plays (this month)
3. 1 nuclear option that would destroy their market position
4. Recommended content angles to steal their audience
5. Ad copy that directly exploits their weaknesses

Be specific, actionable, and ruthless.` },
      ],
      { maxTokens: 2000, temperature: 0.5 }
    );
    steps.push({
      phase: "STRATEGY",
      agent: "NemoClaw Strategist",
      model: "deepseek-v3.2",
      status: "complete",
      result: strategy.substring(0, 500),
      duration_ms: Date.now() - stratStart,
    });

    // ═══════════════════════════════════════════
    // PHASE 4: ASSET GENERATION
    // ═══════════════════════════════════════════
    let generatedAsset = null;
    if (chain_type === "full-audit" || chain_type === "generate") {
      const buildStart = Date.now();
      const asset = await nimChat(
        "nvidia/devstral-2-123b-instruct-2512",
        [
          { role: "system", content: "You are a world-class web developer. Generate production-ready HTML/CSS that is visually superior to the competitor. Use modern design: dark theme, glassmorphism, smooth animations, premium typography." },
          { role: "user", content: `Generate a SUPERIOR landing page that exploits every weakness found in the competitor.

TARGET: ${target}
VULNERABILITIES: ${JSON.stringify(auditParsed?.vulnerabilities || [])}
STRATEGY: ${strategy.substring(0, 1000)}

Requirements:
- Dark premium aesthetic with gradual reveals
- Mobile-first responsive
- Better CTA placement than competitor
- Social proof section
- Speed comparison section
- Clear pricing CTA
- Animations using CSS only (no JS framework)
Return ONLY complete valid HTML with inline CSS.` },
        ],
        { maxTokens: 4000, temperature: 0.4 }
      );
      generatedAsset = asset;
      steps.push({
        phase: "BUILD",
        agent: "NemoClaw Builder",
        model: "devstral-2-123b",
        status: "complete",
        result: `Generated ${asset.length} chars of production HTML`,
        duration_ms: Date.now() - buildStart,
      });
    }

    // ═══════════════════════════════════════════
    // PHASE 5: EXECUTIVE BRIEF
    // ═══════════════════════════════════════════
    const briefStart = Date.now();
    const brief = await nimChat(
      "mistralai/mistral-nemotron",
      [
        { role: "system", content: "You are an executive presenting battle intelligence to a C-suite. Be concise, data-driven, and decisive." },
        { role: "user", content: `Synthesize this into a 1-page executive brief:

TARGET: ${target}
AUDIT: ${JSON.stringify(auditParsed)}
STRATEGY: ${strategy.substring(0, 1500)}

Format as a clean brief with: Executive Summary, Threat Assessment, Recommended Actions, Expected ROI.` },
      ],
      { maxTokens: 1500, temperature: 0.3 }
    );
    steps.push({
      phase: "BRIEF",
      agent: "NemoClaw Commander",
      model: "mistral-nemotron",
      status: "complete",
      result: brief.substring(0, 500),
      duration_ms: Date.now() - briefStart,
    });

    return NextResponse.json({
      success: true,
      agent: "nemoclaw-orchestrator",
      chain_type,
      target,
      total_duration_ms: Date.now() - globalStart,
      phases_completed: steps.length,
      pipeline: steps,
      deliverables: {
        recon_intel: reconIntel,
        audit: auditParsed,
        strategy,
        executive_brief: brief,
        ...(generatedAsset ? { generated_page_html: generatedAsset } : {}),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Orchestrator chain failed", details: String(error) },
      { status: 500 }
    );
  }
}
