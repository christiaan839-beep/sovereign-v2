/**
 * SOVEREIGN MATRIX — Playbook Engine
 *
 * Playbooks are pre-configured multi-agent workflows that abstract away
 * individual agents. Users pick a BUSINESS OUTCOME, fill in 2-3 fields,
 * and hit deploy. The system assembles the right agent swarm automatically.
 *
 * Architecture:
 *   Playbook → Step[] → each step calls an agent via the coordinator
 *   Steps can reference outputs from previous steps via {{step_N}} templates
 *
 * Usage:
 *   import { PLAYBOOKS, resolvePlaybook } from "@/lib/playbooks";
 *   const steps = resolvePlaybook("competitor-takedown", { url: "acme.com" });
 */

export interface PlaybookField {
  key: string;
  label: string;
  type: "text" | "url" | "select" | "textarea";
  placeholder: string;
  required: boolean;
  options?: string[]; // For "select" type
}

export interface PlaybookStep {
  agent: string;
  params: Record<string, string>;
  reason: string;
}

export interface Playbook {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
  category: "growth" | "content" | "intelligence" | "operations";
  fields: PlaybookField[];
  steps: PlaybookStep[];
  estimatedTime: string; // e.g., "2-4 min"
  agentCount: number;
  /** Output guarantee — if not met, the run doesn't count against usage */
  guarantee?: string;
  /** Machine-checkable guarantee conditions */
  guaranteeCheck?: {
    minResultCount?: number; // e.g., "10+ leads"
    minWordCount?: number; // e.g., "1500+ words"
    minScore?: number; // e.g., quality score > 0.7
    maxAiDetection?: number; // e.g., < 10% AI detection
  };
}

// ─── Playbook Definitions ───────────────────────────────────────────────────

export const PLAYBOOKS: Playbook[] = [
  {
    id: "agency-content-packet",
    name: "Agency Content Packet",
    tagline: "One client → blog + email sequence + ads + competitor intel",
    description:
      "The weekly deliverable for B2B agencies. Drop in one of your client's domains and brand voice — get a 1,500-word SEO post, a 3-email welcome sequence, three platform-specific ads, and a competitor weakness teaser. Whitelabel-ready.",
    icon: "Briefcase",
    color: "amber",
    category: "content",
    fields: [
      {
        key: "clientName",
        label: "Client name",
        type: "text",
        placeholder: "e.g. Acme Corp",
        required: true,
      },
      {
        key: "clientDomain",
        label: "Client domain",
        type: "text",
        placeholder: "acmecorp.com",
        required: true,
      },
      {
        key: "clientDescription",
        label: "What does the client do?",
        type: "textarea",
        placeholder:
          "Two sentences. Who they are, who they serve, and one differentiator.",
        required: true,
      },
      {
        key: "audience",
        label: "Target audience",
        type: "text",
        placeholder: "Mid-market HR leaders at 100–500 person SaaS companies",
        required: true,
      },
      {
        key: "brandVoice",
        label: "Brand voice",
        type: "select",
        placeholder: "Pick a voice",
        required: true,
        options: ["professional", "casual", "technical", "friendly", "bold"],
      },
      {
        key: "primaryKeywords",
        label: "Primary keywords (comma-separated)",
        type: "text",
        placeholder: "applicant tracking, hiring funnel, recruiting ops",
        required: false,
      },
      {
        key: "competitorUrl",
        label: "Competitor URL (optional)",
        type: "url",
        placeholder: "https://competitor.com",
        required: false,
      },
    ],
    steps: [
      {
        agent: "agency-packet",
        params: {
          clientName: "{{clientName}}",
          clientDomain: "{{clientDomain}}",
          clientDescription: "{{clientDescription}}",
          audience: "{{audience}}",
          brandVoice: "{{brandVoice}}",
          primaryKeywords: "{{primaryKeywords}}",
          competitorUrl: "{{competitorUrl}}",
        },
        reason:
          "Fan out to blog-gen + email-sequence + ads + competitor scan in parallel; assemble the packet.",
      },
    ],
    estimatedTime: "60–90 sec",
    agentCount: 1,
    guarantee:
      "1,500+ word SEO post + 3 emails + 3 ads + 1 competitor teaser, or re-run free.",
    guaranteeCheck: { minWordCount: 1500, minScore: 0.7 },
  },
  {
    id: "recruiting-sourcing-sprint",
    name: "Recruiting Sourcing Sprint",
    tagline:
      "One role brief → ICP + boolean strings + outreach pack + objection plays",
    description:
      "The weekly deliverable for boutique recruiting agencies. Drop a role brief and must-have skills — get a structured ICP, three platform-specific boolean searches, three outreach variants (LinkedIn DM, cold email, voicemail), five non-LinkedIn sourcing channels, and a 4-objection playbook.",
    icon: "Users",
    color: "cyan",
    category: "growth",
    fields: [
      {
        key: "roleTitle",
        label: "Role title",
        type: "text",
        placeholder: "Senior Backend Engineer",
        required: true,
      },
      {
        key: "companyName",
        label: "Hiring company",
        type: "text",
        placeholder: "Acme Corp",
        required: true,
      },
      {
        key: "companyDescription",
        label: "What does the company do?",
        type: "textarea",
        placeholder:
          "Two sentences — what they build, who they serve, one differentiator that matters to candidates.",
        required: true,
      },
      {
        key: "mustHaveSkills",
        label: "Must-have skills (comma-separated)",
        type: "text",
        placeholder: "Go, distributed systems, Postgres",
        required: true,
      },
      {
        key: "seniorityLevel",
        label: "Seniority",
        type: "select",
        placeholder: "Pick one",
        required: true,
        options: ["junior", "mid", "senior", "staff", "principal"],
      },
      {
        key: "urgency",
        label: "Sourcing posture",
        type: "select",
        placeholder: "Pick one",
        required: true,
        options: ["fast-hire", "perfect-fit", "passive-talent"],
      },
      {
        key: "locationPreferences",
        label: "Location (optional)",
        type: "text",
        placeholder: "Remote (US) or London hybrid",
        required: false,
      },
      {
        key: "compensationRange",
        label: "Comp range (optional)",
        type: "text",
        placeholder: "$140K–$180K + equity",
        required: false,
      },
    ],
    steps: [
      {
        agent: "sourcing-sprint",
        params: {
          roleTitle: "{{roleTitle}}",
          companyName: "{{companyName}}",
          companyDescription: "{{companyDescription}}",
          mustHaveSkills: "{{mustHaveSkills}}",
          seniorityLevel: "{{seniorityLevel}}",
          urgency: "{{urgency}}",
          locationPreferences: "{{locationPreferences}}",
          compensationRange: "{{compensationRange}}",
        },
        reason:
          "Fan out to ICP + booleans + outreach + channels + objections in parallel; assemble the sprint.",
      },
    ],
    estimatedTime: "60–90 sec",
    agentCount: 1,
    guarantee:
      "Structured ICP + 3 boolean strings + 3 outreach drafts + 5 channels + 4 objection plays, or re-run free.",
    guaranteeCheck: { minResultCount: 5, minScore: 0.7 },
  },
  {
    id: "growth-pulse",
    name: "Growth Pulse",
    tagline:
      "One business → SEO + 4 social posts + email + WhatsApp + offer in Rands",
    description:
      "The monthly deliverable for African SMBs. Locale-aware (ZAR / NGN / KES / EGP / GHS), WhatsApp-first, and built for the businesses USD-only AI tools price out. Drop your business name and locale — get a local-SEO checklist, four platform-specific social posts, a re-engagement email, a WhatsApp broadcast template, and a limited-time offer card in your local currency.",
    icon: "Globe",
    color: "amber",
    category: "growth",
    fields: [
      {
        key: "businessName",
        label: "Business name",
        type: "text",
        placeholder: "e.g. Ndlovu Hair & Beauty",
        required: true,
      },
      {
        key: "businessDescription",
        label: "What does the business do?",
        type: "textarea",
        placeholder:
          "Two sentences — what you sell, who you serve, and one thing that makes you different in your area.",
        required: true,
      },
      {
        key: "industry",
        label: "Industry",
        type: "text",
        placeholder: "e.g. salon, accounting practice, e-commerce",
        required: true,
      },
      {
        key: "locale",
        label: "Locale",
        type: "select",
        placeholder: "Pick your country",
        required: true,
        options: [
          "ZA",
          "NG",
          "KE",
          "EG",
          "GH",
          "ZM",
          "ZW",
          "BW",
          "MA",
          "TN",
          "global-emerging",
        ],
      },
      {
        key: "topServices",
        label: "Top services (comma-separated, 1–3)",
        type: "text",
        placeholder: "e.g. braids, manicure, hair colour",
        required: true,
      },
      {
        key: "brandVoice",
        label: "Brand voice",
        type: "select",
        placeholder: "Pick a voice",
        required: true,
        options: ["warm", "professional", "casual", "playful", "direct"],
      },
      {
        key: "websiteUrl",
        label: "Website URL (optional)",
        type: "url",
        placeholder: "https://yourbusiness.co.za",
        required: false,
      },
    ],
    steps: [
      {
        agent: "growth-pulse",
        params: {
          businessName: "{{businessName}}",
          businessDescription: "{{businessDescription}}",
          industry: "{{industry}}",
          locale: "{{locale}}",
          topServices: "{{topServices}}",
          brandVoice: "{{brandVoice}}",
          websiteUrl: "{{websiteUrl}}",
        },
        reason:
          "Fan out to local-SEO + 4 social posts + re-engagement email + WhatsApp broadcast + offer card in parallel.",
      },
    ],
    estimatedTime: "60–90 sec",
    agentCount: 1,
    guarantee:
      "Local-SEO checklist + 4 social posts + re-engagement email + WhatsApp template + offer card in your currency, or re-run free.",
    guaranteeCheck: { minResultCount: 4, minScore: 0.7 },
  },
  {
    id: "lead-blitz",
    name: "Lead Blitz",
    tagline: "50 qualified leads + outreach in minutes",
    description:
      "Find prospects in your niche, verify their details, and draft personalized outreach emails — all in one shot.",
    icon: "Target",
    color: "emerald",
    category: "growth",
    fields: [
      {
        key: "niche",
        label: "Target Industry",
        type: "text",
        placeholder: "e.g. SaaS companies, dental practices",
        required: true,
      },
      {
        key: "location",
        label: "Location",
        type: "text",
        placeholder: "e.g. Texas, London, worldwide",
        required: true,
      },
      {
        key: "product",
        label: "Your Product/Service",
        type: "text",
        placeholder: "e.g. AI-powered CRM for agencies",
        required: true,
      },
    ],
    steps: [
      {
        agent: "leads",
        params: { niche: "{{niche}}", location: "{{location}}" },
        reason: "Find qualified prospects matching the target criteria",
      },
      {
        agent: "email-sequence",
        params: {
          product: "{{product}}",
          audience: "{{niche}} in {{location}}",
          context: "{{step_1}}",
        },
        reason: "Draft personalized outreach based on lead data",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
    guarantee:
      "5+ qualified companies with contact angles or the run doesn't count",
    guaranteeCheck: { minResultCount: 5, minScore: 0.7 },
  },
  {
    id: "competitor-takedown",
    name: "Competitor Takedown",
    tagline: "Full competitive analysis + counter-strategy",
    description:
      "Deep-dive into a competitor's website, SEO, pricing, and messaging. Get an actionable report to outmaneuver them.",
    icon: "Swords",
    color: "red",
    category: "intelligence",
    fields: [
      {
        key: "url",
        label: "Competitor URL",
        type: "url",
        placeholder: "e.g. competitor.com",
        required: true,
      },
      {
        key: "your_url",
        label: "Your Website (optional)",
        type: "url",
        placeholder: "e.g. youragency.com",
        required: false,
      },
    ],
    steps: [
      {
        agent: "site-assassin",
        params: { url: "{{url}}" },
        reason:
          "Deep scrape and analyze competitor's website structure and messaging",
      },
      {
        agent: "seo-dominator",
        params: { url: "{{url}}", context: "{{step_1}}" },
        reason: "Analyze their SEO strategy, rankings, and keyword gaps",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Based on this competitive analysis, create a battle card with 5 counter-positioning strategies. Competitor data: {{step_1}} SEO data: {{step_2}}",
          task_type: "analysis",
        },
        reason: "Synthesize findings into an actionable competitive strategy",
      },
    ],
    estimatedTime: "3-5 min",
    agentCount: 3,
    guarantee:
      "5+ counter-positioning strategies with specific action items or re-run free",
    guaranteeCheck: { minResultCount: 5, minScore: 0.75 },
  },
  {
    id: "content-machine",
    name: "Content Machine",
    tagline: "SEO blog + social posts from one topic",
    description:
      "Generate a full SEO-optimized blog post, then spin it into social media snippets for every platform.",
    icon: "PenTool",
    color: "violet",
    category: "content",
    fields: [
      {
        key: "topic",
        label: "Blog Topic",
        type: "text",
        placeholder: "e.g. How AI is transforming lead generation",
        required: true,
      },
      {
        key: "tone",
        label: "Tone",
        type: "select",
        placeholder: "Select tone",
        required: true,
        options: ["Professional", "Casual", "Technical", "Bold"],
      },
      {
        key: "keywords",
        label: "Target Keywords (optional)",
        type: "text",
        placeholder: "e.g. AI lead gen, automated outreach",
        required: false,
      },
    ],
    steps: [
      {
        agent: "blog-gen",
        params: {
          topic: "{{topic}}",
          tone: "{{tone}}",
          keywords: "{{keywords}}",
        },
        reason: "Write a comprehensive, SEO-optimized blog post",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Take this blog post and create: 1) A LinkedIn post (professional, 200 words), 2) A Twitter thread (5 tweets), 3) An Instagram caption (casual, with hashtags). Blog: {{step_1}}",
          task_type: "creative",
        },
        reason: "Repurpose the blog into platform-specific social content",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
    guarantee: "1,500+ word blog post + 3 social posts or re-run free",
    guaranteeCheck: { minWordCount: 1500, minScore: 0.75 },
  },
  {
    id: "proposal-blaster",
    name: "Proposal Blaster",
    tagline: "Client proposal + case study in one click",
    description:
      "Generate a professional proposal tailored to a prospect, including a relevant case study and pricing breakdown.",
    icon: "FileText",
    color: "amber",
    category: "operations",
    fields: [
      {
        key: "client",
        label: "Client Company Name",
        type: "text",
        placeholder: "e.g. Acme Corp",
        required: true,
      },
      {
        key: "service",
        label: "Service Being Proposed",
        type: "text",
        placeholder: "e.g. AI-powered lead generation and outbound automation",
        required: true,
      },
      {
        key: "budget",
        label: "Budget Range (optional)",
        type: "text",
        placeholder: "e.g. $5K-10K/month",
        required: false,
      },
    ],
    steps: [
      {
        agent: "case-study",
        params: {
          prompt:
            "Generate a relevant case study for pitching {{service}} to {{client}}. Include metrics, timeline, and results.",
          context: "{{service}}",
        },
        reason: "Create a compelling proof-of-results case study",
      },
      {
        agent: "proposal-generator",
        params: {
          prompt:
            "Write a professional business proposal for {{client}} for {{service}}. Budget: {{budget}}. Include the case study: {{step_1}}",
          context: "{{step_1}}",
        },
        reason: "Draft a complete client proposal with the case study embedded",
      },
    ],
    estimatedTime: "2-4 min",
    agentCount: 2,
  },
  {
    id: "seo-domination",
    name: "SEO Domination",
    tagline: "Full audit + content strategy + keyword plan",
    description:
      "Audit your website's SEO, find keyword opportunities, analyze top competitors, and get a 30-day content calendar.",
    icon: "TrendingUp",
    color: "cyan",
    category: "growth",
    fields: [
      {
        key: "url",
        label: "Your Website URL",
        type: "url",
        placeholder: "e.g. youragency.com",
        required: true,
      },
      {
        key: "keywords",
        label: "Target Keywords",
        type: "text",
        placeholder: "e.g. AI agency, lead generation tool",
        required: true,
      },
    ],
    steps: [
      {
        agent: "seo-dominator",
        params: { url: "{{url}}", keywords: "{{keywords}}" },
        reason:
          "Comprehensive SEO audit — technical issues, on-page, backlinks",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Based on this SEO audit, create a 30-day content calendar targeting the keywords {{keywords}}. Include blog topics, meta descriptions, and internal linking strategy. Audit: {{step_1}}",
          task_type: "analysis",
        },
        reason: "Turn the audit into an actionable content strategy",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "brand-forensics",
    name: "Brand Forensics",
    tagline: "Analyze any brand's voice, positioning & gaps",
    description:
      "Feed in a company URL and get a complete brand voice analysis, messaging teardown, and positioning recommendations.",
    icon: "Fingerprint",
    color: "pink",
    category: "intelligence",
    fields: [
      {
        key: "url",
        label: "Brand Website URL",
        type: "url",
        placeholder: "e.g. targetbrand.com",
        required: true,
      },
      {
        key: "industry",
        label: "Industry Context",
        type: "text",
        placeholder: "e.g. B2B SaaS, e-commerce fashion",
        required: true,
      },
    ],
    steps: [
      {
        agent: "site-assassin",
        params: { url: "{{url}}" },
        reason:
          "Deep scrape the brand's messaging, copy, and visual positioning",
      },
      {
        agent: "brand-voice",
        params: {
          prompt:
            "Analyze this brand's voice, messaging patterns, and positioning in the {{industry}} industry. Website data: {{step_1}}",
          context: "{{step_1}}",
        },
        reason:
          "Extract brand voice patterns, tone, vocabulary, and positioning gaps",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "funnel-autopsy",
    name: "Funnel Autopsy",
    tagline: "Find exactly where your funnel leaks",
    description:
      "Analyze your entire sales funnel from landing page to checkout. Get specific fixes for every drop-off point.",
    icon: "Activity",
    color: "orange",
    category: "growth",
    fields: [
      {
        key: "url",
        label: "Landing Page URL",
        type: "url",
        placeholder: "e.g. youragency.com/pricing",
        required: true,
      },
      {
        key: "goal",
        label: "Funnel Goal",
        type: "text",
        placeholder: "e.g. Book a demo call, Purchase subscription",
        required: true,
      },
    ],
    steps: [
      {
        agent: "funnel-xray",
        params: {
          url: "{{url}}",
          prompt:
            "Analyze this funnel for conversion optimization. The goal is: {{goal}}",
        },
        reason:
          "Deep analysis of every funnel stage — landing, interest, decision, action",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Based on this funnel analysis, provide: 1) Top 5 highest-impact fixes ranked by effort/impact, 2) A/B test suggestions for each fix, 3) Estimated conversion lift per fix. Analysis: {{step_1}}",
          task_type: "analysis",
        },
        reason: "Prioritize the fixes by business impact",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "ghost-fleet",
    name: "Apollo Ghost Fleet",
    tagline: "Mass outreach campaign from scratch",
    description:
      "Find 100 prospects, research their companies, craft personalized emails, and generate a full follow-up sequence.",
    icon: "Ghost",
    color: "neutral",
    category: "growth",
    fields: [
      {
        key: "niche",
        label: "Target Audience",
        type: "text",
        placeholder: "e.g. VP of Sales at Series B fintechs",
        required: true,
      },
      {
        key: "location",
        label: "Region",
        type: "text",
        placeholder: "e.g. United States, Europe, worldwide",
        required: true,
      },
      {
        key: "product",
        label: "What You're Selling",
        type: "textarea",
        placeholder: "Describe your product/service in 2-3 sentences",
        required: true,
      },
      {
        key: "tone",
        label: "Email Tone",
        type: "select",
        placeholder: "Select tone",
        required: true,
        options: [
          "Direct & Bold",
          "Professional",
          "Casual & Friendly",
          "Consultative",
        ],
      },
    ],
    steps: [
      {
        agent: "leads",
        params: { niche: "{{niche}}", location: "{{location}}" },
        reason:
          "Find and qualify prospects matching the ideal customer profile",
      },
      {
        agent: "competitor-scan",
        params: { target: "{{niche}}" },
        reason: "Research the market to inform personalized messaging angles",
      },
      {
        agent: "email-sequence",
        params: {
          product: "{{product}}",
          audience: "{{niche}}",
          tone: "{{tone}}",
          context: "Leads: {{step_1}}. Market context: {{step_2}}",
        },
        reason:
          "Draft a multi-touch outreach sequence with personalization hooks",
      },
    ],
    estimatedTime: "3-5 min",
    agentCount: 3,
  },
  {
    id: "meeting-prep",
    name: "Meeting Prep",
    tagline: "Walk into every meeting fully armed",
    description:
      "Research the company you're meeting with, generate tailored talking points, objection handlers, and smart questions to ask — so you never walk in cold.",
    icon: "FileText",
    color: "cyan",
    category: "operations",
    fields: [
      {
        key: "company_name",
        label: "Company Name",
        type: "text",
        placeholder: "e.g. Acme Corp",
        required: true,
      },
      {
        key: "meeting_type",
        label: "Meeting Type",
        type: "select",
        placeholder: "Select meeting type",
        required: true,
        options: [
          "Sales Call",
          "Partnership",
          "Investor Pitch",
          "Client Review",
        ],
      },
      {
        key: "notes",
        label: "Additional Notes (optional)",
        type: "textarea",
        placeholder: "e.g. Key topics to cover, known pain points",
        required: false,
      },
    ],
    steps: [
      {
        agent: "omni-search",
        params: {
          query: "{{company_name}}",
          context:
            "Research this company for an upcoming {{meeting_type}}. Notes: {{notes}}",
        },
        reason:
          "Research the company's recent news, leadership, and business context",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Based on this research about {{company_name}}, generate: 1) 5 tailored talking points for a {{meeting_type}}, 2) Objection handlers for likely pushbacks, 3) 5 smart questions to ask. Research: {{step_1}}",
          task_type: "analysis",
        },
        reason:
          "Generate talking points, objection handlers, and questions to ask",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "weekly-report",
    name: "Weekly Report",
    tagline: "Auto-generate your client status report",
    description:
      "Pull client metrics and activity, then format everything into a polished executive summary with charts, highlights, and next steps.",
    icon: "FileText",
    color: "violet",
    category: "operations",
    fields: [
      {
        key: "client_name",
        label: "Client Name",
        type: "text",
        placeholder: "e.g. Acme Corp",
        required: true,
      },
      {
        key: "period",
        label: "Reporting Period",
        type: "select",
        placeholder: "Select period",
        required: true,
        options: ["This Week", "Last Week", "This Month"],
      },
      {
        key: "highlights",
        label: "Key Highlights (optional)",
        type: "textarea",
        placeholder: "e.g. Launched new campaign, onboarded 3 accounts",
        required: false,
      },
    ],
    steps: [
      {
        agent: "client-report",
        params: {
          client: "{{client_name}}",
          period: "{{period}}",
          highlights: "{{highlights}}",
        },
        reason: "Pull metrics and activity data for the reporting period",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Format this client data into an executive summary report for {{client_name}} covering {{period}}. Include: 1) KPI dashboard with charts, 2) Key wins and highlights, 3) Issues and blockers, 4) Next steps and action items. Data: {{step_1}}",
          task_type: "analysis",
        },
        reason: "Format into executive summary with charts and next steps",
      },
    ],
    estimatedTime: "1-2 min",
    agentCount: 2,
  },
  {
    id: "contract-review",
    name: "Contract Review",
    tagline: "AI-powered legal risk analysis",
    description:
      "Analyze a contract for risks, obligations, and unusual clauses, then get a plain-English summary with risk ratings for every section.",
    icon: "FileText",
    color: "amber",
    category: "operations",
    fields: [
      {
        key: "contract_text",
        label: "Contract Text",
        type: "textarea",
        placeholder: "Paste the full contract text here",
        required: true,
      },
      {
        key: "party_name",
        label: "Other Party Name",
        type: "text",
        placeholder: "e.g. Acme Corp",
        required: true,
      },
    ],
    steps: [
      {
        agent: "contract-analyzer",
        params: { contract: "{{contract_text}}", party: "{{party_name}}" },
        reason: "Analyze for risks, obligations, and unusual clauses",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Based on this contract analysis with {{party_name}}, generate: 1) A plain-English summary of each section, 2) Risk ratings (Low/Medium/High/Critical) per clause, 3) Key obligations and deadlines, 4) Recommended negotiation points. Analysis: {{step_1}}",
          task_type: "analysis",
        },
        reason: "Generate plain-English summary with risk ratings",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "ad-campaign",
    name: "Ad Campaign Builder",
    tagline: "Full ad creative suite from one brief",
    description:
      "Analyze the market and competitor ads, generate ad copy variants with headlines and descriptions for your platform, then ensure everything matches your brand voice.",
    icon: "Target",
    color: "pink",
    category: "growth",
    fields: [
      {
        key: "product",
        label: "Product/Service",
        type: "text",
        placeholder: "e.g. AI-powered CRM for agencies",
        required: true,
      },
      {
        key: "audience",
        label: "Target Audience",
        type: "text",
        placeholder: "e.g. Marketing directors at mid-market SaaS companies",
        required: true,
      },
      {
        key: "platform",
        label: "Ad Platform",
        type: "select",
        placeholder: "Select platform",
        required: true,
        options: [
          "Google Ads",
          "Facebook/Instagram",
          "LinkedIn",
          "All Platforms",
        ],
      },
      {
        key: "budget",
        label: "Monthly Budget (optional)",
        type: "text",
        placeholder: "e.g. $5K/month",
        required: false,
      },
    ],
    steps: [
      {
        agent: "ad-report",
        params: {
          product: "{{product}}",
          audience: "{{audience}}",
          platform: "{{platform}}",
          budget: "{{budget}}",
        },
        reason: "Analyze market and competitor ads for the target platform",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Based on this market and ad analysis, generate ad copy for {{platform}} targeting {{audience}} for {{product}}. Include: 1) 5 headline variants, 2) 3 description variants, 3) CTA options, 4) Ad extensions/sitelinks if applicable. Budget context: {{budget}}. Research: {{step_1}}",
          task_type: "creative",
        },
        reason:
          "Generate ad copy variants, headlines, and descriptions for the platform",
      },
      {
        agent: "brand-voice",
        params: {
          prompt:
            "Review and refine this ad copy to ensure it matches brand guidelines. Adjust tone, vocabulary, and messaging for consistency. Ad copy: {{step_2}}",
          context: "{{step_2}}",
        },
        reason: "Ensure all copy matches brand guidelines",
      },
    ],
    estimatedTime: "3-4 min",
    agentCount: 3,
  },
  {
    id: "onboard-client",
    name: "Onboarding Accelerator",
    tagline: "Set up a new client in under 5 minutes",
    description:
      "Analyze a new client's website and brand, find sample prospects in their market, and draft an initial proposal — all from a single URL.",
    icon: "Rocket",
    color: "emerald",
    category: "operations",
    fields: [
      {
        key: "client_url",
        label: "Client Website URL",
        type: "url",
        placeholder: "e.g. newclient.com",
        required: true,
      },
      {
        key: "client_name",
        label: "Client Name",
        type: "text",
        placeholder: "e.g. Acme Corp",
        required: true,
      },
      {
        key: "service",
        label: "Service Being Offered",
        type: "text",
        placeholder: "e.g. AI-powered lead generation and outbound automation",
        required: true,
      },
    ],
    steps: [
      {
        agent: "site-assassin",
        params: { url: "{{client_url}}" },
        reason: "Analyze client's website, brand positioning, and messaging",
      },
      {
        agent: "leads",
        params: {
          niche: "Prospects for {{client_name}}",
          location: "worldwide",
          context:
            "Based on this brand analysis, find 10 sample prospects that would be ideal customers for this client. Brand data: {{step_1}}",
        },
        reason: "Find 10 sample prospects for the client",
      },
      {
        agent: "proposal-generator",
        params: {
          prompt:
            "Draft an initial proposal for {{client_name}} for {{service}}. Include findings from the website analysis and sample prospect list as proof of capability. Website analysis: {{step_1}} Sample prospects: {{step_2}}",
          context: "{{step_1}}",
        },
        reason: "Draft an initial proposal based on findings",
      },
    ],
    estimatedTime: "3-5 min",
    agentCount: 3,
  },

  // ─── Real Estate Pack ──────────────────────────────────────────────────────

  {
    id: "property-listing",
    name: "Property Listing Generator",
    tagline: "Photos to listing in 60 seconds",
    description:
      "Generate a compelling property listing with SEO-optimized copy from basic property details and key features.",
    icon: "Home",
    color: "emerald",
    category: "operations",
    fields: [
      {
        key: "property_address",
        label: "Property Address",
        type: "text",
        placeholder: "e.g. 123 Main Street, Cape Town",
        required: true,
      },
      {
        key: "property_type",
        label: "Property Type",
        type: "select",
        placeholder: "Select property type",
        required: true,
        options: ["House", "Apartment", "Commercial", "Land"],
      },
      {
        key: "key_features",
        label: "Key Features",
        type: "textarea",
        placeholder:
          "e.g. 3 bed, 2 bath, pool, mountain views, renovated kitchen",
        required: true,
      },
      {
        key: "price",
        label: "Asking Price (optional)",
        type: "text",
        placeholder: "e.g. R2,500,000 or $450,000",
        required: false,
      },
    ],
    steps: [
      {
        agent: "smart-router",
        params: {
          prompt:
            "Generate a compelling property description for a {{property_type}} at {{property_address}}. Key features: {{key_features}}. Price: {{price}}. Write in an aspirational, professional real estate tone that highlights lifestyle benefits.",
          task_type: "creative",
        },
        reason: "Generate compelling property description from features",
      },
      {
        agent: "blog-gen",
        params: {
          topic:
            "Property listing for {{property_type}} at {{property_address}}",
          tone: "Professional",
          keywords:
            "{{property_type}}, {{property_address}}, property for sale",
          context: "{{step_1}}",
        },
        reason: "Create SEO-optimized listing page copy",
      },
    ],
    estimatedTime: "1-2 min",
    agentCount: 2,
  },
  {
    id: "open-house-followup",
    name: "Open House Follow-Up",
    tagline: "Automated nurture after every showing",
    description:
      "Analyze open house feedback and generate personalized follow-up email sequences segmented by attendee interest level.",
    icon: "DoorOpen",
    color: "amber",
    category: "operations",
    fields: [
      {
        key: "property_address",
        label: "Property Address",
        type: "text",
        placeholder: "e.g. 123 Main Street, Cape Town",
        required: true,
      },
      {
        key: "attendee_count",
        label: "Number of Attendees",
        type: "text",
        placeholder: "e.g. 15",
        required: true,
      },
      {
        key: "feedback_notes",
        label: "Feedback Notes (optional)",
        type: "textarea",
        placeholder:
          "e.g. Couple loved the kitchen, family concerned about school zones",
        required: false,
      },
    ],
    steps: [
      {
        agent: "smart-router",
        params: {
          prompt:
            "Analyze open house feedback for {{property_address}} with {{attendee_count}} attendees. Feedback: {{feedback_notes}}. Segment attendees into hot (ready to offer), warm (interested but hesitant), and cold (just browsing) categories. Provide engagement strategy for each segment.",
          task_type: "analysis",
        },
        reason: "Analyze feedback and segment attendees by interest level",
      },
      {
        agent: "email-sequence",
        params: {
          product: "Property at {{property_address}}",
          audience: "Open house attendees",
          context: "{{step_1}}",
        },
        reason:
          "Draft personalized follow-up sequence for hot/warm/cold attendees",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "market-analysis",
    name: "Neighborhood Market Analysis",
    tagline: "Comparable sales + trend analysis",
    description:
      "Research recent sales, price trends, and demographics for any neighborhood to inform pricing and investment decisions.",
    icon: "BarChart3",
    color: "cyan",
    category: "operations",
    fields: [
      {
        key: "neighborhood",
        label: "Neighborhood / Area",
        type: "text",
        placeholder: "e.g. Camps Bay, Cape Town",
        required: true,
      },
      {
        key: "property_type",
        label: "Property Type",
        type: "select",
        placeholder: "Select property type",
        required: true,
        options: ["Residential", "Commercial"],
      },
      {
        key: "radius",
        label: "Search Radius (optional)",
        type: "text",
        placeholder: "e.g. 5km",
        required: false,
      },
    ],
    steps: [
      {
        agent: "omni-search",
        params: {
          query:
            "{{property_type}} property sales trends {{neighborhood}} {{radius}}",
          context:
            "Research recent sales, price trends, demographics for the area",
        },
        reason:
          "Research recent sales, price trends, demographics for the area",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Based on the following market research for {{neighborhood}} ({{property_type}}, radius: {{radius}}), generate a comprehensive market analysis report. Include: 1) Recent comparable sales, 2) Price trends over the last 12 months, 3) Demographic overview, 4) Supply vs demand dynamics, 5) Pricing recommendations. Research: {{step_1}}",
          task_type: "analysis",
        },
        reason: "Generate market analysis report with pricing recommendations",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "seller-cma",
    name: "Seller CMA Report",
    tagline: "Comparative market analysis in minutes",
    description:
      "Generate a professional comparative market analysis report with comparable properties, pricing recommendations, and market context.",
    icon: "FileBarChart",
    color: "violet",
    category: "operations",
    fields: [
      {
        key: "property_address",
        label: "Property Address",
        type: "text",
        placeholder: "e.g. 123 Main Street, Cape Town",
        required: true,
      },
      {
        key: "bedrooms",
        label: "Bedrooms",
        type: "text",
        placeholder: "e.g. 3",
        required: true,
      },
      {
        key: "square_meters",
        label: "Square Meters",
        type: "text",
        placeholder: "e.g. 150",
        required: true,
      },
      {
        key: "condition",
        label: "Property Condition",
        type: "select",
        placeholder: "Select condition",
        required: true,
        options: ["Excellent", "Good", "Fair", "Needs Work"],
      },
    ],
    steps: [
      {
        agent: "omni-search",
        params: {
          query:
            "comparable properties near {{property_address}} {{bedrooms}} bedrooms {{square_meters}} sqm",
          context: "Find comparable properties and recent sales data",
        },
        reason: "Find comparable properties and recent sales data",
      },
      {
        agent: "proposal-generator",
        params: {
          prompt:
            "Generate a professional CMA (Comparative Market Analysis) report for the property at {{property_address}}. Property details: {{bedrooms}} bedrooms, {{square_meters}} sqm, condition: {{condition}}. Based on these comparables and market data: {{step_1}}. Include: 1) Comparable property analysis, 2) Price adjustments based on condition, size, and features, 3) Recommended listing price range, 4) Days-on-market estimate, 5) Marketing strategy recommendations.",
          context: "{{step_1}}",
        },
        reason: "Generate professional CMA report with pricing recommendation",
      },
    ],
    estimatedTime: "2-4 min",
    agentCount: 2,
  },

  // ─── Legal Pack ────────────────────────────────────────────────────────────

  {
    id: "case-research",
    name: "Case Law Research",
    tagline: "AI-powered legal research brief",
    description:
      "Research relevant case law, statutes, and precedents, then synthesize findings into a structured legal research memo with citations.",
    icon: "Scale",
    color: "amber",
    category: "operations",
    fields: [
      {
        key: "legal_question",
        label: "Legal Question",
        type: "textarea",
        placeholder:
          "e.g. Can an employer terminate an employee for social media posts made outside work hours?",
        required: true,
      },
      {
        key: "jurisdiction",
        label: "Jurisdiction",
        type: "text",
        placeholder: "e.g. South Africa, California",
        required: true,
      },
      {
        key: "case_type",
        label: "Case Type",
        type: "select",
        placeholder: "Select case type",
        required: true,
        options: ["Civil", "Criminal", "Corporate", "IP", "Employment"],
      },
    ],
    steps: [
      {
        agent: "omni-search",
        params: {
          query: "{{legal_question}} {{case_type}} law {{jurisdiction}}",
          context: "Research relevant case law, statutes, and precedents",
        },
        reason: "Research relevant case law, statutes, and precedents",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Synthesize the following legal research into a structured legal research memo. Question: {{legal_question}}. Jurisdiction: {{jurisdiction}}. Case type: {{case_type}}. Include: 1) Issue statement, 2) Relevant statutes, 3) Key case law with citations, 4) Analysis of how precedents apply, 5) Conclusion and recommendation. Research: {{step_1}}",
          task_type: "analysis",
        },
        reason: "Synthesize into structured legal research memo with citations",
      },
    ],
    estimatedTime: "3-5 min",
    agentCount: 2,
  },
  {
    id: "client-intake",
    name: "Client Intake Qualifier",
    tagline: "Qualify new clients before the first call",
    description:
      "Analyze matter complexity, estimate hours, flag potential conflicts, and draft an engagement letter with scope and fee estimate.",
    icon: "UserCheck",
    color: "emerald",
    category: "operations",
    fields: [
      {
        key: "client_name",
        label: "Client Name",
        type: "text",
        placeholder: "e.g. John Smith",
        required: true,
      },
      {
        key: "matter_type",
        label: "Matter Type",
        type: "text",
        placeholder: "e.g. Commercial lease dispute, IP infringement claim",
        required: true,
      },
      {
        key: "urgency",
        label: "Urgency",
        type: "select",
        placeholder: "Select urgency",
        required: true,
        options: ["Urgent", "Standard", "Low"],
      },
      {
        key: "initial_notes",
        label: "Initial Notes (optional)",
        type: "textarea",
        placeholder:
          "e.g. Client was referred by existing client, matter involves cross-border elements",
        required: false,
      },
    ],
    steps: [
      {
        agent: "smart-router",
        params: {
          prompt:
            "Analyze this new client intake for {{client_name}}. Matter: {{matter_type}}. Urgency: {{urgency}}. Notes: {{initial_notes}}. Provide: 1) Matter complexity assessment (Simple/Moderate/Complex), 2) Estimated hours range, 3) Potential conflict flags, 4) Key risks and considerations, 5) Recommended team composition.",
          task_type: "analysis",
        },
        reason: "Analyze matter complexity, estimate hours, flag conflicts",
      },
      {
        agent: "proposal-generator",
        params: {
          prompt:
            "Draft a professional engagement letter for {{client_name}} regarding {{matter_type}}. Based on this analysis: {{step_1}}. Include: 1) Scope of work, 2) Fee structure and estimate, 3) Timeline expectations, 4) Terms and conditions, 5) Next steps.",
          context: "{{step_1}}",
        },
        reason: "Draft engagement letter with scope and fee estimate",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },
  {
    id: "discovery-analyzer",
    name: "Discovery Document Analyzer",
    tagline: "Analyze thousands of pages in minutes",
    description:
      "Analyze discovery documents for relevant evidence and key facts, then generate a summary with highlighted findings and relevance ratings.",
    icon: "Search",
    color: "red",
    category: "operations",
    fields: [
      {
        key: "document_text",
        label: "Document Text",
        type: "textarea",
        placeholder: "Paste the document text to analyze",
        required: true,
      },
      {
        key: "case_summary",
        label: "Case Summary",
        type: "text",
        placeholder:
          "e.g. Breach of contract dispute regarding software development agreement",
        required: true,
      },
      {
        key: "looking_for",
        label: "What to Look For",
        type: "textarea",
        placeholder:
          "e.g. Evidence of breach of contract, communication about the deal",
        required: true,
      },
    ],
    steps: [
      {
        agent: "contract-analyzer",
        params: { contract: "{{document_text}}", party: "{{case_summary}}" },
        reason: "Analyze documents for relevant evidence and key facts",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Based on the following document analysis for the case: {{case_summary}}, generate a discovery summary. We are looking for: {{looking_for}}. Include: 1) Key findings ranked by relevance (High/Medium/Low), 2) Relevant excerpts with page/section references, 3) Timeline of events found, 4) Gaps in evidence, 5) Recommendations for further discovery. Analysis: {{step_1}}",
          task_type: "analysis",
        },
        reason:
          "Generate discovery summary with highlighted findings and relevance ratings",
      },
    ],
    estimatedTime: "3-5 min",
    agentCount: 2,
  },
  {
    id: "legal-letter",
    name: "Legal Letter Drafter",
    tagline: "Professional legal correspondence",
    description:
      "Draft a professional legal letter with appropriate tone and legal language, then review it for legal accuracy and completeness.",
    icon: "Mail",
    color: "neutral",
    category: "operations",
    fields: [
      {
        key: "letter_type",
        label: "Letter Type",
        type: "select",
        placeholder: "Select letter type",
        required: true,
        options: [
          "Demand Letter",
          "Cease and Desist",
          "Notice",
          "Response",
          "Settlement Offer",
        ],
      },
      {
        key: "recipient",
        label: "Recipient",
        type: "text",
        placeholder: "e.g. Acme Corp, Attn: Legal Department",
        required: true,
      },
      {
        key: "facts",
        label: "Relevant Facts",
        type: "textarea",
        placeholder: "Describe the situation, key dates, and relevant facts",
        required: true,
      },
      {
        key: "desired_outcome",
        label: "Desired Outcome",
        type: "text",
        placeholder:
          "e.g. Payment of R50,000 within 30 days, Cease use of trademark",
        required: true,
      },
    ],
    steps: [
      {
        agent: "smart-router",
        params: {
          prompt:
            "Draft a professional {{letter_type}} to {{recipient}}. Facts: {{facts}}. Desired outcome: {{desired_outcome}}. Use appropriate legal language and tone for a {{letter_type}}. Include: 1) Proper legal formatting, 2) Clear statement of facts, 3) Legal basis for the claim/request, 4) Specific demands with deadlines, 5) Consequences of non-compliance.",
          task_type: "creative",
        },
        reason:
          "Draft professional legal letter with appropriate tone and legal language",
      },
      {
        agent: "contract-analyzer",
        params: { contract: "{{step_1}}", party: "{{recipient}}" },
        reason: "Review for legal accuracy and completeness",
      },
    ],
    estimatedTime: "2-3 min",
    agentCount: 2,
  },

  // ─── Recruiting Pack ───────────────────────────────────────────────────────

  {
    id: "job-description",
    name: "Job Description Writer",
    tagline: "Inclusive, compelling job posts",
    description:
      "Write a compelling, DEI-inclusive job description optimized for job board SEO and keyword targeting.",
    icon: "Briefcase",
    color: "violet",
    category: "growth",
    fields: [
      {
        key: "role_title",
        label: "Role Title",
        type: "text",
        placeholder: "e.g. Senior Full-Stack Developer",
        required: true,
      },
      {
        key: "department",
        label: "Department",
        type: "text",
        placeholder: "e.g. Engineering, Marketing, Sales",
        required: true,
      },
      {
        key: "seniority",
        label: "Seniority Level",
        type: "select",
        placeholder: "Select seniority",
        required: true,
        options: ["Junior", "Mid-Level", "Senior", "Lead", "Director", "VP"],
      },
      {
        key: "key_requirements",
        label: "Key Requirements",
        type: "textarea",
        placeholder:
          "e.g. 5+ years React, Node.js experience, AWS certification preferred",
        required: true,
      },
      {
        key: "company_culture",
        label: "Company Culture (optional)",
        type: "textarea",
        placeholder:
          "e.g. Remote-first, async communication, quarterly team retreats",
        required: false,
      },
    ],
    steps: [
      {
        agent: "smart-router",
        params: {
          prompt:
            "Write a compelling job description for a {{seniority}} {{role_title}} in the {{department}} department. Requirements: {{key_requirements}}. Company culture: {{company_culture}}. Ensure DEI-inclusive language — avoid gendered terms, unnecessary jargon, and inflated requirements. Include: 1) Engaging role summary, 2) Key responsibilities, 3) Required qualifications, 4) Nice-to-haves, 5) Benefits and culture section.",
          task_type: "creative",
        },
        reason: "Write compelling job description with DEI-inclusive language",
      },
      {
        agent: "seo-dominator",
        params: {
          url: "",
          keywords: "{{role_title}}, {{department}}, {{seniority}} jobs",
          context:
            "Optimize this job posting for job board SEO and keyword targeting: {{step_1}}",
        },
        reason: "Optimize for job board SEO and keyword targeting",
      },
    ],
    estimatedTime: "1-2 min",
    agentCount: 2,
  },
  {
    id: "candidate-screen",
    name: "Candidate Screening Agent",
    tagline: "Score and rank candidates automatically",
    description:
      "Analyze a candidate against job requirements with criteria-based scoring, then generate tailored interview questions for identified gaps.",
    icon: "UserSearch",
    color: "cyan",
    category: "growth",
    fields: [
      {
        key: "job_requirements",
        label: "Job Requirements",
        type: "textarea",
        placeholder: "e.g. 5+ years Python, AWS experience, team leadership",
        required: true,
      },
      {
        key: "candidate_info",
        label: "Candidate Info",
        type: "textarea",
        placeholder: "Paste CV/resume text or LinkedIn summary",
        required: true,
      },
      {
        key: "must_haves",
        label: "Must-Have Qualifications",
        type: "text",
        placeholder: "e.g. 5+ years Python, AWS experience",
        required: true,
      },
    ],
    steps: [
      {
        agent: "smart-router",
        params: {
          prompt:
            "Analyze this candidate against the job requirements. Requirements: {{job_requirements}}. Must-haves: {{must_haves}}. Candidate info: {{candidate_info}}. Score 1-10 on each requirement. Provide: 1) Overall fit score, 2) Per-criteria breakdown, 3) Strengths, 4) Gaps and risks, 5) Go/No-Go recommendation.",
          task_type: "analysis",
        },
        reason:
          "Analyze candidate against requirements, score 1-10 on each criteria",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Based on this candidate screening analysis, generate tailored interview questions to probe the identified gaps and verify claimed strengths. Include: 1) 5 gap-focused questions, 2) 3 strength-verification questions, 3) 2 culture-fit questions. Screening results: {{step_1}}",
          task_type: "creative",
        },
        reason: "Generate interview questions tailored to candidate gaps",
      },
    ],
    estimatedTime: "1-2 min",
    agentCount: 2,
  },
  {
    id: "interview-kit",
    name: "Interview Question Generator",
    tagline: "Structured interviews that find the best hire",
    description:
      "Generate structured interview questions with a scoring rubric and candidate evaluation scorecard template.",
    icon: "ClipboardList",
    color: "pink",
    category: "growth",
    fields: [
      {
        key: "role_title",
        label: "Role Title",
        type: "text",
        placeholder: "e.g. Senior Product Manager",
        required: true,
      },
      {
        key: "competencies",
        label: "Competencies to Assess",
        type: "textarea",
        placeholder: "e.g. Leadership, technical depth, problem-solving",
        required: true,
      },
      {
        key: "interview_type",
        label: "Interview Type",
        type: "select",
        placeholder: "Select interview type",
        required: true,
        options: ["Behavioral", "Technical", "Case Study", "Culture Fit"],
      },
    ],
    steps: [
      {
        agent: "smart-router",
        params: {
          prompt:
            "Generate 10 structured {{interview_type}} interview questions for a {{role_title}} role. Competencies to assess: {{competencies}}. For each question provide: 1) The question, 2) What it assesses, 3) What a great answer looks like, 4) Red flags to watch for, 5) Scoring rubric (1-5 scale with descriptions).",
          task_type: "creative",
        },
        reason:
          "Generate 10 structured interview questions with scoring rubric",
      },
      {
        agent: "smart-router",
        params: {
          prompt:
            "Based on these interview questions for {{role_title}}, create a candidate evaluation scorecard template. Include: 1) Competency grid with weight percentages, 2) Individual question scores, 3) Overall recommendation framework (Strong Hire / Hire / No Hire / Strong No Hire), 4) Notes section for each competency. Questions: {{step_1}}",
          task_type: "creative",
        },
        reason: "Create candidate evaluation scorecard template",
      },
    ],
    estimatedTime: "1-2 min",
    agentCount: 2,
  },
  {
    id: "offer-letter",
    name: "Offer Letter Drafter",
    tagline: "Professional offers in one click",
    description:
      "Draft a professional offer letter with compensation details, then review it for compliance and completeness.",
    icon: "FileSignature",
    color: "emerald",
    category: "growth",
    fields: [
      {
        key: "candidate_name",
        label: "Candidate Name",
        type: "text",
        placeholder: "e.g. Jane Smith",
        required: true,
      },
      {
        key: "role_title",
        label: "Role Title",
        type: "text",
        placeholder: "e.g. Senior Full-Stack Developer",
        required: true,
      },
      {
        key: "salary",
        label: "Salary / Compensation",
        type: "text",
        placeholder: "e.g. R850,000/year or $120,000/year",
        required: true,
      },
      {
        key: "start_date",
        label: "Start Date",
        type: "text",
        placeholder: "e.g. 1 May 2026",
        required: true,
      },
      {
        key: "benefits",
        label: "Benefits (optional)",
        type: "textarea",
        placeholder:
          "e.g. Medical aid, 20 days leave, remote work, stock options",
        required: false,
      },
    ],
    steps: [
      {
        agent: "proposal-generator",
        params: {
          prompt:
            "Draft a professional offer letter for {{candidate_name}} for the position of {{role_title}}. Compensation: {{salary}}. Start date: {{start_date}}. Benefits: {{benefits}}. Include: 1) Warm welcome and excitement about the hire, 2) Role and reporting structure, 3) Compensation breakdown, 4) Benefits summary, 5) Start date and onboarding details, 6) Acceptance deadline and next steps.",
          context: "Offer letter for {{candidate_name}}",
        },
        reason: "Draft professional offer letter with compensation details",
      },
      {
        agent: "contract-analyzer",
        params: { contract: "{{step_1}}", party: "{{candidate_name}}" },
        reason: "Review for compliance and completeness",
      },
    ],
    estimatedTime: "1-2 min",
    agentCount: 2,
  },
];

// ─── Resolution Engine ──────────────────────────────────────────────────────

/**
 * Resolve a playbook's step templates using the provided user input.
 * Replaces {{field}} placeholders with actual values, and {{step_N}}
 * with previous step outputs at execution time.
 */
export function resolvePlaybookSteps(
  playbook: Playbook,
  userInput: Record<string, string>,
): PlaybookStep[] {
  return playbook.steps.map((step) => {
    const resolvedParams: Record<string, string> = {};
    for (const [key, template] of Object.entries(step.params)) {
      let resolved = template;
      // Replace user input placeholders
      for (const [field, value] of Object.entries(userInput)) {
        resolved = resolved.replaceAll(`{{${field}}}`, value || "");
      }
      resolvedParams[key] = resolved;
    }
    return {
      ...step,
      params: resolvedParams,
    };
  });
}

/**
 * Get playbooks by category.
 */
export function getPlaybooksByCategory(
  category: Playbook["category"],
): Playbook[] {
  return PLAYBOOKS.filter((p) => p.category === category);
}

/**
 * Find a playbook by ID.
 */
export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}

export const PLAYBOOK_CATEGORIES = [
  { id: "growth" as const, label: "Growth & Leads", icon: "Rocket" },
  { id: "content" as const, label: "Content Creation", icon: "PenTool" },
  { id: "intelligence" as const, label: "Intelligence", icon: "Brain" },
  { id: "operations" as const, label: "Operations", icon: "Settings" },
] as const;

/**
 * The slugs we feature on the marketing landing page. Edit this list — not the
 * full PLAYBOOKS array — when you want to swap which playbooks show up above
 * the fold. Order is preserved in the rendered grid.
 */
const MARKETING_PLAYBOOK_IDS: readonly string[] = [
  "lead-blitz",
  "content-machine",
  "competitor-takedown",
  "weekly-report",
];

/**
 * Returns the playbooks featured on the public landing page, in display order.
 * Skips any IDs that don't resolve to a real playbook so a typo here can't
 * crash the build.
 */
export function getMarketingPlaybooks(): Playbook[] {
  return MARKETING_PLAYBOOK_IDS.map((id) => getPlaybook(id)).filter(
    (p): p is Playbook => Boolean(p),
  );
}
