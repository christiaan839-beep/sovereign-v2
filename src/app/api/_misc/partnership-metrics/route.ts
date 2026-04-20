import { NextResponse } from "next/server";
import { db } from "@/db";
import { usage } from "@/db/schema";
import { count, gte, like, and, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("partnership-metrics");

/**
 * GET /api/_misc/partnership-metrics
 *
 * Public, aggregate-only metrics showing how Sovereign Matrix uses
 * Claude. Zero PII, zero customer-identifiable data — just the
 * platform-wide usage shape.
 *
 * Designed for:
 *   - Anthropic's partner-program team to verify our usage claims
 *   - Our own /built-with-claude page (rendered as live numbers)
 *   - Prospective customers evaluating "is this really built on Claude?"
 *
 * The response never identifies a customer or their workload. Anyone
 * can hit this URL and read it. We redact anything that approaches
 * fingerprinting.
 *
 * Cache: 1 hour edge cache via Vercel.
 */

export const revalidate = 3600; // Vercel edge cache for 1 hour

export async function GET() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [totalRuns30d, totalRuns7d, claudeRuns30d, byProvider] = await Promise.all([
      db
        .select({ value: count() })
        .from(usage)
        .where(gte(usage.createdAt, since30d)),

      db
        .select({ value: count() })
        .from(usage)
        .where(gte(usage.createdAt, since7d)),

      db
        .select({ value: count() })
        .from(usage)
        .where(and(
          gte(usage.createdAt, since30d),
          like(usage.model, "%claude%"),
        )),

      db
        .select({
          // Bucket the model string by its provider prefix — claude/gpt/
          // gemini/nemotron/llama/mistral/deepseek/qwen/other. Keeps the
          // response stable even as specific model names change.
          bucket: sql<string>`
            CASE
              WHEN ${usage.model} ILIKE '%claude%' THEN 'claude'
              WHEN ${usage.model} ILIKE '%nemotron%' THEN 'nvidia-nim'
              WHEN ${usage.model} ILIKE '%gemini%' OR ${usage.model} ILIKE '%gemma%' THEN 'google'
              WHEN ${usage.model} ILIKE '%gpt%' OR ${usage.model} ILIKE '%openai%' THEN 'openai'
              WHEN ${usage.model} ILIKE '%llama%' THEN 'llama'
              WHEN ${usage.model} ILIKE '%mistral%' THEN 'mistral'
              WHEN ${usage.model} ILIKE '%deepseek%' THEN 'deepseek'
              WHEN ${usage.model} ILIKE '%qwen%' THEN 'qwen'
              WHEN ${usage.model} ILIKE '%groq%' THEN 'groq'
              WHEN ${usage.model} ILIKE '%cerebras%' THEN 'cerebras'
              ELSE 'other'
            END
          `.as("bucket"),
          runs: count(),
        })
        .from(usage)
        .where(gte(usage.createdAt, since30d))
        .groupBy(sql`bucket`),
    ]);

    const total30d = Number(totalRuns30d[0]?.value ?? 0);
    const claude30d = Number(claudeRuns30d[0]?.value ?? 0);

    const providerBreakdown = byProvider
      .map((r) => ({
        provider: r.bucket,
        runs: Number(r.runs),
        percent: total30d > 0 ? Math.round((Number(r.runs) / total30d) * 100) : 0,
      }))
      .sort((a, b) => b.runs - a.runs);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      window: "last 30 days",

      platform: {
        description:
          "Sovereign Matrix orchestrates multi-agent AI workflows. Claude is the quality-verification critic in every agent run; cheaper models are used for generation, with Claude acting as the final gate.",
        openSource: {
          spec: "https://sovereignmatrix.agency/api/agents",
          docs: "https://sovereignmatrix.agency/built-with-claude",
          partnershipDoc: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/ANTHROPIC_PARTNERSHIP_PLAYBOOK.md",
        },
      },

      usage: {
        totalAgentRuns30d: total30d,
        totalAgentRuns7d: Number(totalRuns7d[0]?.value ?? 0),
        claudeInvocations30d: claude30d,
        claudePercentOfAllRuns:
          total30d > 0 ? Math.round((claude30d / total30d) * 100) : 0,
        providerMix: providerBreakdown,
      },

      integrationPoints: [
        { role: "consensus-critic", model: "claude-sonnet-4.5", description: "Final quality gate on every agent output" },
        { role: "extended-thinking", model: "claude-sonnet-4.5-thinking", description: "Multi-step reasoning for /api/agents/claude-think" },
        { role: "agentic-tool-use", model: "claude-sonnet-4.5", description: "Computer-use agent (when enabled)" },
        { role: "code-review", model: "claude-sonnet-4.5", description: "Code-review agent + PR bot" },
      ],

      commitment: {
        noTrainingOnCustomerData: true,
        robotsTxtAllowsClaudeBot: true,
        mcpServerPublished: "https://github.com/christiaan839-beep/sovereign-v2/tree/main/mcp-server",
        agentMdSpecPublic: "https://sovereignmatrix.agency/api/agents/<slug>.agent.md",
      },
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // usage table missing — return zeroes rather than 500
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        window: "last 30 days",
        usage: {
          totalAgentRuns30d: 0,
          totalAgentRuns7d: 0,
          claudeInvocations30d: 0,
          claudePercentOfAllRuns: 0,
          providerMix: [],
        },
        note: "Platform is pre-launch; metrics available after first runs.",
      });
    }
    log.error("partnership metrics query failed", { error: String(err) });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
