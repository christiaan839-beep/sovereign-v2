/**
 * Workflow Templates — Pre-built pipelines for the template marketplace
 *
 * Each template defines a sequence of agent nodes that can be loaded
 * into the workflow builder with a single click.
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "sales" | "content" | "seo" | "automation" | "research";
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime: string;
  nodes: Array<{
    agentId: string;
    name: string;
    color: string;
    executionMode: "sequential" | "parallel" | "conditional";
    condition?: string;
    config: Record<string, string>;
  }>;
  installs: number;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ── 1. Lead Generation Pipeline ──────────────────────────────
  {
    id: "lead-gen-pipeline",
    name: "Lead Generation Pipeline",
    description:
      "Find leads → enrich with emails → write personalized outreach → send to Slack",
    category: "sales",
    difficulty: "beginner",
    estimatedTime: "2 minutes",
    nodes: [
      {
        agentId: "leads",
        name: "Lead Gen",
        color: "emerald",
        executionMode: "sequential",
        config: {
          prompt:
            "Find 50 B2B SaaS companies with Series A funding in the US. Include company name, website, industry, and estimated employee count.",
        },
      },
      {
        agentId: "email-sequence",
        name: "Email Sequence",
        color: "blue",
        executionMode: "sequential",
        config: {
          prompt:
            "Write a 3-step cold outreach sequence for these leads. Step 1: intro with a value hook. Step 2: case study reference. Step 3: breakup email with urgency.",
        },
      },
      {
        agentId: "integration-slack",
        name: "Send to Slack",
        color: "purple",
        executionMode: "sequential",
        config: {
          text: "New leads pipeline complete — outreach sequences ready for review",
        },
      },
    ],
    installs: 847,
  },

  // ── 2. Content Machine ───────────────────────────────────────
  {
    id: "content-machine",
    name: "Content Machine",
    description:
      "Generate blog post + social snippets + SEO optimization — all in parallel",
    category: "content",
    difficulty: "intermediate",
    estimatedTime: "3 minutes",
    nodes: [
      {
        agentId: "god-brain",
        name: "Topic Strategist",
        color: "purple",
        executionMode: "sequential",
        config: {
          prompt:
            "Analyze top-performing content in the AI automation niche and suggest a high-impact blog topic with title, target keywords, and an outline.",
        },
      },
      {
        agentId: "content",
        name: "Blog Writer",
        color: "cyan",
        executionMode: "parallel",
        config: {
          prompt:
            "Write a 1,500-word SEO-optimized blog post from the outline. Use conversational tone, include H2/H3 headers, and add a CTA at the end.",
        },
      },
      {
        agentId: "content",
        name: "Social Snippets",
        color: "cyan",
        executionMode: "parallel",
        config: {
          prompt:
            "Create 5 social media posts from this blog: 2 LinkedIn posts, 2 Twitter/X posts, and 1 Instagram caption. Each with relevant hashtags.",
        },
      },
      {
        agentId: "seo",
        name: "SEO Optimizer",
        color: "violet",
        executionMode: "parallel",
        config: {
          prompt:
            "Optimize the blog post for on-page SEO: meta title, meta description, header tag structure, internal linking suggestions, and keyword density analysis.",
        },
      },
    ],
    installs: 1243,
  },

  // ── 3. Competitor Monitor ────────────────────────────────────
  {
    id: "competitor-monitor",
    name: "Competitor Monitor",
    description:
      "Scan competitor websites → analyze positioning → generate counter-strategy",
    category: "research",
    difficulty: "intermediate",
    estimatedTime: "4 minutes",
    nodes: [
      {
        agentId: "competitor",
        name: "Competitor Scanner",
        color: "orange",
        executionMode: "sequential",
        config: {
          prompt:
            "Deep scan the top 3 competitors in our space. Analyze their pricing pages, feature lists, recent blog posts, and any new product launches in the last 30 days.",
        },
      },
      {
        agentId: "god-brain",
        name: "Strategic Analyzer",
        color: "purple",
        executionMode: "sequential",
        config: {
          prompt:
            "Based on the competitor intelligence, identify: 1) Feature gaps we can exploit, 2) Pricing advantages, 3) Messaging weaknesses, 4) Their likely next moves.",
        },
      },
      {
        agentId: "content",
        name: "Counter-Strategy Brief",
        color: "cyan",
        executionMode: "sequential",
        config: {
          prompt:
            "Write a concise 1-page counter-strategy brief with specific action items for product, marketing, and sales teams. Format with clear sections and bullet points.",
        },
      },
    ],
    installs: 634,
  },

  // ── 4. SEO Dominator ─────────────────────────────────────────
  {
    id: "seo-dominator",
    name: "SEO Dominator",
    description:
      "Audit site → find keywords → generate optimized content",
    category: "seo",
    difficulty: "beginner",
    estimatedTime: "3 minutes",
    nodes: [
      {
        agentId: "seo",
        name: "Site Auditor",
        color: "violet",
        executionMode: "sequential",
        config: {
          prompt:
            "Run a comprehensive SEO audit on the site. Check page speed, mobile responsiveness, meta tags, broken links, sitemap status, and Core Web Vitals scores.",
        },
      },
      {
        agentId: "seo",
        name: "Keyword Research",
        color: "violet",
        executionMode: "sequential",
        config: {
          prompt:
            "Find 20 high-value keywords: mix of high-volume head terms and low-competition long-tail phrases. Include monthly search volume estimates and difficulty scores.",
        },
      },
      {
        agentId: "content",
        name: "SEO Content Generator",
        color: "cyan",
        executionMode: "sequential",
        config: {
          prompt:
            "Generate 3 SEO-optimized content pieces targeting the top keywords: 1 pillar page outline, 1 listicle blog post, and 1 FAQ page. Include title tags, meta descriptions, and H1-H3 structure.",
        },
      },
    ],
    installs: 921,
  },

  // ── 5. Client Report Generator ───────────────────────────────
  {
    id: "client-report-gen",
    name: "Client Report Generator",
    description:
      "Gather performance stats → write executive report → send via email",
    category: "automation",
    difficulty: "beginner",
    estimatedTime: "2 minutes",
    nodes: [
      {
        agentId: "seo",
        name: "Gather Stats",
        color: "violet",
        executionMode: "sequential",
        config: {
          prompt:
            "Pull this month's key performance metrics: organic traffic, keyword rankings, backlink growth, page speed improvements, and top-performing pages. Compile into a data summary.",
        },
      },
      {
        agentId: "content",
        name: "Report Writer",
        color: "cyan",
        executionMode: "sequential",
        config: {
          prompt:
            "Write a professional monthly client report. Include: Executive Summary, Traffic Analysis, Keyword Rankings, Content Performance, Recommendations, and Next Month's Roadmap. Use tables and bullet points.",
        },
      },
      {
        agentId: "email-sequence",
        name: "Email to Client",
        color: "blue",
        executionMode: "sequential",
        config: {
          prompt:
            "Draft a professional email to send the monthly report. Subject line: 'Your Monthly Performance Report — [Month]'. Include highlights and a call-to-action to schedule a review call.",
        },
      },
    ],
    installs: 756,
  },

  // ── 6. Code Review Pipeline ──────────────────────────────────
  {
    id: "code-review-pipeline",
    name: "Code Review Pipeline",
    description:
      "Generate code → review for quality → safety check with guardrails",
    category: "automation",
    difficulty: "advanced",
    estimatedTime: "3 minutes",
    nodes: [
      {
        agentId: "code-agent",
        name: "Code Generator",
        color: "rose",
        executionMode: "sequential",
        config: {
          prompt:
            "Generate a production-ready TypeScript module based on the requirements. Include proper error handling, types, JSDoc comments, and follow SOLID principles.",
        },
      },
      {
        agentId: "code-agent",
        name: "Code Reviewer",
        color: "rose",
        executionMode: "sequential",
        config: {
          prompt:
            "Review the generated code for: type safety, error handling, performance issues, security vulnerabilities, and adherence to best practices. Suggest specific improvements.",
        },
      },
      {
        agentId: "content-safety",
        name: "Safety Check",
        color: "red",
        executionMode: "sequential",
        config: {
          prompt:
            "Run NeMo Guardrails safety analysis on the generated code. Check for: prompt injection risks, unsafe data handling, exposed secrets, and compliance with secure coding standards.",
        },
      },
    ],
    installs: 412,
  },

  // ── 7. Market Intelligence ───────────────────────────────────
  {
    id: "market-intelligence",
    name: "Market Intelligence",
    description:
      "Research market + competitor scan + strategy brief — all in parallel for speed",
    category: "research",
    difficulty: "advanced",
    estimatedTime: "5 minutes",
    nodes: [
      {
        agentId: "god-brain",
        name: "Market Research",
        color: "purple",
        executionMode: "parallel",
        config: {
          prompt:
            "Conduct deep market research: TAM/SAM/SOM analysis, emerging trends, regulatory landscape, key players, and growth projections for the next 3 years. Focus on the AI SaaS sector.",
        },
      },
      {
        agentId: "competitor",
        name: "Competitor Scan",
        color: "orange",
        executionMode: "parallel",
        config: {
          prompt:
            "Analyze the top 5 competitors: pricing models, feature matrices, recent funding rounds, customer segments, and go-to-market strategies. Identify whitespace opportunities.",
        },
      },
      {
        agentId: "content",
        name: "Strategy Brief Writer",
        color: "cyan",
        executionMode: "parallel",
        config: {
          prompt:
            "Synthesize all intelligence into a strategic market brief. Include: Market Opportunity, Competitive Landscape Map, SWOT Analysis, Strategic Recommendations, and 90-Day Action Plan.",
        },
      },
      {
        agentId: "integration-notion",
        name: "Save to Notion",
        color: "neutral",
        executionMode: "sequential",
        config: {
          text: "Market Intelligence Report — auto-generated",
        },
      },
    ],
    installs: 389,
  },

  // ── 8. Voice Outreach ────────────────────────────────────────
  {
    id: "voice-outreach",
    name: "Voice Outreach",
    description:
      "Qualify leads → if qualified: voice call, else: email sequence",
    category: "sales",
    difficulty: "advanced",
    estimatedTime: "5 minutes",
    nodes: [
      {
        agentId: "leads",
        name: "Lead Qualifier",
        color: "emerald",
        executionMode: "sequential",
        config: {
          prompt:
            "Score and qualify the incoming leads. Rate each lead 1-100 based on: company size, industry fit, recent funding, tech stack match. Mark leads scoring 70+ as 'qualified'.",
        },
      },
      {
        agentId: "voice",
        name: "Voice Caller",
        color: "amber",
        executionMode: "conditional",
        condition: "qualified",
        config: {
          prompt:
            "Place an outbound call to qualified leads. Script: introduce the product, identify pain points, handle objections, and book a demo if interested. Use friendly but professional tone.",
        },
      },
      {
        agentId: "email-sequence",
        name: "Email Nurture",
        color: "blue",
        executionMode: "sequential",
        config: {
          prompt:
            "For non-qualified leads, create a 5-step nurture email sequence over 30 days. Focus on education and value-add content to warm them up for future outreach.",
        },
      },
      {
        agentId: "integration-webhook",
        name: "CRM Update",
        color: "orange",
        executionMode: "sequential",
        config: {
          text: "Update CRM with outreach results and lead dispositions",
        },
      },
    ],
    installs: 578,
  },
];

/**
 * Look up a template by its ID.
 */
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
