"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  X as XIcon,
  ArrowRight,
  Shield,
  HelpCircle,
  Crown,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import {
  RevealText,
  GlowDivider,
  MagneticButton,
} from "@/components/ui/ScrollAnimations";
import {
  getMarketingPlans,
  slaUptimePercent,
  PLANS,
  type PlanId,
} from "@/lib/plans";

const fadeIn = (d: number) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { delay: d, duration: 0.6 },
});

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
// Public marketing tiers — simplified to 3 visible cards.
// plans.ts still defines all 6 internal PlanIds for backward compat
// with existing customers on legacy plans (Starter $19, Node $199).
// Those legacy plans are accessible via a "More plans" link below the
// main cards — not removed, just deemphasized for new visitors.
//
// Decision-fatigue research: every additional pricing card reduces
// conversion. The Stripe/Linear/Vercel pattern is 3 visible + 1
// Enterprise CTA. This matches.
const TIERS = [
  {
    name: "Free",
    price: "Free",
    priceZar: "Free",
    period: "forever",
    plan: "free",
    featured: false,
    tagline: "50 verified agent runs / month. No credit card.",
    cta: "Start free",
    features: [
      { name: "All 140 agents + 25 playbooks", included: true },
      { name: "5-layer safety pipeline (default-on)", included: true },
      { name: "50 verified agent runs / month", included: true },
      { name: "HMAC-signed receipts (VAOS 1.0)", included: true },
      { name: "BYOK (Bring Your Own Key)", included: true },
      { name: "Public verifier API", included: true },
      { name: "Priority support", included: false },
    ],
  },
  {
    name: "Pro",
    price: "R997",
    priceUsd: "$49",
    period: "/mo",
    plan: "array",
    featured: true,
    tagline:
      "For solo operators and small teams shipping AI in regulated industries.",
    cta: "Get Pro",
    features: [
      { name: "Everything in Free", included: true },
      { name: "500 verified runs / month", included: true },
      { name: "Ed25519 v2 signatures (non-repudiation)", included: true },
      { name: "Audit-bundle export (signed evidence pack)", included: true },
      { name: "Merkle inclusion proofs (O(log N) verify)", included: true },
      { name: "Priority support (24h)", included: true },
      { name: "Custom domain for verify badge", included: false },
    ],
  },
  {
    name: "Team",
    price: "R3,997",
    priceUsd: "$199",
    period: "/mo",
    plan: "node",
    featured: false,
    tagline:
      "For compliance-led teams. White-label, dedicated key rotation, audit-firm partnership.",
    cta: "Get Team",
    features: [
      { name: "Everything in Pro", included: true },
      { name: "2,000 verified runs / month", included: true },
      { name: "White-label dashboard + badge", included: true },
      { name: "Bitcoin notarization (OpenTimestamps)", included: true },
      { name: "Custom signing-key rotation (90-day SLA)", included: true },
      { name: "SOC2-ready evidence export", included: true },
      { name: "Dedicated success manager", included: true },
    ],
  },
];

/**
 * Legacy plans (Starter $19, Sovereign Node high-volume) remain
 * configured in plans.ts and Stripe — existing subscribers stay on
 * them. New visitors see the simplified 3-tier card grid above and
 * the Enterprise strip below.
 */

/* ─── Enterprise strip ───
 * Enterprise is the highest self-serve tier: `purchasable: true` in
 * plans.ts against STRIPE_PRICE_ENTERPRISE, so it takes a card through
 * the same checkout() path as Pro and Team. It renders as a full-width
 * strip instead of a fourth card — a 4-up grid squashes the feature
 * lists at the lg breakpoint, and Enterprise is a different kind of
 * purchase (a signed SLA, a DPA, procurement review) that needs the room.
 *
 * Every number and entitlement below is read from the plan registry —
 * only the phrasing is copy, so a flag flipped in plans.ts flips the
 * row here rather than leaving the card advertising something we no
 * longer ship.
 */
const ENTERPRISE_PLAN = PLANS.enterprise;
const ENTERPRISE_SLA = slaUptimePercent("enterprise");
const SOVEREIGN_SLA = slaUptimePercent("sovereign");

const ENTERPRISE_FEATURES = [
  { name: "Everything in Team", included: true },
  {
    name: `${ENTERPRISE_PLAN.runsPerMonth.toLocaleString("en-US")} verified runs / month`,
    included: true,
  },
  {
    name: "Audit-log export (webhook + S3 sink)",
    included: ENTERPRISE_PLAN.enterprise.auditLogExport,
  },
  {
    name: "White-label dashboard on your domain",
    included: ENTERPRISE_PLAN.enterprise.whiteLabel,
  },
  {
    name: `${ENTERPRISE_SLA ?? "Best-effort"} uptime SLA with service credits`,
    included: !!ENTERPRISE_SLA,
  },
  {
    name: "Dedicated Slack channel + named CSM",
    included: ENTERPRISE_PLAN.enterprise.dedicatedSupport,
  },
  {
    name: "BYOK encryption keys (KMS / HSM)",
    included: ENTERPRISE_PLAN.enterprise.byok,
  },
];

const FAQS = [
  {
    q: "What AI tools are included?",
    a: "140 autonomous agents across lead generation, content creation, SEO, competitor intelligence, voice calls, and code review. Every agent routes to the best of 39+ models (Claude Sonnet 4.6 for reasoning, Nemotron Ultra for throughput, Gemini 3.1 Pro for grounded search, and more) via our smart-router.",
  },
  {
    q: "Do I need technical skills?",
    a: "No. The dashboard is designed for founders and operators. Pick a playbook, fill in the inputs, and the agents execute. For engineers, there's also a REST + streaming API and an SDK.",
  },
  {
    q: "Do I have to build the agents myself?",
    a: "No. Sovereign Matrix ships 140 production agents and 25 multi-agent playbooks out of the box. Pick one, give it inputs, run. You can also compose custom playbooks via the workflow builder when you want something bespoke.",
  },
  {
    q: "What counts as a 'run'?",
    a: "One playbook execution = one run. A playbook can chain multiple agents internally (a lead-blitz playbook might run 5 agents), but we count it as one run. Free: 50 runs/mo. Pro $49: 500/mo. Team $199: 2,000/mo. Enterprise $499: 10,000/mo. Sovereign (contract tier): custom.",
  },
  {
    q: "What is BYOK (Bring Your Own Key)?",
    a: "You can plug in your own API keys for Claude, Gemini, NVIDIA NIM, Groq, or Tavily. BYOK runs against your own quota, so you have full control over costs and model access.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no cancellation fees. Monthly billing via Stripe — cancel whenever you want from Settings → Billing.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Credit and debit cards via Stripe. All prices shown in USD. Enterprise invoicing available on request.",
  },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dev-only sanity check — warn if the pricing UI drifts from
  // the plan registry's `marketing: true` set. Runs once on mount.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const marketingPlanIds = getMarketingPlans().map(
      // @ts-expect-error — PlanDefinition uses `tier` not `id`; this dev-only check tolerates either
      (p) => (p.id ?? p.tier) as string,
    );
    const tierPlanIds = TIERS.map((t) => t.plan);
    const onlyInTiers = tierPlanIds.filter(
      (id) => !marketingPlanIds.includes(id),
    );
    const onlyInMarketing = marketingPlanIds.filter(
      (id) => !tierPlanIds.includes(id),
    );
    if (onlyInTiers.length > 0 || onlyInMarketing.length > 0) {
      console.warn("[pricing] TIERS ⇄ PLANS drift detected:", {
        onlyInTiers,
        onlyInMarketing,
        hint: "Sync src/lib/plans.ts marketing flag with pricing page TIERS.",
      });
    }
    // Also validate each TIER's plan actually exists in PLANS
    for (const t of TIERS) {
      if (!PLANS[t.plan as PlanId]) {
        console.error(`[pricing] Unknown plan id in TIERS: "${t.plan}"`);
      }
    }
  }, []);

  const checkout = async (plan: string, method: "card" | "crypto" = "card") => {
    if (plan === "free") {
      window.location.assign("/signup");
      return;
    }
    // Contract tiers (Sovereign) are price-on-application — there is no
    // Stripe price to charge, so they route to /sales instead of
    // checkout. Enterprise is `purchasable: true` and falls through to
    // the card path below like every other paid tier.
    if (!PLANS[plan as PlanId]?.purchasable) {
      window.location.assign("/sales");
      return;
    }

    // Crypto path — Coinbase Commerce hosted checkout. Pays once for
    // 30 days of access; the webhook stamps the period end.
    if (method === "crypto") {
      try {
        const res = await fetch("/api/payments/crypto/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const data = await res.json();
        if (res.ok && data.url) {
          window.location.assign(data.url);
          return;
        }
        setError(
          data.error || "Crypto checkout unavailable. Try card instead.",
        );
      } catch {
        setError("Crypto checkout failed. Please try again.");
      }
      return;
    }

    // Card path — Stripe first (USD/global), Yoco fallback (ZAR/SA).
    try {
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

      setError(
        stripeData.error ||
          yocoData.error ||
          "Payment is being set up. Please try again.",
      );
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
            <button
              onClick={() => setError(null)}
              className="text-neutral-500 hover:text-white"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background ambience — on-brand cyan + copper only.
          Audit-2026-05: dropped the emerald/teal/purple blurs that
          violated the dual-accent rule and made pricing look like a
          different product. */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-cyan-500/[0.035] rounded-full blur-[250px]" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-[#B5532C]/[0.04] rounded-full blur-[200px]" />
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
            <Link
              href="/"
              className="hidden md:block text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Home
            </Link>
            <Link
              href="/for-agencies"
              className="hidden md:block text-xs text-neutral-400 hover:text-white transition-colors"
            >
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
              Four tiers · Flat pricing · No per-token fees
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
              <em style={{ fontStyle: "italic", color: "#B5532C" }}>
                Keep it.
              </em>
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
              No credit-based pricing. No per-token surprises. No vendor
              lock-in. One monthly number, every agent, every model — including{" "}
              <em
                style={{
                  fontFamily: '"Instrument Serif", serif',
                  fontStyle: "italic",
                  color: "#fff",
                }}
              >
                Claude
              </em>{" "}
              and 38 others.
            </p>
          </motion.div>
        </section>

        <GlowDivider />

        {/* ─── Vertical matcher — "find your tier in 5 seconds" ─── */}
        <VerticalMatcher />

        <GlowDivider />

        {/* ─── Pricing Cards ─── */}
        <section className="relative z-10 px-8 py-20 max-w-5xl mx-auto">
          <RevealText
            as="h2"
            className="text-3xl md:text-4xl font-bold text-center mb-4 font-serif"
          >
            Scale Your Autonomous Swarm
          </RevealText>
          <RevealText
            as="p"
            className="text-neutral-500 text-center max-w-xl mx-auto mb-16"
            delay={0.1}
          >
            One number per month. Every agent. Every model. Receipts on every
            output.
          </RevealText>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TIERS.map((t, i) => (
              <motion.div
                key={i}
                {...fadeIn(i * 0.1)}
                className={`rounded-2xl bg-white/[0.02] backdrop-blur-xl border p-7 flex flex-col ${t.featured ? "border-[#B5532C]/40 relative overflow-hidden scale-[1.02] shadow-[0_0_40px_rgba(181,83,44,0.10)]" : t.plan === "free" ? "border-cyan-500/30 relative overflow-hidden" : "border-white/[0.06]"}`}
              >
                {t.featured && (
                  <div
                    aria-hidden="true"
                    className="absolute top-0 left-0 right-0 h-px bg-[#B5532C]/60"
                  />
                )}
                {t.plan === "free" && (
                  <div
                    aria-hidden="true"
                    className="absolute top-0 left-0 right-0 h-px bg-cyan-500/60"
                  />
                )}
                {t.featured && (
                  <span className="inline-flex self-start items-center gap-1 px-2 py-0.5 rounded-full bg-[#B5532C]/10 border border-[#B5532C]/25 text-[#E08558] text-[10px] font-mono uppercase tracking-[0.15em] mb-3">
                    <Crown className="w-2.5 h-2.5" /> Most popular
                  </span>
                )}
                {t.plan === "free" && (
                  <span className="inline-flex self-start items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-mono uppercase tracking-[0.15em] mb-3">
                    <Zap className="w-2.5 h-2.5" /> No credit card
                  </span>
                )}
                <p className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-1">
                  {t.name}
                </p>
                <p className="text-4xl font-bold text-white mb-1">
                  {t.price}
                  {t.period !== "forever" && (
                    <span className="text-base text-neutral-500 font-normal">
                      {t.period}
                    </span>
                  )}
                </p>
                {"priceUsd" in t && t.priceUsd ? (
                  <p className="text-[11px] font-mono text-neutral-500 mb-3">
                    ≈ {t.priceUsd}
                    {t.period}
                  </p>
                ) : (
                  <div className="mb-3" />
                )}
                <p className="text-xs text-neutral-400 mb-6">{t.tagline}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {t.features.map((f, j) => (
                    <li
                      key={j}
                      className={`flex items-center gap-2 text-sm ${f.included ? "text-neutral-300" : "text-neutral-500"}`}
                    >
                      {f.included ? (
                        <CheckCircle2
                          className="w-4 h-4 text-cyan-400/80 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <XIcon
                          className="w-4 h-4 text-neutral-500 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      {f.name}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => checkout(t.plan)}
                  className={`w-full py-3 font-medium rounded-[3px] transition-colors flex items-center justify-center gap-2 ${
                    t.featured
                      ? "bg-[#B5532C] text-white hover:bg-[#C96234]"
                      : t.plan === "free"
                        ? "bg-white/5 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                        : t.plan === "node"
                          ? "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                          : "border border-white/[0.06] text-white hover:bg-white/5"
                  }`}
                >
                  {t.cta} <ArrowRight className="w-4 h-4" />
                </button>
                {/* Crypto CTA hidden — centralized-only checkout for now.
                    Backend (Coinbase Commerce + self-custody path) stays
                    wired in `/api/payments/crypto/*` so flipping
                    NEXT_PUBLIC_CRYPTO_PAYMENTS_ENABLED=true re-enables
                    this affordance without a redeploy of the routes. */}
                {t.plan !== "free" &&
                  t.plan !== "enterprise" &&
                  process.env.NEXT_PUBLIC_CRYPTO_PAYMENTS_ENABLED ===
                    "true" && (
                    <button
                      onClick={() => checkout(t.plan, "crypto")}
                      className="mt-2 w-full py-2 text-xs font-medium rounded-lg border border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:text-white hover:bg-white/5 hover:border-white/10 transition-colors"
                      aria-label={`Pay for ${t.name} with crypto`}
                    >
                      or pay with crypto (BTC · ETH · USDC)
                    </button>
                  )}
              </motion.div>
            ))}
          </div>

          {/* Enterprise — self-serve, same checkout path, wider strip. */}
          <motion.div
            {...fadeIn(0.3)}
            className="mt-4 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-cyan-500/25 p-7 relative overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="absolute top-0 left-0 right-0 h-px bg-cyan-500/60"
            />
            <div className="flex flex-col lg:flex-row lg:items-start gap-8">
              <div className="lg:w-[30%] shrink-0">
                <span className="inline-flex self-start items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-mono uppercase tracking-[0.15em] mb-3">
                  <Shield className="w-2.5 h-2.5" /> Procurement-ready
                </span>
                <p className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-1">
                  {ENTERPRISE_PLAN.name}
                </p>
                <p className="text-4xl font-bold text-white mb-1">
                  {ENTERPRISE_PLAN.priceDisplayUsd}
                </p>
                <p className="text-[11px] font-mono text-neutral-500 mb-3">
                  billed in USD · invoicing on request
                </p>
                <p className="text-xs text-neutral-400">
                  For regulated teams whose security review comes before their
                  first run. Card checkout, no sales call required.
                </p>
              </div>
              <ul className="flex-1 grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {ENTERPRISE_FEATURES.map((f, j) => (
                  <li
                    key={j}
                    className={`flex items-center gap-2 text-sm ${f.included ? "text-neutral-300" : "text-neutral-500"}`}
                  >
                    {f.included ? (
                      <CheckCircle2
                        className="w-4 h-4 text-cyan-400/80 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <XIcon
                        className="w-4 h-4 text-neutral-500 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {f.name}
                  </li>
                ))}
              </ul>
              <div className="lg:w-[220px] shrink-0">
                <button
                  onClick={() => checkout("enterprise")}
                  className="w-full py-3 font-medium rounded-[3px] transition-colors flex items-center justify-center gap-2 bg-white/5 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                >
                  Get Enterprise <ArrowRight className="w-4 h-4" />
                </button>
                <p className="mt-3 text-[11px] text-neutral-500 leading-relaxed">
                  DPA, sub-processor list and SBOM are published up front on{" "}
                  <Link
                    href="/trust"
                    className="text-cyan-300 underline underline-offset-4 decoration-cyan-500/40 hover:decoration-cyan-400"
                  >
                    /trust
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* Sovereign is price-on-application (`purchasable: false`) —
                a link to /sales, never a checkout button, never a price. */}
            <div className="mt-7 pt-5 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-neutral-400">
                Need BYOK encryption keys, a named architect or a{" "}
                {SOVEREIGN_SLA ?? "custom"} SLA?{" "}
                <span className="text-neutral-500">
                  Sovereign is a contract tier, priced on application.
                </span>
              </p>
              <Link
                href="/sales"
                className="inline-flex items-center justify-center gap-2 shrink-0 px-5 py-2.5 rounded-[3px] border border-white/[0.06] text-xs font-medium text-white hover:bg-white/5 transition-colors"
              >
                Talk to sales <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </section>

        <GlowDivider />

        {/* Guarantee */}
        <section className="relative z-10 px-8 pb-16 pt-20 text-center max-w-lg mx-auto">
          <motion.div
            {...fadeIn(0)}
            className="rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl p-8"
          >
            <h3 className="text-lg font-bold mb-2">
              14-Day Unconditional Refund
            </h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              If Sovereign Matrix isn&apos;t working for you within 14 days of
              your first paid invoice, email{" "}
              <a
                href="mailto:refunds@sovereignmatrix.agency"
                className="text-cyan-300 underline underline-offset-4 decoration-cyan-500/40 hover:decoration-cyan-400"
              >
                refunds@sovereignmatrix.agency
              </a>
              . One email, full refund, no outcome conditions. See{" "}
              <a
                href="/terms"
                className="text-cyan-300 underline underline-offset-4 decoration-cyan-500/40 hover:decoration-cyan-400"
              >
                terms
              </a>{" "}
              for the fine print.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <span className="flex items-center gap-1 text-[10px] text-cyan-300/80 font-mono uppercase tracking-[0.2em]">
                <Shield className="w-3 h-3" /> Stripe secured
              </span>
              <span className="flex items-center gap-1 text-[10px] text-cyan-300/80 font-mono uppercase tracking-[0.2em]">
                <Shield className="w-3 h-3" /> Cancel anytime
              </span>
            </div>
          </motion.div>
        </section>

        {/* FAQ */}
        <section className="relative z-10 px-8 pb-20 max-w-2xl mx-auto">
          <motion.div {...fadeIn(0)} className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2 font-serif">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-neutral-400">
              Everything you need to know.
            </p>
          </motion.div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div
                key={i}
                {...fadeIn(i * 0.05)}
                className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-sm font-medium text-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-neutral-500 shrink-0" />
                    {faq.q}
                  </span>
                  <span
                    className={`text-neutral-500 transition-transform ${openFaq === i ? "rotate-45" : ""}`}
                  >
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-6 pb-4"
                  >
                    <p className="text-sm text-neutral-400 leading-relaxed pl-6">
                      {faq.a}
                    </p>
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
            <RevealText
              as="h2"
              className="text-3xl md:text-5xl font-bold mb-6 font-serif"
            >
              Start Free — No Credit Card
            </RevealText>
            <RevealText
              as="p"
              className="text-neutral-500 mb-10 max-w-xl mx-auto"
              delay={0.1}
            >
              50 free runs. 140 agents. Zero commitment. See what autonomous AI
              can do for your business.
            </RevealText>
            <MagneticButton>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-10 py-4 rounded-[3px] bg-[#B5532C] text-white text-[12px] font-mono uppercase tracking-[0.2em] hover:bg-[#C96234] transition-colors"
              >
                Start free <ArrowRight className="w-4 h-4" />
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
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <Link
              href="/for-agencies"
              className="hover:text-white transition-colors"
            >
              Agencies
            </Link>
            <Link
              href="/privacy"
              className="hover:text-white transition-colors"
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Vertical matcher ──────────────────────────────────────────────────
 * Buyer lands on /pricing → sees their vertical → 1 click to the
 * playbook page where they can run their first packet, OR sign up for
 * the matched tier. This is the most-used path on a B2B SaaS pricing
 * page and was missing from the original generic-tier layout.
 */

interface VerticalMatch {
  vertical: string;
  buyerLine: string;
  deliverable: string;
  pricing: string;
  recommendedTier: string;
  playbookHref: string;
  /**
   * Brand-strict accent — cyan for audit/infrastructure-coded verticals,
   * copper for agency/outbound-coded ones. The pricing page previously
   * fanned out into amber/violet/emerald which violated the dual-accent
   * rule documented in docs/design-system/brand-colors.md (audit 2026-05).
   */
  accent: "cyan" | "copper";
}

const VERTICAL_MATCHES: VerticalMatch[] = [
  {
    vertical: "B2B agencies",
    buyerLine:
      "Owner-operator of a 5–30 person SEO / content / ad agency, 5–50 SMB clients",
    deliverable:
      "Weekly content packet per client: SEO blog + email sequence + ad creatives + competitor teaser",
    pricing: "$499–$1,999 / mo (Array or Node tier)",
    recommendedTier: "Array",
    playbookHref: "/playbooks/agency-content-packet",
    accent: "copper",
  },
  {
    vertical: "Recruiting agencies",
    buyerLine:
      "Boutique tech / finance / sales recruiter, 5–10 hires per month",
    deliverable:
      "Weekly sourcing sprint per role: ICP + boolean strings + outreach pack + channels + objections",
    pricing: "$499–$1,499 / mo (Array tier)",
    recommendedTier: "Array",
    playbookHref: "/playbooks/recruiting-sourcing-sprint",
    accent: "cyan",
  },
  {
    vertical: "Real estate agents",
    buyerLine: "Residential agent listing 3–15 properties per quarter",
    deliverable:
      "Weekly listing pulse per property: MLS copy + open-house posts + buyer email + comps + market update",
    pricing: "$299–$799 / mo (Starter or Array tier)",
    recommendedTier: "Starter",
    playbookHref: "/playbooks/realestate-listing-pulse",
    accent: "copper",
  },
  {
    vertical: "African SMBs",
    buyerLine: "Solopreneur or 1–20 person SMB in ZA / NG / KE / EG / GH",
    deliverable:
      "Monthly growth pulse: local SEO + 4 social posts + email + WhatsApp + offer in your currency",
    pricing: "R997 / month (≈ $49, Pro tier)",
    recommendedTier: "Pro",
    playbookHref: "/playbooks/growth-pulse",
    accent: "cyan",
  },
];

const VERTICAL_TONE: Record<VerticalMatch["accent"], string> = {
  cyan: "border-cyan-500/20 bg-cyan-500/[0.04] text-cyan-300",
  copper: "border-[#B5532C]/25 bg-[#B5532C]/[0.06] text-[#E08558]",
};

function VerticalMatcher() {
  return (
    <section
      aria-label="Find your tier by vertical"
      className="relative z-10 px-6 md:px-8 py-16 max-w-6xl mx-auto"
    >
      <div className="text-center mb-10">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-3">
          Find your tier in 5 seconds
        </p>
        <h2
          className="text-3xl md:text-4xl font-bold mb-3 font-serif"
          style={{ letterSpacing: "-0.01em" }}
        >
          Pick your vertical.
        </h2>
        <p className="text-[14px] text-neutral-400 max-w-xl mx-auto leading-relaxed">
          Each vertical maps to a specific weekly deliverable and a recommended
          tier. Skip the comparison table.
        </p>
      </div>

      <ul className="grid md:grid-cols-2 gap-4">
        {VERTICAL_MATCHES.map((m) => (
          <li
            key={m.vertical}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 hover:border-white/[0.15] transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className={`inline-flex text-[10px] font-mono uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${VERTICAL_TONE[m.accent]}`}
              >
                {m.vertical}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                {m.recommendedTier} tier
              </span>
            </div>
            <p className="text-[12px] font-mono uppercase tracking-wider text-neutral-600 mb-2">
              You are
            </p>
            <p className="text-[14px] text-neutral-200 mb-4 leading-relaxed">
              {m.buyerLine}
            </p>
            <p className="text-[12px] font-mono uppercase tracking-wider text-neutral-600 mb-2">
              You ship
            </p>
            <p className="text-[14px] text-white font-medium mb-4 leading-snug">
              {m.deliverable}
            </p>
            <p className="text-[13px] text-neutral-400 mb-5 font-mono">
              {m.pricing}
            </p>
            <Link
              href={m.playbookHref}
              className="inline-flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] font-semibold text-white hover:bg-[#B5532C] hover:text-black hover:border-[#B5532C] transition-colors"
            >
              Try the {m.vertical.toLowerCase()} playbook
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
