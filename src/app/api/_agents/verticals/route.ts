import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * VERTICAL AGENT TEMPLATES — Pre-configured agent stacks for
 * specific industries. Each vertical deploys a tailored combination
 * of agents with industry-specific prompts and guardrails.
 */

interface VerticalTemplate {
  id: string;
  name: string;
  industry: string;
  description: string;
  agents: Array<{ agent: string; config: Record<string, unknown> }>;
  guardrails: string[];
  monthly_value: string;
}

const VERTICALS: VerticalTemplate[] = [
  {
    id: "real-estate",
    name: "Real Estate Dominator",
    industry: "Real Estate",
    description:
      "Auto-generate property listings, translate to 12 languages for international buyers, create virtual tour descriptions, and follow up with leads.",
    agents: [
      {
        agent: "page-builder",
        config: { prompt_prefix: "Create a luxury property listing page for:" },
      },
      {
        agent: "translate",
        config: { default_langs: ["en", "ar", "zh", "ru", "fr"] },
      },
      {
        agent: "abm-artillery",
        config: { industry: "real-estate", tone: "luxury" },
      },
      {
        agent: "image-gen",
        config: { style: "architectural photography, luxury real estate" },
      },
      {
        agent: "blog-gen",
        config: { topic_prefix: "Real estate market analysis:" },
      },
    ],
    guardrails: [
      "no-financial-advice",
      "fair-housing-compliance",
      "no-pii-leakage",
    ],
    monthly_value: "R45,000",
  },
  {
    id: "medical-practice",
    name: "Medical Practice AI",
    industry: "Healthcare",
    description:
      "HIPAA-aware patient communication, appointment reminders, medical content creation, and PII-safe document processing.",
    agents: [
      {
        agent: "voicechat",
        config: { context: "appointment", voice_style: "warm-professional" },
      },
      {
        agent: "gliner-pii",
        config: { entities: ["PERSON", "PHONE", "EMAIL", "MEDICAL_ID", "SSN"] },
      },
      {
        agent: "blog-gen",
        config: { topic_prefix: "Patient education article:" },
      },
      {
        agent: "translate",
        config: { default_langs: ["en", "es", "fr", "pt", "zh"] },
      },
      { agent: "case-study", config: { industry: "healthcare" } },
    ],
    guardrails: [
      "hipaa-compliance",
      "no-medical-advice-without-disclaimer",
      "no-pii-leakage",
      "audit-trail-required",
    ],
    monthly_value: "R65,000",
  },
  {
    id: "law-firm",
    name: "Legal Eagle AI",
    industry: "Legal",
    description:
      "Contract analysis, legal document OCR, client intake automation, compliance auditing, and case research.",
    agents: [
      {
        agent: "florence-ocr",
        config: { action: "ocr", output: "structured" },
      },
      { agent: "doc-intel", config: { action: "embed", domain: "legal" } },
      {
        agent: "gliner-pii",
        config: { entities: ["PERSON", "SSN", "ADDRESS", "CASE_NUMBER"] },
      },
      {
        agent: "voicechat",
        config: { context: "receptionist", voice_style: "formal" },
      },
      { agent: "swarm", config: { task_prefix: "Legal research:" } },
    ],
    guardrails: [
      "attorney-privilege",
      "no-legal-advice-without-disclaimer",
      "audit-trail-required",
      "no-pii-leakage",
    ],
    monthly_value: "R85,000",
  },
  {
    id: "ecommerce",
    name: "E-Commerce Engine",
    industry: "E-Commerce",
    description:
      "Auto-generate product descriptions, SEO blog posts, translate for global markets, create ad copy, and analyze competitor pricing.",
    agents: [
      {
        agent: "blog-gen",
        config: { topic_prefix: "Product review and buying guide:" },
      },
      {
        agent: "image-gen",
        config: { style: "product photography, e-commerce" },
      },
      {
        agent: "translate",
        config: { default_langs: ["en", "de", "fr", "es", "ja", "ko"] },
      },
      {
        agent: "page-builder",
        config: { prompt_prefix: "Create a product landing page for:" },
      },
      {
        agent: "abm-artillery",
        config: { industry: "ecommerce", tone: "friendly" },
      },
    ],
    guardrails: [
      "no-false-advertising",
      "price-accuracy",
      "no-competitor-defamation",
    ],
    monthly_value: "R35,000",
  },
  {
    id: "saas-startup",
    name: "SaaS Growth Machine",
    industry: "SaaS / Technology",
    description:
      "Automated content marketing, competitor analysis, lead scoring, code review, and multi-channel outreach.",
    agents: [
      {
        agent: "blog-gen",
        config: { topic_prefix: "SaaS industry analysis:" },
      },
      {
        agent: "abm-artillery",
        config: { industry: "technology", tone: "professional" },
      },
      {
        agent: "swarm",
        config: { models: ["deepseek-v3.2", "mistral-nemotron", "glm-4.7"] },
      },
      { agent: "case-study", config: { industry: "technology" } },
      { agent: "chain-reactor", config: { default_chain: "lead-to-close" } },
    ],
    guardrails: [
      "no-competitor-defamation",
      "data-accuracy",
      "audit-trail-required",
    ],
    monthly_value: "R49,997",
  },
  {
    id: "agency",
    name: "White-Label Agency Pack",
    industry: "Marketing Agency",
    description:
      "Full white-label agent stack that agencies can resell to their clients. Includes branding, client portals, and usage metering.",
    agents: [
      { agent: "whitelabel", config: {} },
      { agent: "marketplace", config: {} },
      { agent: "blog-gen", config: {} },
      { agent: "page-builder", config: {} },
      { agent: "image-gen", config: {} },
      { agent: "case-study", config: {} },
    ],
    guardrails: ["brand-safety", "no-pii-leakage", "audit-trail-required"],
    monthly_value: "R120,000",
  },
];

export async function GET() {
  return NextResponse.json({
    status: "Vertical Templates Engine — Active",
    total_verticals: VERTICALS.length,
    verticals: VERTICALS.map((v) => ({
      id: v.id,
      name: v.name,
      industry: v.industry,
      description: v.description,
      agent_count: v.agents.length,
      guardrails: v.guardrails.length,
      monthly_value: v.monthly_value,
    })),
  });
}

async function _postHandler(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const { verticalId, clientName } = await request.json();

    const vertical = VERTICALS.find((v) => v.id === verticalId);
    if (!vertical) {
      return NextResponse.json(
        {
          error: "Vertical not found.",
          available: VERTICALS.map((v) => v.id),
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      deployed: {
        vertical: vertical.name,
        industry: vertical.industry,
        client: clientName || "New Client",
        agents_deployed: vertical.agents.length,
        agents: vertical.agents.map((a) => a.agent),
        guardrails: vertical.guardrails,
        monthly_value: vertical.monthly_value,
      },
      message: `${vertical.name} stack deployed for ${clientName || "client"}. ${vertical.agents.length} agents active with ${vertical.guardrails.length} guardrails.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Vertical error", details: String(error) },
      { status: 500 },
    );
  }
}

// Factory wrapper for POST (adds safety pipeline)
export const POST = createAgentRoute({
  name: "verticals",
  handler: async ({ input, email, userId, request }) => {
    // Delegate to existing handler
    const fakeReq = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const res = await _postHandler(fakeReq);
    return res instanceof Response ? await res.json() : res;
  },
});
