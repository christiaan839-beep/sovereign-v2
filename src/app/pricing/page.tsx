"use client";

import { motion } from "framer-motion";
import { CheckCircle2, X as XIcon, ArrowRight, Shield, HelpCircle, Crown, Zap, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { RevealText, GlowDivider, MagneticButton } from "@/components/ui/ScrollAnimations";
import { getMarketingPlans, PLANS, type PlanId } from "@/lib/plans";

const fadeIn = (d: number) => ({ initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: d, duration: 0.6 } });

/* ─── Tier Data ───
 * TIERS below carry marketing copy (feature lists, CTAs, taglines) —
 * that's UI copy, not plan schema. But every tier's `plan` field
 * MUST correspond to a PlanId in src/lib/plans.ts with `marketing: true`.
 *
 * The dev-time assertion below logs a warning if we ever drift:
 * e.g., if a new plan gets `marketing: true` in plans.ts but we
 * forget to add its TIERS entry, or vice versa. Catches the whole
 * class of "pricing-page-out-of-sync" bugs in development.
 */
const TIERS = [
  {
    name: "Founder Access", price: "Free", period: "forever", plan: "free", featured: false,
    tagline: "Full platform access. 50 runs/month. No credit card.",
    cta: "Run a Free Playbook",
    features: [
      { name: "All 198 agents", included: true },
      { name: "25 playbook workflows", included: true },
      { name: "5-layer safety pipeline", included: true },
      { name: "50 runs/month", included: true },
      { name: "BYOK (Bring Your Own Key)", included: true },
      { name: "A2E credits: 0/mo", included: false },
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
      { name: "A2E credits: 50/mo", included: true },
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
      { name: "A2E credits: 200/mo", included: true },
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
      { name: "A2E credits: 1,000/mo", included: true },
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
      { name: "A2E credits: Unlimited", included: true },
      { name: "Dedicated setup + SLA", included: true },
      { name: "Enterprise sub-licenses (5)", included: true },
    ],
  },
  {
    name: "Pay Per Run",
    price: "$0",
    period: " + credits",
    plan: "pay_per_run",
    featured: false,
    tagline: "No monthly fee. Top up credits — every run shows its cost.",
    cta: "Load $20 credits",
    features: [
      { name: "Runs cost $0.01 – $0.50 each", included: true },
      { name: "Credits never expire", included: true },
      { name: "5,000 API calls/day", included: true },
      { name: "All 198 agents + 39 models", included: true },
      { name: "No subscription to cancel", included: true },
      { name: "No monthly included runs", included: false },
    ],
  },
];

const FAQS = [
  { q: "What AI tools are included?", a: "198 autonomous agents across lead generation, content creation, SEO, competitor intelligence, voice calls, and code review. Every agent routes to the best of 39+ models (Claude Sonnet 4.6 for reasoning, Nemotron Ultra for throughput, Gemini 3.1 Pro for grounded search, and more) via our smart-router." },
  { q: "Do I need technical skills?", a: "No. The dashboard is designed for founders and operators. Pick a playbook, fill in the inputs, and the agents execute. For engineers, there's also a REST + streaming API and an SDK." },
  { q: "Do I have to build the agents myself?", a: "No. Sovereign Matrix ships 198 production agents and 25 multi-agent playbooks out of the box. Pick one, give it inputs, run. You can also compose custom playbooks via the workflow builder when you want something bespoke." },
  { q: "What counts as a 'run'?", a: "One playbook execution = one run. A playbook can chain multiple agents internally (a lead-blitz playbook might run 5 agents), but we count it as one run. Free tier: 50 runs/mo. Starter $19: 200/mo. Growth $49: 500/mo. Node $199: 2,000/mo. Enterprise $499: 10,000/mo." },
  { q: "What is BYOK (Bring Your Own Key)?", a: "You can plug in your own API keys for Claude, Gemini, NVIDIA NIM, Groq, or Tavily. BYOK runs against your own quota, so you have full control over costs and model access." },
  { q: "Can I cancel anytime?", a: "Yes. No contracts, no cancellation fees. Monthly billing via Stripe — cancel whenever you want from Settings → Billing." },
  { q: "What payment methods do you accept?", a: "Credit and debit cards via Stripe. All prices shown in USD. Enterprise invoicing available on request." },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Dev-only sanity check — warn if the pricing UI drifts from
  // the plan registry's `marketing: true` set. Runs once on mount.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const marketingPlanIds = getMarketingPlans().map((p) => p.id as string);
    const tierPlanIds = TIERS.map((t) => t.plan);
    const onlyInTiers = tierPlanIds.filter((id) => !marketingPlanIds.includes(id));
    const onlyInMarketing = marketingPlanIds.filter((id) => !tierPlanIds.includes(id));
    if (onlyInTiers.length > 0 || onlyInMarketing.length > 0) {
       
      console.warn(
        "[pricing] TIERS ⇄ PLANS drift detected:",
        { onlyInTiers, onlyInMarketing, hint: "Sync src/lib/plans.ts marketing flag with pricing page TIERS." },
      );
    }
    for (const t of TIERS) {
      if (!PLANS[t.plan as PlanId]) {
         
        console.error(`[pricing] Unknown plan id in TIERS: "${t.plan}"`);
      }
    }
  }, []);

  const checkout = async (plan: string) => {
    if (plan === "free") {
      window.location.assign("/signup");
      return;
    }
    if (plan === "enterprise") {
      window.location.assign("mailto:hello@sovereignmatrix.agency?subject=Enterprise%20Inquiry");
      return;
    }

    setLoadingPlan(plan);
    setError(null);

    try {
      // Prefer Stripe — it returns { url } on success, { error } on fail, 503 if not configured
      const stripeRes = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const stripeData = await stripeRes.json();

      if (stripeRes.ok && stripeData.url) {
        window.location.assign(stripeData.url);
        return;
      }

      // Stripe not yet configured — fall back to Yoco (ZAR market)
      if (stripeRes.status === 503) {
        const yocoRes = await fetch("/api/payments/yoco/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const yocoData = await yocoRes.json();
        if (yocoRes.ok && yocoData.redirectUrl) {
          window.location.assign(yocoData.redirectUrl);
          return;
        }
        setError(yocoData.error || "Payment gateway is being set up. Try again in a moment.");
      } else {
        setError(stripeData.error || "Checkout failed. Please try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoadingPlan(null);
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

      {/* Background ambience — copper only */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-[280px]"
          style={{ background: "rgba(181,83,44,0.045)" }} />
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[400px] rounded-full blur-[220px]"
          style={{ background: "rgba(181,83,44,0.025)" }} />
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

      {/* ─── Pricing Cards ─── */}
      <section className="relative z-10 px-8 py-20 max-w-5xl mx-auto">
        <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-4 font-serif">
          Scale Your Autonomous Swarm
        </RevealText>
        <RevealText as="p" className="text-neutral-500 text-center max-w-xl mx-auto mb-16" delay={0.1}>
          Deploy enterprise-grade NVIDIA execution pipelines. Replaces entire agency overheads.
        </RevealText>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {TIERS.map((t, i) => {
            const isLoading = loadingPlan === t.plan;
            return (
              <motion.div key={i} {...fadeIn(i * 0.1)}
                className={`rounded-2xl bg-white/[0.02] backdrop-blur-xl border p-7 flex flex-col relative overflow-hidden ${
                  t.featured
                    ? "scale-[1.02]"
                    : ""
                }`}
                style={t.featured ? {
                  borderColor: "rgba(181,83,44,0.45)",
                  boxShadow: "0 0 40px rgba(181,83,44,0.10)",
                } : t.plan === "free" ? {
                  borderColor: "rgba(181,83,44,0.25)",
                } : {
                  borderColor: "rgba(255,255,255,0.06)",
                }}
              >
                {/* Top accent line */}
                {(t.featured || t.plan === "free") && (
                  <div className="absolute top-0 left-0 right-0 h-[1.5px]"
                    style={{ background: t.featured
                      ? "linear-gradient(to right, rgba(181,83,44,0.8), rgba(224,133,88,0.6))"
                      : "linear-gradient(to right, rgba(181,83,44,0.4), rgba(181,83,44,0.15))"
                    }} />
                )}

                {/* Plan badge */}
                {t.featured && (
                  <span className="inline-flex self-start items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mb-3"
                    style={{ background: "rgba(181,83,44,0.12)", border: "1px solid rgba(181,83,44,0.25)", color: "#E08558" }}>
                    <Crown className="w-2.5 h-2.5" /> Most Popular
                  </span>
                )}
                {t.plan === "free" && (
                  <span className="inline-flex self-start items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mb-3"
                    style={{ background: "rgba(181,83,44,0.08)", border: "1px solid rgba(181,83,44,0.18)", color: "#B5532C" }}>
                    <Zap className="w-2.5 h-2.5" /> No Credit Card
                  </span>
                )}

                <p className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-1">{t.name}</p>
                <p className="text-4xl font-bold text-white mb-1">
                  {t.price}
                  {t.period !== "forever" && <span className="text-base text-neutral-500 font-normal">{t.period}</span>}
                </p>
                <p className="text-xs text-neutral-400 mb-6">{t.tagline}</p>

                <ul className="space-y-2 mb-6 flex-1">
                  {t.features.map((f, j) => (
                    <li key={j} className={`flex items-center gap-2 text-sm ${f.included ? "text-neutral-300" : "text-neutral-600"}`}>
                      {f.included
                        ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#B5532C" }} aria-hidden="true" />
                        : <XIcon className="w-4 h-4 text-neutral-700 shrink-0" aria-hidden="true" />}
                      {f.name}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => checkout(t.plan)}
                  disabled={isLoading}
                  className="w-full py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={t.featured ? {
                    background: "linear-gradient(135deg, #B5532C 0%, #E08558 100%)",
                    color: "#fff",
                    boxShadow: "0 0 20px rgba(181,83,44,0.25)",
                  } : t.plan === "free" ? {
                    background: "rgba(181,83,44,0.15)",
                    border: "1px solid rgba(181,83,44,0.3)",
                    color: "#E08558",
                  } : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                  }}
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
                    : <>{t.cta} <ArrowRight className="w-4 h-4" /></>}
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>

      <GlowDivider />

      {/* Guarantee */}
      <section className="relative z-10 px-8 pb-16 pt-20 text-center max-w-lg mx-auto">
        <motion.div {...fadeIn(0)} className="rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl p-8">
          <h3 className="text-lg font-bold mb-2">14-Day Unconditional Refund</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            If Sovereign Matrix isn&apos;t working for you within 14 days of your first paid invoice,
            email <a href="mailto:refunds@sovereignmatrix.agency" style={{ color: "#B5532C" }} className="underline">refunds@sovereignmatrix.agency</a>.
            One email, full refund, no outcome conditions. See <a href="/terms" style={{ color: "#B5532C" }} className="underline">terms</a> for the fine print.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#B5532C" }}><Shield className="w-3 h-3" /> Stripe Secured</span>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#B5532C" }}><Shield className="w-3 h-3" /> Cancel Anytime</span>
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
            50 free runs. 198 agents. Zero commitment. See what autonomous AI can do for your business.
          </RevealText>
          <MagneticButton>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full text-white text-sm font-bold uppercase tracking-widest transition-all"
              style={{
                background: "linear-gradient(135deg, #B5532C 0%, #E08558 100%)",
                boxShadow: "0 0 30px rgba(181,83,44,0.30)",
              }}
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
