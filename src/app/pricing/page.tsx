"use client";

import { motion } from "framer-motion";
import { CheckCircle2, X as XIcon, ArrowRight, Shield, HelpCircle, Crown, GitCompareArrows, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { RevealText, GlowDivider, MagneticButton } from "@/components/ui/ScrollAnimations";

const fadeIn = (d: number) => ({ initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: d, duration: 0.6 } });

/* ─── Tier Data ─── */
const TIERS = [
  {
    name: "Founder Access", price: "Free", period: "forever", plan: "free", featured: false,
    tagline: "Full platform access. 50 runs/month. No credit card.",
    cta: "Run a Free Playbook",
    features: [
      { name: "All 130+ agents", included: true },
      { name: "25 playbook workflows", included: true },
      { name: "5-layer safety pipeline", included: true },
      { name: "50 runs/month", included: true },
      { name: "BYOK (Bring Your Own Key)", included: true },
      { name: "200+ runs/month", included: false },
      { name: "Priority support", included: false },
    ],
  },
  {
    name: "Starter", price: "$19", period: "/mo", plan: "starter", featured: false,
    tagline: "200 runs/month. Perfect for solo operators testing AI workflows.",
    cta: "Start for $19",
    features: [
      { name: "Everything in Free", included: true },
      { name: "200 runs/month", included: true },
      { name: "1,000 API calls/day", included: true },
      { name: "Email support", included: true },
      { name: "All 39+ models", included: true },
      { name: "Local execution", included: false },
      { name: "White-label", included: false },
    ],
  },
  {
    name: "Growth", price: "$49", period: "/mo", plan: "array", featured: true,
    tagline: "500 runs/month. For agencies and teams scaling AI workflows.",
    cta: "Scale with Growth",
    features: [
      { name: "Everything in Starter", included: true },
      { name: "500 runs/month", included: true },
      { name: "5,000 API calls/day", included: true },
      { name: "Multi-model consensus verification", included: true },
      { name: "Priority support (24h)", included: true },
      { name: "NVIDIA Nemotron Voice", included: true },
      { name: "White-label", included: false },
    ],
  },
  {
    name: "Sovereign Node", price: "$199", period: "/mo", plan: "node", featured: false,
    tagline: "2,000 runs/month + NemoClaw local execution. Replace your SDR.",
    cta: "Deploy Node",
    features: [
      { name: "Everything in Growth", included: true },
      { name: "2,000 runs/month", included: true },
      { name: "NemoClaw Local Execution", included: true },
      { name: "Apollo Ghost Fleet Targeting", included: true },
      { name: "10,000 API calls/day", included: true },
      { name: "Morpheus Shield", included: true },
      { name: "White-label", included: false },
    ],
  },
  {
    name: "Enterprise", price: "$499", period: "/mo", plan: "enterprise", featured: false,
    tagline: "10,000 runs/month. White-label. SLA. Dedicated onboarding.",
    cta: "Contact Sales",
    features: [
      { name: "Everything in Node", included: true },
      { name: "10,000 runs/month", included: true },
      { name: "Unlimited API calls", included: true },
      { name: "White-label Dashboard", included: true },
      { name: "Custom domain branding", included: true },
      { name: "Dedicated setup + SLA", included: true },
      { name: "Enterprise sub-licenses (5)", included: true },
    ],
  },
];

const FAQS = [
  { q: "What AI tools are included?", a: "Sovereign Matrix includes AI-powered tools for SEO analysis, content creation, design briefs, landing page generation, lead prospecting, competitor intelligence, and more. All powered by Google Gemini 2.5 Pro." },
  { q: "Do I need technical skills?", a: "No. The dashboard is designed for founders and operators, not coders. Select a tool, fill in your business name, and the AI generates production-ready marketing assets." },
  { q: "How is Sovereign Matrix different from GoHighLevel?", a: "GoHighLevel gives you empty templates and makes you do the work. Sovereign Matrix is an autonomous engine that generates the actual content, strategies, and creatives for you. It's the difference between buying a toolkit and hiring a 24/7 marketing team." },
  { q: "What are AI generations?", a: "Each time you use an AI tool (e.g., generate a blog post, analyze a competitor, create a landing page), that counts as one generation. Free users get 20/day, Pro and Agency get unlimited." },
  { q: "What is BYOK (Bring Your Own Key)?", a: "You can plug in your own API keys for Gemini, Anthropic, or Tavily. This means your generations use your own API quota, giving you full control over costs and usage." },
  { q: "Can I cancel anytime?", a: "Yes. No contracts, no cancellation fees. Monthly billing, cancel whenever you want." },
  { q: "What payment methods do you accept?", a: "We accept credit/debit cards, Instant EFT, Zapper, SnapScan, and bank transfers via PayFast. All payments in South African Rand (ZAR)." },
];

/* ─── Comparison Table Data ─── */
const COMPETITORS = [
  { name: "Sovereign Matrix", highlight: true },
  { name: "GoHighLevel", highlight: false },
  { name: "CrewAI", highlight: false },
  { name: "n8n", highlight: false },
  { name: "Lindy.ai", highlight: false },
];

type CellValue = string | boolean;

interface ComparisonRow {
  label: string;
  values: CellValue[];
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Monthly price (entry tier)", values: ["$19/mo", "$97/mo", "$99/mo", "$24/mo", "$20/mo"] },
  { label: "AI agents included", values: ["130+ agents", "0 AI agents", "Build your own", "AI nodes", "50+ templates"] },
  { label: "Models available", values: ["39+", "0", "5-10", "5-10", "3-5"] },
  { label: "Voice agents", values: [true, false, false, false, false] },
  { label: "White-label", values: [true, true, false, false, false] },
  { label: "Local execution", values: [true, false, true, true, false] },
  { label: "Workflow builder", values: [true, false, false, true, true] },
  { label: "Integrations", values: ["25+", "400+", "Python SDK", "400+", "5000+"] },
  { label: "Free tier", values: ["Yes (100 runs)", false, false, "Yes (limited)", "Yes (400 credits)"] },
];

function CellDisplay({ value }: { value: CellValue }) {
  if (typeof value === "boolean") {
    return value ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
    ) : (
      <XIcon className="w-4 h-4 text-neutral-500 mx-auto" aria-hidden="true" />
    );
  }
  return <span className="text-sm text-neutral-300">{value}</span>;
}

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (plan: string) => {
    if (plan === "free") {
      window.location.assign("/signup");
      return;
    }
    if (plan === "enterprise") {
      window.location.assign("mailto:hello@sovereignmatrix.agency?subject=Enterprise%20Inquiry");
      return;
    }

    try {
      const res = await fetch("/api/payments/yoco/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (res.ok && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      setError(data.error || "Payment is being set up. Please try again.");
    } catch {
      setError("Checkout failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white antialiased">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[200] px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 backdrop-blur-xl shadow-lg flex items-center gap-3"
          >
            <span className="text-xs font-medium text-white">{error}</span>
            <button onClick={() => setError(null)} className="text-neutral-500 hover:text-white">
              <XIcon className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-emerald-500/[0.04] rounded-full blur-[250px]" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[200px]" />
      </div>

      {/* ─── Navigation ─── */}
      <nav className="fixed top-6 inset-x-0 z-50 flex justify-center px-6 pointer-events-none">
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-full px-8 h-16 flex items-center justify-between gap-12 pointer-events-auto max-w-5xl w-full">
          <Link href="/" className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block text-sm font-bold tracking-[0.2em] uppercase text-white font-serif">
              Pricing
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="hidden md:block text-xs text-neutral-400 hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/for-agencies" className="hidden md:block text-xs text-neutral-400 hover:text-white transition-colors">
              Agencies
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main id="main-content">

      {/* ─── Comparison Hero ─── */}
      <section className="relative pt-40 pb-16 px-6 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-5xl mx-auto text-center"
        >
          <p
            className="mb-8"
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "11px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#8F8576",
            }}
          >
            Five tiers · Flat pricing · No per-token fees
          </p>

          <h1
            style={{
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: "clamp(3rem, 9vw, 7rem)",
              lineHeight: 0.9,
              letterSpacing: "-0.025em",
              fontWeight: 400,
              color: "#fff",
              marginBottom: "2rem",
            }}
          >
            Pick one price.{" "}
            <em style={{ fontStyle: "italic", color: "#B5532C" }}>Keep it.</em>
          </h1>

          <p
            className="max-w-2xl mx-auto text-neutral-400"
            style={{
              fontFamily: '"Inter Tight", system-ui, sans-serif',
              fontSize: "19px",
              lineHeight: 1.55,
              letterSpacing: "-0.011em",
            }}
          >
            No credit-based pricing. No per-token surprises. No vendor lock-in.
            One monthly number, every agent, every model — including{" "}
            <em
              style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic", color: "#fff" }}
            >
              Claude
            </em>{" "}
            and 38 others.
          </p>
        </motion.div>
      </section>

      <GlowDivider />

      {/* ─── Comparison Table ─── */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-4 font-serif">
            Feature-by-Feature Breakdown
          </RevealText>
          <RevealText as="p" className="text-neutral-500 text-center max-w-2xl mx-auto mb-16" delay={0.1}>
            Honest comparison. No hidden costs. See exactly what you get.
          </RevealText>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.01] backdrop-blur-xl"
          >
            <table className="w-full min-w-[800px] border-collapse">
              {/* Header */}
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs text-neutral-500 uppercase tracking-widest font-medium p-5 w-48" />
                  {COMPETITORS.map((c) => (
                    <th
                      key={c.name}
                      className={`text-center p-5 text-sm font-bold uppercase tracking-wider ${
                        c.highlight
                          ? "text-emerald-400 bg-emerald-500/[0.06] border-x-2 border-t-2 border-emerald-500/30"
                          : "text-neutral-400"
                      }`}
                    >
                      {c.highlight && (
                        <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-[0.2em] mb-1">
                          Recommended
                        </div>
                      )}
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <motion.tr
                    key={row.label}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05, duration: 0.4 }}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                      i % 2 === 0 ? "bg-white/[0.005]" : ""
                    }`}
                  >
                    <td className="p-5 text-sm text-neutral-300 font-medium">{row.label}</td>
                    {row.values.map((val, j) => (
                      <td
                        key={j}
                        className={`p-5 text-center ${
                          j === 0
                            ? "border-x-2 border-emerald-500/30 bg-emerald-500/[0.06]"
                            : ""
                        } ${i === COMPARISON_ROWS.length - 1 && j === 0 ? "border-b-2 border-emerald-500/30" : ""}`}
                      >
                        <CellDisplay value={val} />
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      <GlowDivider />

      {/* ─── Pricing Cards ─── */}
      <section className="relative z-10 px-8 py-20 max-w-5xl mx-auto">
        <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-4 font-serif">
          Scale Your Autonomous Swarm
        </RevealText>
        <RevealText as="p" className="text-neutral-500 text-center max-w-xl mx-auto mb-16" delay={0.1}>
          Deploy enterprise-grade NVIDIA execution pipelines. Replaces entire agency overheads.
        </RevealText>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {TIERS.map((t, i) => (
            <motion.div key={i} {...fadeIn(i * 0.1)}
              className={`rounded-2xl bg-white/[0.02] backdrop-blur-xl border p-7 flex flex-col ${t.featured ? "border-emerald-500/40 relative overflow-hidden scale-[1.02] shadow-[0_0_40px_rgba(16,185,129,0.1)]" : t.plan === "free" ? "border-cyan-500/30 relative overflow-hidden" : "border-white/[0.06]"}`}>
              {t.featured && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />}
              {t.plan === "free" && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />}
              {t.featured && <span className="inline-flex self-start items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase mb-3"><Crown className="w-2.5 h-2.5" /> Most Popular</span>}
              {t.plan === "free" && <span className="inline-flex self-start items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase mb-3"><Zap className="w-2.5 h-2.5" /> No Credit Card</span>}
              <p className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-1">{t.name}</p>
              <p className="text-4xl font-bold text-white mb-1">
                {t.price}
                {t.period !== "forever" && <span className="text-base text-neutral-500 font-normal">{t.period}</span>}
              </p>
              <p className="text-xs text-neutral-400 mb-6">{t.tagline}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {t.features.map((f, j) => (
                  <li key={j} className={`flex items-center gap-2 text-sm ${f.included ? "text-neutral-300" : "text-neutral-500"}`}>
                    {f.included ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" /> : <XIcon className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden="true" />}
                    {f.name}
                  </li>
                ))}
              </ul>
              <button onClick={() => checkout(t.plan)}
                className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                  t.featured
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-90 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    : t.plan === "free"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90"
                    : t.plan === "node"
                    ? "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                    : "border border-white/[0.06] text-white hover:bg-white/5"
                }`}>
                {t.cta} <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      <GlowDivider />

      {/* Guarantee */}
      <section className="relative z-10 px-8 pb-16 pt-20 text-center max-w-lg mx-auto">
        <motion.div {...fadeIn(0)} className="rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl p-8">
          <h3 className="text-lg font-bold mb-2">30-Day Money-Back Guarantee</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Try Sovereign Matrix for 30 days. If it doesn&apos;t work for you, we&apos;ll refund you — no questions asked.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider"><Shield className="w-3 h-3" /> SSL Secured</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider"><Shield className="w-3 h-3" /> PayFast Verified</span>
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 px-8 pb-20 max-w-2xl mx-auto">
        <motion.div {...fadeIn(0)} className="text-center mb-10">
          <h2 className="text-2xl font-bold mb-2 font-serif">Frequently Asked Questions</h2>
          <p className="text-sm text-neutral-400">Everything you need to know.</p>
        </motion.div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <motion.div key={i} {...fadeIn(i * 0.05)} className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors">
                <span className="text-sm font-medium text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-neutral-500 shrink-0" />
                  {faq.q}
                </span>
                <span className={`text-neutral-500 transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
              </button>
              {openFaq === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-6 pb-4">
                  <p className="text-sm text-neutral-400 leading-relaxed pl-6">{faq.a}</p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      <GlowDivider />

      {/* ─── Final CTA ─── */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <RevealText as="h2" className="text-3xl md:text-5xl font-bold mb-6 font-serif">
            Start Free — No Credit Card
          </RevealText>
          <RevealText as="p" className="text-neutral-500 mb-10 max-w-xl mx-auto" delay={0.1}>
            100 free runs. 130+ agents. Zero commitment. See what autonomous AI can do for your business.
          </RevealText>
          <MagneticButton>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold uppercase tracking-widest hover:from-emerald-600 hover:to-teal-600 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            >
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
          </MagneticButton>
        </div>
      </section>

      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <span className="text-xs text-neutral-500">
              Sovereign Matrix &mdash; AI Marketing Platform
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-neutral-500">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/for-agencies" className="hover:text-white transition-colors">Agencies</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
