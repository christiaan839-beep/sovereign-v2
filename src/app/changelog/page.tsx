"use client";

import { motion } from "framer-motion";
import {
  Rocket,
  Shield,
  Workflow,
  Server,
  Brain,
  Cpu,
  Route,
  Layers,
  BarChart3,
  Terminal,
} from "lucide-react";

const CATEGORIES: Record<string, { color: string; bg: string }> = {
  Agents: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  Safety: {
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  Platform: { color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
  Models: {
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  Analytics: {
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
};

const ENTRIES = [
  {
    date: "May 15, 2026",
    title:
      "Cooks 158-161 — Savings calc + competitive matrix + DARPA app + LOI templates",
    category: "Platform",
    icon: Rocket,
    description:
      "Conversion + non-dilutive funding batch. /savings is an audit-prep ROI calculator targeting CCO/CISO/CMRO with industry-benchmark rates ($250/hr internal, $450/hr Big-4) and a one-click 'email this quote' CTA. /vs/compare is a 23-feature × 7-competitor matrix showing Sovereign as the only intersection of compliance + AI agents + crypto chain-of-custody. docs/darpa-sbir.md is a Phase I application draft for $250K non-dilutive. docs/loi-template.md ships 3 design-partner LOI variants (Big-4 CSRD, regional bank SR 11-7, top-20 pharma 21 CFR Part 11).",
  },
  {
    date: "May 15, 2026",
    title: "Cooks 155-157 — /careers + /press + /pitch",
    category: "Platform",
    icon: Route,
    description:
      "Public-surface marketing trio. /careers lists 1 Open GTM Partner role + 3 Hiring-Soon engineering roles (Cryptographer, Compliance, Forward-Deployed). /press ships boilerplate + 6 talking points + 6-question FAQ + 6 brand assets + press@sovereignmatrix email. /pitch is a 60-second narrative for cold investor DMs — distinct from the /investors data room.",
  },
  {
    date: "May 15, 2026",
    title:
      "Cooks 151-154 — Security policy + GDPR Processor + SOC 2 evidence + analytics shim",
    category: "Safety",
    icon: Shield,
    description:
      "Compliance + documentation batch. public/.well-known/security.txt is RFC 9116 compliant. docs/SECURITY.md ships the coordinated-disclosure policy with 24h/72h/14d/30d/90d SLOs. docs/GDPR-PROCESSOR.md is the Article 28 declaration (sub-processor list, Article 32 TOMs, SCCs, 48h breach SLO). src/lib/soc2-evidence.ts maps 24 TSC controls across all 5 categories to existing modules. src/lib/analytics-shim.ts is the provider-agnostic event tracker (PostHog + Plausible + first-party ingest, SSR-safe, no-op when unset). 27 new tests.",
  },
  {
    date: "May 15, 2026",
    title: "Cooks 148-150 — /grants directory + /starter-packs + Stripe seeder",
    category: "Platform",
    icon: Terminal,
    description:
      "Revenue + funding acceleration. /grants lists 25 non-dilutive programs sorted by speed-to-cash (AI Grant, Microsoft for Startups, DARPA SBIR, IARPA, NSF, In-Q-Tel, Stripe Capital, etc). /starter-packs ships 7 self-serve SKUs ($99-$999) including Verify-Your-Agent Audit, Implementation Kit, Regulatory Pack Templates, 4-hour Advisory, Founder 1:1, API trial. scripts/create-stripe-products.ts is a one-command idempotent seeder for all 18 Stripe SKUs.",
  },
  {
    date: "May 15, 2026",
    title: "Cooks 144-147 — Fundraise assets + revenue-loop completion",
    category: "Platform",
    icon: BarChart3,
    description:
      "/investors data room — the single URL the founder DMs to VCs (engineering inventory, comparable exits, capital plan, trajectory). /demo/verify-receipt shows 3 real signed receipts visitors reproduce with openssl. src/lib/add-on-provisioner.ts wires the Stripe webhook to actually provision Auditor Replay Seats after payment (12 tests). docs/INVESTOR_OUTREACH.md + docs/yc-application.md are the fundraise playbook + drafted YC application.",
  },
  {
    date: "May 15, 2026",
    title:
      "Cooks 140-143 — CI permissions + 2 verticals + add-on Stripe checkout",
    category: "Platform",
    icon: Route,
    description:
      "CI workflow gets explicit permissions: contents:read + actions:read block. /for-pharmacovigilance targets the zero-competition niche (Head of PV at top-40 pharma, $250-500K ACV, ICH E2B audit trails). /for-insurance-claims targets NAIC AI Bias wedge ($200-500K ACV at top-30 P&C carriers). /api/payments/stripe/addon-checkout creates Stripe Checkout sessions for any of the 7 add-on SKUs.",
  },
  {
    date: "May 15, 2026",
    title: "Cooks 137-139 — /for-csrd + Auditor Replay Seat SKU + CI v2",
    category: "Platform",
    icon: Layers,
    description:
      "/for-csrd targets Big-4 sustainability assurance partners for EU CSRD wave-1 (~12,000 issuers filing this year). src/lib/add-ons.ts ships 7 add-on SKUs: Auditor Replay Seat ($50K), 5 regulatory packs ($45K-$75K each), receipt-API overage ($0.05/receipt). 19 tests. CI hardening v2 pins ubuntu-22.04, adds fetch-depth:1, wraps npm ci in a 3-attempt retry.",
  },
  {
    date: "May 15, 2026",
    title: "Cook 136 — Anonymous replay-access credentials",
    category: "Safety",
    icon: Shield,
    description:
      "Short-lived capability tokens for third-party auditor replay without tenant disclosure. BBS+-shape implementation via HMAC-SHA256 + domain-separated bundle (no pairing-curve dep). Per-issuance nonce + constant-time MAC compare + group-secret rotation with sunset window + auditor-id anonymization. 17 tests. Closes the last crypto-moat gap from the 13-gap strategic analysis.",
  },
  {
    date: "May 15, 2026",
    title:
      "Cooks 130-135 — Model fingerprint + shadow-run + OpenAPI + 2 verticals",
    category: "Safety",
    icon: Cpu,
    description:
      "Verifiable model fingerprinting commits provider/model/version + behavior canary hash to every receipt (detects silent provider-side model swaps). Shadow-run drift detector samples production runs against the previous deploy (catches regressions before customers). /.well-known/openapi.json auto-publishes the public API spec sourced from MCP tool descriptors. /for-utilities (NERC CIP + EU CSRD) and /for-clinical-trials (ICH GCP + 21 CFR Part 11) verticals shipped.",
  },
  {
    date: "Apr 9, 2026",
    title: "Quality-retry loop in agent-factory",
    category: "Agents",
    icon: Brain,
    description:
      "Every agent output below the configured quality threshold automatically re-runs once with a sharpened prompt. Retry score must exceed the original or the run is marked partial. Wired in src/lib/agent-factory.ts; opt-out via skipQualityCheck for safety agents.",
  },
  {
    date: "Apr 9, 2026",
    title: "11 Comparison Pages + Claude Managed Agents",
    category: "Platform",
    icon: Route,
    description:
      "Added /vs/lindy, /vs/sintra, /vs/manus, /vs/relevance-ai, /vs/make, /vs/claude-agents. Positioned Claude Managed Agents as complementary, not competitive.",
  },
  {
    date: "Apr 9, 2026",
    title: "6 Sector Landing Pages",
    category: "Platform",
    icon: Layers,
    description:
      "Healthcare (HIPAA), Legal (confidentiality), Real Estate (voice agents), Recruiting, Cybersecurity (Glasswing), Education (FERPA). Each with sector-specific capabilities and workflows.",
  },
  {
    date: "Apr 9, 2026",
    title: "Dashboard Completion Sprint",
    category: "Platform",
    icon: Terminal,
    description:
      "Analytics dashboard (real API data), email builder (938 lines, 4 sequence types), reports page (AI-generated), notification bell, admin panel, quick-run banner.",
  },
  {
    date: "Apr 9, 2026",
    title: "Bento Grid + Performance Infrastructure",
    category: "Platform",
    icon: Layers,
    description:
      "Linear/Vercel-style feature showcase with 9 interactive cards. Plus useLazyLoad hook, Skeleton component, Badge component, useInterval hook.",
  },
  {
    date: "Apr 9, 2026",
    title: "Mythos-Ready Safety Stack",
    category: "Safety",
    icon: Shield,
    description:
      "Trust levels (4 autonomy settings), execution audit (immutable logs), output verifier (LlamaGuard + PII + quality), context compression (5 levels). Built for when frontier models can hack autonomously.",
  },
  {
    date: "Apr 8, 2026",
    title: "Competitive Hub — 5 Comparison Pages",
    category: "Platform",
    icon: Route,
    description:
      "Launched /vs/hubspot, /vs/clay, /vs/zapier, /vs/crewai, /vs/n8n with honest feature comparison tables, pricing breakdowns, and SEO metadata for high-intent search traffic.",
  },
  {
    date: "Apr 8, 2026",
    title: "Use Case Pages — Lead Gen, Content Engine, Second Brain",
    category: "Platform",
    icon: Layers,
    description:
      "Three dedicated use case pages showing step-by-step agent workflows: ICP-to-meeting lead pipeline, SEO-first content engine, and persistent AI memory system.",
  },
  {
    date: "Apr 8, 2026",
    title: "API Documentation — Stripe-Style Reference",
    category: "Platform",
    icon: Terminal,
    description:
      "Full API docs at /developers/docs with 9 endpoints, code examples, rate limits per plan, error codes, IntersectionObserver sidebar, and copy-to-clipboard.",
  },
  {
    date: "Apr 8, 2026",
    title: "Marketplace Honesty Audit",
    category: "Platform",
    icon: Shield,
    description:
      "Removed fake install counts and star ratings. Replaced with honest capability tags and Built-in badges. Added search, category filtering, and Submit Your Agent CTA.",
  },
  {
    date: "Apr 7, 2026",
    title: "Project Glasswing Integration",
    category: "Models",
    icon: Brain,
    description:
      "Added Claude Mythos to model registry (SWE-bench Pro 77.8%, CyberGym 83.1%). Security Command Center updated with real zero-day vulnerability findings from Anthropic's Glasswing report.",
  },
  {
    date: "Apr 7, 2026",
    title: "Market Pivot — LiveAgentTerminal + StackKiller + Agent OS",
    category: "Platform",
    icon: Rocket,
    description:
      "Three category-defining landing page sections: streaming competitive scan demo, 8-tool stack displacement ($705→$199), and 5-layer Agent OS architecture visualization.",
  },
  {
    date: "Apr 7, 2026",
    title: "ROI Calculator + Email Capture",
    category: "Platform",
    icon: Workflow,
    description:
      "Interactive dual-slider ROI calculator showing expected revenue, payback period, and vs-hiring-a-human costs. Email capture with localStorage + API persistence.",
  },
  {
    date: "Apr 7, 2026",
    title: "Consensus Engine Visualization",
    category: "Agents",
    icon: Brain,
    description:
      "4-model debate visualization on landing page: Nemotron-Ultra, DeepSeek-V3.2, Gemma-4, Qwen-3. Shows generate→critique→synthesize→verify pipeline with live confidence bars.",
  },
  {
    date: "Apr 7, 2026",
    title: "Full Honesty Audit — ZAR→USD + Fake Data Removal",
    category: "Safety",
    icon: Shield,
    description:
      "Removed all fabricated case studies, fake star ratings, ZAR pricing references. Replaced with honest try-it-yourself CTAs and real USD pricing ($19/$49/$199/$499).",
  },
  {
    date: "Mar 30, 2026",
    title: "66+ Models — GLM-5, Claude Mythos, NIM Function Calling",
    category: "Models",
    icon: Layers,
    description:
      "Added GLM-5 (744B MoE), GLM-4.7 (90.6% tool use), MiniMax M2.5, FLUX.1 Pro, Qwen3-Coder, and NIM native function calling. Smart Router now covers 20+ task types.",
  },
  {
    date: "Mar 29, 2026",
    title: "Production Security Hardening",
    category: "Safety",
    icon: Shield,
    description:
      "SQL injection protection, encrypted API keys, circuit breakers for all providers, audit logging (SOC 2 prep), PayFast signature verification, and auth on all 124 agent routes.",
  },
  {
    date: "Mar 29, 2026",
    title: "Visual Workflow Builder",
    category: "Platform",
    icon: Terminal,
    description:
      "Drag-and-drop agent pipeline builder. Chain agents into sequential workflows, customize prompts per step, and execute the full chain with one click.",
  },
  {
    date: "Mar 28, 2026",
    title: "API Playground",
    category: "Platform",
    icon: Terminal,
    description:
      "Interactive playground for testing agents without signing up. Pre-filled prompts, syntax-highlighted responses, and 3 free tries for visitors.",
  },
  {
    date: "Mar 24, 2026",
    title: "Revenue Attribution Dashboard",
    category: "Analytics",
    icon: BarChart3,
    description:
      "Full-funnel revenue tracking from first touch to closed deal. See exactly which agents drive pipeline and ROI across your entire stack.",
  },
  {
    date: "Mar 19, 2026",
    title: "Llama 4 Scout + DeepSeek V3.2",
    category: "Models",
    icon: Layers,
    description:
      "Added Meta Llama 4 Scout and DeepSeek V3.2 to the model registry. Smart Router automatically selects the best model per task.",
  },
  {
    date: "Mar 14, 2026",
    title: "124 Agent Routes",
    category: "Platform",
    icon: Route,
    description:
      "Scaled to 124 unique agent API routes spanning lead gen, content, SEO, voice, analytics, and marketplace operations.",
  },
  {
    date: "Mar 10, 2026",
    title: "Extended Thinking on 5 Agents",
    category: "Agents",
    icon: Brain,
    description:
      "Enabled extended thinking mode on God Brain, War Room, Market Intel, Blog Gen, and SEO Dominator for deeper multi-step reasoning.",
  },
  {
    date: "Mar 5, 2026",
    title: "Cross-Agent Learning Loop",
    category: "Agents",
    icon: Cpu,
    description:
      "Agents now share context and learn from each other. Insights from SEO audits feed into content generation, lead scoring improves from deal outcomes.",
  },
  {
    date: "Feb 27, 2026",
    title: "MCP Server — 7 Tools via JSON-RPC",
    category: "Platform",
    icon: Server,
    description:
      "Model Context Protocol server exposing 7 tools for external LLM integration. Connect Claude Desktop, Cursor, or any MCP client.",
  },
  {
    date: "Feb 20, 2026",
    title: "Visual Workflow Builder",
    category: "Platform",
    icon: Workflow,
    description:
      "Drag-and-drop workflow canvas for chaining agents into automated pipelines. Conditional branching, parallel execution, and scheduling built in.",
  },
  {
    date: "Feb 14, 2026",
    title: "NeMo Guardrails — 5-Layer Safety Pipeline",
    category: "Safety",
    icon: Shield,
    description:
      "Integrated NVIDIA NeMo Guardrails with 5 safety layers: input validation, topic boundaries, output filtering, hallucination detection, and PII redaction.",
  },
  {
    date: "Feb 8, 2026",
    title: "Agent Teams — Multi-Agent Debate System",
    category: "Agents",
    icon: Rocket,
    description:
      "War Room powered multi-agent debate where 3+ models argue, challenge, and synthesize answers. Produces higher-quality outputs than any single model.",
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono mb-4">
            <Rocket className="w-3 h-3" /> Changelog
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">
            What&apos;s New
          </h1>
          <p className="text-neutral-500 max-w-lg mx-auto">
            Every feature shipped. Follow our velocity.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Accent line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500/50 via-emerald-500/20 to-transparent" />

          <div className="space-y-10">
            {ENTRIES.map((entry, i) => {
              const Icon = entry.icon;
              const cat = CATEGORIES[entry.category];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="relative pl-12"
                >
                  {/* Dot */}
                  <div className="absolute left-[12px] top-1.5 w-[15px] h-[15px] rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>

                  <span className="text-xs font-mono text-neutral-500 mb-2 block">
                    {entry.date}
                  </span>
                  <div className="px-5 py-4 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl hover:border-emerald-500/20 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                        <h2 className="font-semibold text-white">
                          {entry.title}
                        </h2>
                      </div>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded-full border shrink-0 ${cat.bg} ${cat.color}`}
                      >
                        {entry.category}
                      </span>
                    </div>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                      {entry.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
