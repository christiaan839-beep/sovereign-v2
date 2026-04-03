import { NextResponse } from "next/server";

/**
 * AGENT MARKETPLACE — Lets clients create, share, and deploy custom agent templates.
 * Each template is a pre-configured NemoClaw agent with custom guardrails,
 * system prompt, and NIM model selection.
 */

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  model: string;
  system_prompt: string;
  guardrails: string[];
  category: string;
  uses: number;
  rating: number;
  created_at: string;
}

// In-memory marketplace (production: use database)
const MARKETPLACE: Map<string, AgentTemplate> = new Map();

// Pre-built templates
const PREBUILT: AgentTemplate[] = [
  {
    id: "sales-closer",
    name: "Sales Closer Bot",
    description: "Handles inbound leads, qualifies them, and pushes toward booking a call.",
    author: "Sovereign Matrix",
    model: "mistralai/mistral-nemotron",
    system_prompt: "You are an elite sales representative for the company. Qualify leads by asking about their budget, timeline, and pain points. Always push toward booking a 15-minute strategy call.",
    guardrails: ["no-financial-advice", "topic-lock", "no-competitor-mention"],
    category: "Sales",
    uses: 247,
    rating: 4.8,
    created_at: "2026-03-01T00:00:00Z",
  },
  {
    id: "seo-writer",
    name: "SEO Content Machine",
    description: "Writes long-form SEO blog posts optimized for search rankings.",
    author: "Sovereign Matrix",
    model: "deepseek-ai/deepseek-v3.2",
    system_prompt: "You are an expert SEO content writer. Write comprehensive, well-structured blog posts with proper heading hierarchy, keyword placement, internal linking suggestions, and compelling meta descriptions.",
    guardrails: ["no-pii-leakage", "audit-trail-required"],
    category: "Content",
    uses: 189,
    rating: 4.9,
    created_at: "2026-03-05T00:00:00Z",
  },
  {
    id: "compliance-auditor",
    name: "POPIA Compliance Auditor",
    description: "Audits documents and processes for POPIA/GDPR compliance violations.",
    author: "Sovereign Matrix",
    model: "nvidia/nemotron-content-safety-reasoning-4b",
    system_prompt: "You are a data protection compliance auditor specializing in POPIA and GDPR. Analyze documents, processes, and data flows for compliance violations. Provide specific recommendations and risk scores.",
    guardrails: ["no-pii-leakage", "audit-trail-required", "data-retention-policy"],
    category: "Compliance",
    uses: 92,
    rating: 4.7,
    created_at: "2026-03-10T00:00:00Z",
  },
  {
    id: "customer-support",
    name: "24/7 Support Agent",
    description: "Handles customer support inquiries with empathy and accuracy.",
    author: "Sovereign Matrix",
    model: "thudm/glm-4-9b-chat",
    system_prompt: "You are a friendly customer support agent. Help users resolve issues, answer questions about the product, and escalate complex issues to a human agent. Always be empathetic and solution-oriented.",
    guardrails: ["no-financial-advice", "no-medical-advice", "topic-lock", "no-prompt-injection"],
    category: "Support",
    uses: 431,
    rating: 4.6,
    created_at: "2026-03-15T00:00:00Z",
  },
  {
    id: "code-reviewer",
    name: "AI Code Reviewer",
    description: "Reviews pull requests and suggests improvements, security fixes, and optimizations.",
    author: "Sovereign Matrix",
    model: "mistralai/devstral-2-123b-instruct-2512",
    system_prompt: "You are a senior software engineer conducting code reviews. Focus on: security vulnerabilities, performance issues, code style, error handling, and architectural improvements. Be specific and provide code examples.",
    guardrails: ["audit-trail-required"],
    category: "Engineering",
    uses: 156,
    rating: 4.9,
    created_at: "2026-03-18T00:00:00Z",
  },
];

// Initialize with pre-built templates
PREBUILT.forEach(t => MARKETPLACE.set(t.id, t));

export async function GET() {
  const templates = Array.from(MARKETPLACE.values());
  const categories = [...new Set(templates.map(t => t.category))];

  return NextResponse.json({
    status: "Agent Marketplace — Active",
    total_templates: templates.length,
    categories,
    templates: templates.sort((a, b) => b.uses - a.uses),
  });
}

export async function POST(request: Request) {
  try {
    const { action, template } = await request.json();

    if (action === "create") {
      if (!template?.name || !template?.system_prompt) {
        return NextResponse.json({ error: "name and system_prompt are required." }, { status: 400 });
      }

      const id = `custom-${Date.now()}`;
      const newTemplate: AgentTemplate = {
        id,
        name: template.name,
        description: template.description || "",
        author: template.author || "Community",
        model: template.model || "mistralai/mistral-nemotron",
        system_prompt: template.system_prompt,
        guardrails: template.guardrails || ["no-prompt-injection"],
        category: template.category || "Custom",
        uses: 0,
        rating: 0,
        created_at: new Date().toISOString(),
      };

      MARKETPLACE.set(id, newTemplate);

      return NextResponse.json({
        success: true,
        action: "create",
        template: newTemplate,
      });
    }

    if (action === "deploy") {
      const existing = MARKETPLACE.get(template?.id || "");
      if (!existing) {
        return NextResponse.json({ error: "Template not found." }, { status: 404 });
      }

      existing.uses += 1;

      // Deploy as a NemoClaw agent
      return NextResponse.json({
        success: true,
        action: "deploy",
        deployed_from: existing.name,
        nemoclaw_config: {
          name: existing.name,
          model: existing.model,
          system_prompt: existing.system_prompt,
          guardrails: existing.guardrails,
        },
        message: `Template "${existing.name}" deployed as NemoClaw agent. Total deployments: ${existing.uses}`,
      });
    }

    return NextResponse.json({ error: "action must be 'create' or 'deploy'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Marketplace error", details: String(error) }, { status: 500 });
  }
}
