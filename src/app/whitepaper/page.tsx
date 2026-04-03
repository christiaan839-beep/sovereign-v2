"use client";

import { motion } from "framer-motion";
import { FileText, Download, ArrowLeft, Shield, Cpu, Globe2, Brain, Zap, Lock } from "lucide-react";
import Link from "next/link";

const SECTIONS = [
  {
    id: "why-now",
    title: "Why Autonomous Agents Are Replacing Chatbots",
    icon: Brain,
    content: "Enterprise AI is moving past chatbots. The first wave — ChatGPT, Gemini, Claude — gave companies conversational tools that draft text. The second wave is different: AI systems that plan, execute, verify, and deliver finished work without constant prompting. Instead of asking an AI to write an email, you tell it to find 50 qualified prospects and draft personalized outreach for each. The system breaks that goal into steps, assigns each step to a specialized agent, and delivers results. This is the shift from AI assistants to AI workers — and it demands a new kind of platform built for autonomous execution, not conversation.",
  },
  {
    id: "architecture",
    title: "The Autonomous Agency Operating System",
    icon: Cpu,
    content: "Sovereign Matrix runs 130+ specialized agents — each built for one job. Lead generation agents find and qualify prospects. Content agents write blog posts and social media. SEO agents audit websites and build keyword strategies. Voice agents make sales calls with sub-200ms latency. Code agents write, test, and deploy software. Instead of one general-purpose chatbot trying to do everything, the platform assigns each task to an agent trained specifically for that type of work. The result: higher quality output, faster execution, and fewer errors.",
  },
  {
    id: "routing",
    title: "Smart Routing & Multi-Model Intelligence",
    icon: Zap,
    content: "Every task gets routed to the best AI model for that job — automatically. The Smart Router classifies incoming requests and assigns them: DeepSeek V3.2 for complex reasoning and code, Qwen 3 for multilingual work, Llama 4 Scout for processing massive documents (10M token context). If one model is slow or down, the system silently fails over to the next best option. Users never see an error page. The circuit breaker pattern (borrowed from distributed systems engineering) ensures that one provider's outage doesn't cascade into a platform-wide failure.",
  },
  {
    id: "sovereignty",
    title: "Data Stays on Your Hardware",
    icon: Lock,
    content: "The definitive technological moat is the platform's commitment to absolute data sovereignty through local and air-gapped execution. By integrating with NVIDIA's NemoClaw architecture and the Ollama ecosystem, the entire suite of agents and models can be deployed on proprietary hardware. This results in zero variable API costs, predictable operational expenditures, and cryptographic certainty that no corporate data ever leaves the local network perimeter. NVIDIA's OpenShell runtime provides a secure, sandboxed execution environment specifically designed for autonomous agents.",
  },
  {
    id: "guardrails",
    title: "Infrastructure-Layer Governance",
    icon: Shield,
    content: "Operating autonomous agents that browse the internet, execute code, and send communications introduces massive cybersecurity attack surfaces. The platform employs a 5-layer enterprise-grade safety system powered by NVIDIA NeMo Guardrails: Jailbreak Detection blocks hostile subversion attempts. Topic Control enforces semantic boundaries. PII Scanning provides real-time redaction of sensitive data for GDPR/POPIA compliance. Hallucination Detection cross-checks outputs against verified enterprise data. Content Moderation filters toxicity, bias, and profanity across all 12 operational languages.",
  },
  {
    id: "whitelabel",
    title: "Democratizing Automation via White-Label",
    icon: Globe2,
    content: "Rather than solely targeting end-user corporations, the platform provides a fully realized white-label offering. Intermediary agencies can rebrand the dashboard, customize client portals, and mask the domain infrastructure as their own proprietary software. This strategy embeds the operating system deeply into thousands of downstream businesses, allowing a small agency to project the operational footprint of a multinational corporation — effectively creating a 'business-in-a-box' for AI-powered service delivery.",
  },
];

const METRICS = [
  { value: "124", label: "Specialized Agents" },
  { value: "65+", label: "Open-Source Models" },
  { value: "5", label: "Safety Layers" },
  { value: "12", label: "Languages Supported" },
  { value: "<200ms", label: "Voice Latency" },
  { value: "$0", label: "Per-Token Cost (Local)" },
];

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between max-w-4xl mx-auto px-6 py-8">
        <Link href="/" className="text-sm text-neutral-500 hover:text-white transition-colors flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <a
          href="/sovereign-matrix-whitepaper.pdf"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
          aria-label="Download whitepaper as PDF"
        >
          <Download className="w-3.5 h-3.5" /> Download PDF
        </a>
      </nav>

      {/* Header */}
      <header className="max-w-4xl mx-auto px-6 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-500/60 uppercase tracking-[0.3em] font-semibold">Whitepaper</p>
              <p className="text-[10px] text-neutral-600">March 2026 — v1.0</p>
            </div>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-6">
            Enterprise Autonomous AI and the Imperative of Data Sovereignty
          </h1>
          <p className="text-lg text-neutral-500 leading-relaxed max-w-3xl">
            A comprehensive analysis of how autonomous agentic workflows, localized execution, and multi-model intelligence are reshaping enterprise computing — and why data sovereignty is no longer optional.
          </p>
        </motion.div>

        {/* Metrics */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-12">
          {METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-center"
            >
              <div className="text-lg font-bold text-white">{m.value}</div>
              <div className="text-[9px] text-neutral-600 uppercase tracking-widest">{m.label}</div>
            </motion.div>
          ))}
        </div>
      </header>

      {/* Sections */}
      <div className="max-w-4xl mx-auto px-6 pb-24 space-y-12">
        {SECTIONS.map((section, i) => (
          <motion.section
            key={section.id}
            id={section.id}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <section.icon className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">{section.title}</h2>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed pl-11">{section.content}</p>
          </motion.section>
        ))}

        {/* CTA */}
        <div className="pt-12 border-t border-white/[0.06] text-center">
          <p className="text-neutral-500 mb-6">Ready to deploy sovereign AI?</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/onboarding" className="px-6 py-3 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-200 transition-colors">
              Get Started Free
            </Link>
            <Link href="/docs" className="px-6 py-3 border border-white/10 text-neutral-300 font-medium rounded-full text-sm hover:border-white/20 hover:text-white transition-colors">
              Read the API Docs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
