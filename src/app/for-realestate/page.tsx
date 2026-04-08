"use client";

import { motion } from "framer-motion";
import { ArrowRight, Home, PenLine, PhoneCall, TrendingUp, Shield, Database, Layers, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: Home,
    title: "Property analysis & comparables",
    desc: "Feed in an address and get instant comp analysis, price history, neighborhood trends, and investment scoring. Agents pull from MLS data, county records, and market feeds in real time.",
    color: "amber",
  },
  {
    icon: PenLine,
    title: "Listing generation",
    desc: "Describe the property once and agents produce MLS-ready descriptions, social media posts, email blasts, and virtual tour scripts — all optimized for your target buyer persona.",
    color: "cyan",
  },
  {
    icon: PhoneCall,
    title: "Lead qualification (voice + email)",
    desc: "Voice agents answer calls 24/7, qualify buyers by budget and timeline, book showings, and log everything to your CRM. Email agents nurture cold leads with personalized follow-up sequences.",
    color: "emerald",
  },
  {
    icon: TrendingUp,
    title: "Market trend analysis",
    desc: "Weekly market intelligence reports for your target areas — price movements, inventory shifts, days-on-market trends, and emerging neighborhoods. Data-driven advice for your clients.",
    color: "violet",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Find 30 buyers looking for 3-bed homes in Austin under $500K\"",
    steps: [
      "Agent scans your CRM and lead database for matching buyer profiles",
      "Cross-references search criteria with active and recently saved searches",
      "Scores each lead by engagement level, pre-approval status, and timeline urgency",
      "Generates a prioritized contact list with recommended outreach approach per lead",
    ],
    result: "30 qualified buyer leads ranked by likelihood to transact, with personalized talking points.",
  },
  {
    trigger: "\"Write listing descriptions for my 5 new properties\"",
    steps: [
      "Pulls property details, photos, and features from your MLS entries",
      "Generates unique, compelling descriptions highlighting each property\u0027s best features",
      "Optimizes for local SEO keywords and buyer search patterns",
      "Produces social media versions (Instagram, Facebook, LinkedIn) for each listing",
    ],
    result: "5 MLS-ready listings plus 15 social media posts — written in your brand voice.",
  },
  {
    trigger: "\"Call all leads from this week\u0027s open house and book follow-ups\"",
    steps: [
      "Retrieves sign-in sheet data from the open house (42 attendees)",
      "Voice agent calls each lead with a personalized follow-up referencing the property",
      "Qualifies interest level, budget range, and timeline in the conversation",
      "Books follow-up showings for interested buyers directly on your calendar",
    ],
    result: "42 calls made, 18 follow-up showings booked, 7 pre-approvals requested — by noon.",
  },
];

export default function ForRealEstatePage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      {/* Nav */}
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">Sovereign Matrix</Link>
        <Link href="/signup" className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors">
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.06] mb-6"
          >
            <Home className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-[0.2em]">Real Estate</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            AI agents for<br />
            <span className="text-amber-400">real estate.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            Find buyers. Qualify leads. Generate listings. Voice agents book showings 24/7.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Deploy real estate agents <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Close more deals. Work fewer hours.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Every lead followed up. Every listing polished. Every showing booked.
              Your AI team never sleeps, never forgets, never drops the ball.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {CAPABILITIES.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`p-6 rounded-2xl border bg-[#080808] transition-all hover:border-${cap.color}-500/20 border-white/[0.05]`}
              >
                <div className={`w-10 h-10 rounded-xl bg-${cap.color}-500/10 flex items-center justify-center mb-4`}>
                  <cap.icon className={`w-5 h-5 text-${cap.color}-400`} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow examples */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">How It Works</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Say what you need. Watch it happen.
            </h2>
          </div>

          <div className="space-y-8">
            {WORKFLOWS.map((flow, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-white/[0.06] bg-[#080808] overflow-hidden"
              >
                {/* Trigger */}
                <div className="px-6 py-4 border-b border-white/[0.04] bg-[#060606]">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] text-amber-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>

                {/* Steps */}
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-amber-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div className="px-6 py-4 border-t border-white/[0.04] bg-amber-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">{flow.result}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-16 px-6 border-y border-white/[0.03] bg-[#030303]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">Under The Hood</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built on real infrastructure.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Pinecone", desc: "Vector memory — semantic search across listings, leads, and market data" },
              { icon: Layers, label: "Neon Postgres", desc: "Tenant-scoped relational store — brokerage-level data isolation" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Every output verified for accuracy, compliance, and quality" },
              { icon: Zap, label: "Ollama Local", desc: "Air-gapped mode — client data stays on your infrastructure" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-amber-400 mb-3" />
                <div className="text-xs font-semibold text-white mb-0.5">{item.label}</div>
                <p className="text-[10px] text-neutral-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Stop chasing leads manually.<br />
            <span className="text-amber-400">Start closing faster.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Every lead gets followed up. Every listing gets polished. Every showing gets booked.
            Your AI team works while you&apos;re at the closing table.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
