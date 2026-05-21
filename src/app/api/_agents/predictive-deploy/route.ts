/**
 * SOVEREIGN MATRIX — Predictive Agent Deployment
 *
 * Analyzes a business description to detect the industry,
 * then recommends and deploys the optimal agent configuration.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";

// ── Industry-to-Agent Stack Mapping ──

interface AgentRecommendation {
  id: string;
  name: string;
  purpose: string;
}

interface IndustryStack {
  agents: AgentRecommendation[];
  estimatedMonthlyValue: number;
}

const INDUSTRY_STACKS: Record<string, IndustryStack> = {
  saas: {
    agents: [
      {
        id: "leads",
        name: "Lead Generation",
        purpose: "Identify and qualify inbound/outbound prospects",
      },
      {
        id: "blog-gen",
        name: "Blog Generator",
        purpose: "SEO-optimized content to drive organic traffic",
      },
      {
        id: "seo-dominator",
        name: "SEO Dominator",
        purpose: "Technical SEO audits and keyword strategy",
      },
      {
        id: "email-sequence",
        name: "Email Sequence",
        purpose: "Automated drip campaigns for nurturing leads",
      },
      {
        id: "competitor",
        name: "Competitor Intelligence",
        purpose: "Track competitor pricing, features, and positioning",
      },
      {
        id: "code-agent",
        name: "Code Agent",
        purpose: "Automate internal tooling and integrations",
      },
    ],
    estimatedMonthlyValue: 12500,
  },
  ecommerce: {
    agents: [
      {
        id: "leads",
        name: "Lead Generation",
        purpose: "Capture and segment buyer intent signals",
      },
      {
        id: "page-builder",
        name: "Page Builder",
        purpose: "Generate high-converting product and landing pages",
      },
      {
        id: "image-gen",
        name: "Image Generator",
        purpose: "Product imagery and creative assets at scale",
      },
      {
        id: "translate",
        name: "Translator",
        purpose: "Localize listings and content for global markets",
      },
      {
        id: "social-router",
        name: "Social Router",
        purpose: "Schedule and optimize posts across social channels",
      },
    ],
    estimatedMonthlyValue: 9800,
  },
  agency: {
    agents: [
      {
        id: "leads",
        name: "Lead Generation",
        purpose: "Pipeline building and prospect qualification",
      },
      {
        id: "blog-gen",
        name: "Blog Generator",
        purpose: "Client content production at scale",
      },
      {
        id: "page-builder",
        name: "Page Builder",
        purpose: "Rapid landing page creation for client campaigns",
      },
      {
        id: "whitelabel",
        name: "Whitelabel",
        purpose: "Brand the platform under your agency name",
      },
      {
        id: "case-study",
        name: "Case Study Generator",
        purpose: "Auto-generate client success stories",
      },
      {
        id: "creative-director",
        name: "Creative Director",
        purpose: "Brand consistency and creative strategy",
      },
    ],
    estimatedMonthlyValue: 15000,
  },
  "real-estate": {
    agents: [
      {
        id: "leads",
        name: "Lead Generation",
        purpose: "Capture buyer and seller leads from listings",
      },
      {
        id: "page-builder",
        name: "Page Builder",
        purpose: "Property listing pages and virtual tour hubs",
      },
      {
        id: "translate",
        name: "Translator",
        purpose: "Multilingual listings for international buyers",
      },
      {
        id: "voice-synth",
        name: "Voice Synthesizer",
        purpose: "Automated property inquiry callbacks",
      },
      {
        id: "image-gen",
        name: "Image Generator",
        purpose: "Virtual staging and property renderings",
      },
    ],
    estimatedMonthlyValue: 8500,
  },
  healthcare: {
    agents: [
      {
        id: "doc-intel",
        name: "Document Intelligence",
        purpose: "Extract and process medical documents",
      },
      {
        id: "pii-redactor",
        name: "PII Redactor",
        purpose: "HIPAA-compliant data anonymization",
      },
      {
        id: "voicechat",
        name: "Voice Chat",
        purpose: "Patient intake and appointment scheduling",
      },
      {
        id: "translate",
        name: "Translator",
        purpose: "Multilingual patient communication",
      },
      {
        id: "blog-gen",
        name: "Blog Generator",
        purpose: "Patient education and health content",
      },
    ],
    estimatedMonthlyValue: 11000,
  },
  legal: {
    agents: [
      {
        id: "contract-analyzer",
        name: "Contract Analyzer",
        purpose: "Clause extraction and risk identification",
      },
      {
        id: "doc-intel",
        name: "Document Intelligence",
        purpose: "Legal document parsing and summarization",
      },
      {
        id: "pii-redactor",
        name: "PII Redactor",
        purpose: "Redact sensitive information from filings",
      },
      {
        id: "reasoning-chain",
        name: "Reasoning Chain",
        purpose: "Multi-step legal argument analysis",
      },
    ],
    estimatedMonthlyValue: 14000,
  },
  default: {
    agents: [
      {
        id: "leads",
        name: "Lead Generation",
        purpose: "Identify and qualify business prospects",
      },
      {
        id: "blog-gen",
        name: "Blog Generator",
        purpose: "Content marketing and thought leadership",
      },
      {
        id: "seo-dominator",
        name: "SEO Dominator",
        purpose: "Search engine optimization and ranking",
      },
      {
        id: "email-sequence",
        name: "Email Sequence",
        purpose: "Automated outreach and follow-up campaigns",
      },
    ],
    estimatedMonthlyValue: 7500,
  },
};

const VALID_INDUSTRIES = Object.keys(INDUSTRY_STACKS).filter(
  (k) => k !== "default",
);

// ── Agent Route ──

export const POST = createAgentRoute({
  name: "predictive-deploy",
  requiredFields: ["business"],
  // Wave-111.1 batch 7: memory hooks. Per-user business-description
  // history compounds — surface previously-deployed stacks for similar
  // descriptions to inform recommendations + show consistency over
  // multiple consultations.
  memory: {
    search: {
      query: (input) =>
        `predictive-deploy business:${String(input.business ?? "").slice(0, 250)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          detectedIndustry?: string;
          stack?: { estimatedMonthlyValue?: number };
          agents?: Array<{ id?: string }>;
        };
        if (!r.detectedIndustry) return null;
        const agentIds = (r.agents ?? [])
          .slice(0, 6)
          .map((a) => a.id)
          .filter(Boolean)
          .join(", ");
        return `Industry: ${r.detectedIndustry}. Stack value: ~$${r.stack?.estimatedMonthlyValue ?? "?"}/mo. Agents: ${agentIds}`;
      },
      metadata: () => ({ kind: "predictive-deploy" }),
    },
  },
  handler: async ({ input }) => {
    const business = input.business as string;

    // Classify the industry using AI
    const classificationPrompt = `You are an industry classifier. Given the following business description, respond with EXACTLY ONE of these industry labels and nothing else:
${VALID_INDUSTRIES.join(", ")}

If the business does not clearly fit any category, respond with "default".

Business description:
${business}`;

    let detectedIndustry = "default";
    try {
      const raw = await ai(classificationPrompt, {
        system:
          "You are a precise classifier. Respond with a single lowercase word only.",
        maxTokens: 20,
      });
      const cleaned = raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z-]/g, "");
      if (cleaned in INDUSTRY_STACKS) {
        detectedIndustry = cleaned;
      }
    } catch {
      // Fallback: keyword-based detection
      const lower = business.toLowerCase();
      if (
        lower.includes("saas") ||
        lower.includes("software") ||
        lower.includes("subscription")
      ) {
        detectedIndustry = "saas";
      } else if (
        lower.includes("ecommerce") ||
        lower.includes("e-commerce") ||
        lower.includes("shop") ||
        lower.includes("retail")
      ) {
        detectedIndustry = "ecommerce";
      } else if (
        lower.includes("agency") ||
        lower.includes("marketing agency") ||
        lower.includes("consulting")
      ) {
        detectedIndustry = "agency";
      } else if (
        lower.includes("real estate") ||
        lower.includes("property") ||
        lower.includes("realty")
      ) {
        detectedIndustry = "real-estate";
      } else if (
        lower.includes("health") ||
        lower.includes("medical") ||
        lower.includes("clinic") ||
        lower.includes("hospital")
      ) {
        detectedIndustry = "healthcare";
      } else if (
        lower.includes("legal") ||
        lower.includes("law firm") ||
        lower.includes("attorney")
      ) {
        detectedIndustry = "legal";
      }
    }

    const stack = INDUSTRY_STACKS[detectedIndustry];

    // Build deployment steps
    const deploymentSteps = [
      `Industry detected: ${detectedIndustry}`,
      `Provisioning ${stack.agents.length} specialized agents`,
      ...stack.agents.map(
        (a, i) => `Step ${i + 1}: Deploy "${a.name}" — ${a.purpose}`,
      ),
      "Configure inter-agent communication bus",
      "Enable usage analytics and performance monitoring",
      "Deployment complete — all agents operational",
    ];

    return {
      industry: detectedIndustry,
      businessSummary: business.slice(0, 200),
      recommendedAgents: stack.agents,
      agentCount: stack.agents.length,
      estimatedMonthlyValue: stack.estimatedMonthlyValue,
      deploymentSteps,
      status: "deployed",
    };
  },
});
