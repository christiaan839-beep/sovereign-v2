"use client";

import { motion } from "framer-motion";
import {
  Building2, Palette, Bot, Users, Sparkles,
  ArrowRight, CheckCircle2, Star, Quote,
  Calculator, TrendingUp, Shield, Mail, Copy, Check,
} from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import {
  RevealText,
  StaggerChildren,
  GlowDivider,
  MagneticButton,
} from "@/components/ui/ScrollAnimations";

/* ─── Benefit Cards ─── */
const BENEFITS = [
  {
    icon: Palette,
    title: "Your Brand",
    desc: "Custom domain, logo, colors. Clients never see Sovereign Matrix. It's your platform, fully white-labeled.",
    accent: "from-purple-500/10",
  },
  {
    icon: Bot,
    title: "124 Agents",
    desc: "Lead gen, content creation, SEO, voice, design, analytics. All pre-built and running under your roof.",
    accent: "from-emerald-500/10",
  },
  {
    icon: Users,
    title: "Client Portals",
    desc: "Each client gets their own isolated dashboard with usage tracking, billing, and agent management.",
    accent: "from-cyan-500/10",
  },
  {
    icon: Sparkles,
    title: "Zero AI Knowledge Needed",
    desc: "Pre-built workflows and templates. No prompt engineering required. Just resell and collect revenue.",
    accent: "from-amber-500/10",
  },
];

/* ─── Testimonial Placeholder ─── */
const TESTIMONIALS = [
  {
    quote: "We went from a 3-person agency to managing 20 clients with AI-powered delivery. Revenue tripled in 4 months.",
    name: "Agency Partner",
    role: "Digital Marketing Agency",
    avatar: "AP",
  },
  {
    quote: "The white-label setup took 15 minutes. Our clients think we built the entire platform ourselves.",
    name: "Early Adopter",
    role: "Growth Consultancy",
    avatar: "EA",
  },
  {
    quote: "124 agents doing what used to take a team of 12. The ROI speaks for itself.",
    name: "Beta Partner",
    role: "Creative Agency",
    avatar: "BP",
  },
];

/* ─── Enterprise Feature List ─── */
const ENTERPRISE_FEATURES = [
  "5 white-label sub-licenses included",
  "Custom domain + SSL",
  "Full brand customization",
  "Client portal management",
  "Priority API access",
  "Dedicated account manager",
  "Custom agent workflows",
  "SLA-backed uptime guarantee",
  "Quarterly strategy sessions",
  "Revenue analytics dashboard",
];

/* ─── Outreach Email Templates ─── */
const OUTREACH_TEMPLATES = [
  {
    id: "cold-outreach",
    label: "Cold Outreach to Agency Owner",
    subject: "Replace your content team with AI — same output, 1/10th the cost",
    body: `Hi {{first_name}},

I noticed {{agency_name}} is doing solid work in {{niche}}. Quick question — how much are you spending monthly on content creation, lead gen, and reporting?

We built Sovereign Matrix — a white-label AI platform with 124 pre-built agents that handle content, SEO, lead gen, ad copy, design briefs, competitor analysis, and more. Your clients never see our brand. It runs under your domain, your logo, your pricing.

The entry tier is R897/mo ($49). Agencies are reselling access to clients at 5-10x that.

No prompt engineering needed. No technical setup. Just log in, pick an agent, and let it work.

Want me to send a 2-minute demo video?

Best,
{{your_name}}`,
  },
  {
    id: "follow-up",
    label: "Follow-Up After Demo",
    subject: "Your Sovereign Matrix demo — next steps",
    body: `Hi {{first_name}},

Thanks for checking out the demo. Here's a quick recap of what you saw:

1. 124 autonomous agents running content, SEO, lead gen, and reporting — all under your brand
2. White-label dashboard with your domain, logo, and client portals
3. 65+ open-source AI models with $0 per-token cost (no API billing surprises)

Three outcomes agencies typically see in the first 30 days:
- Cut content production costs by 80%
- Launch 3-5 new service offerings without hiring
- Increase client retention with AI-powered monthly reports

The next step is simple — start your free trial (100 runs, no credit card) and run one real campaign for a client.

Ready to go? Here's the link: https://sovereignmatrix.agency/dashboard

Let me know if you have questions.

Best,
{{your_name}}`,
  },
  {
    id: "referral",
    label: "Referral Ask",
    subject: "Know any agencies drowning in manual work?",
    body: `Hi {{first_name}},

Quick ask — do you know any agency owners who are still manually writing content, building reports, or chasing leads by hand?

We just launched a referral program for Sovereign Matrix:
- You refer an agency owner
- They get 50 bonus runs on signup
- You get 50 bonus runs added to your account

No limits on referrals. The more you share, the more you earn.

Just have them sign up at https://sovereignmatrix.agency/dashboard and mention your name, or forward this email.

Thanks for spreading the word.

Best,
{{your_name}}`,
  },
];

/* ─── Copy Button Component ─── */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:bg-white/10 hover:text-white transition-all"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" /> {label}
        </>
      )}
    </button>
  );
}

/* ─── Stagger wrapper ─── */
const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export default function ForAgenciesPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-white antialiased">
      {/* ─── Navigation ─── */}
      <nav className="fixed top-6 inset-x-0 z-50 flex justify-center px-6 pointer-events-none">
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-full px-8 h-16 flex items-center justify-between gap-12 pointer-events-auto max-w-5xl w-full">
          <Link href="/" className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <span className="hidden sm:block text-sm font-bold tracking-[0.2em] uppercase text-white font-serif">
              For Agencies
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
              href="/partner"
              className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all"
            >
              Book a Call
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-40 pb-24 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-emerald-500/[0.04] rounded-full blur-[250px]" />
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[200px]" />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-5xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-[0.2em] mb-8">
            <Building2 className="w-3 h-3" /> Agency White-Label Program
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6 font-serif">
            Turn Your Agency Into
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
              an AI Powerhouse
            </span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 max-w-3xl mx-auto mb-12 leading-relaxed">
            White-label 124 AI agents under your brand. Your domain. Your clients. Your revenue.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MagneticButton>
              <Link
                href="/partner"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-black text-sm font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all"
              >
                Book a Strategy Call <ArrowRight className="w-4 h-4" />
              </Link>
            </MagneticButton>
            <Link
              href="#pricing"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/10 text-neutral-300 text-sm font-bold uppercase tracking-widest hover:border-white/20 hover:text-white transition-all"
            >
              See Pricing
            </Link>
          </div>
        </motion.div>
      </section>

      <GlowDivider />

      {/* ─── ROI Calculator Section ─── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-6 font-serif">
            The Math Speaks for Itself
          </RevealText>
          <RevealText as="p" className="text-neutral-500 text-center max-w-2xl mx-auto mb-16" delay={0.1}>
            One license. Unlimited upside.
          </RevealText>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative p-8 md:p-12 rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.02] backdrop-blur-xl overflow-hidden"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <Calculator className="w-6 h-6 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                  ROI Projection
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-8 mb-10">
                <div className="text-center">
                  <p className="text-sm text-neutral-500 mb-2 uppercase tracking-wider">Your Investment</p>
                  <p className="text-3xl md:text-4xl font-bold text-white font-mono">R9,997</p>
                  <p className="text-xs text-neutral-500 mt-1">/month</p>
                </div>
                <div className="text-center flex flex-col items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-emerald-400 mb-2" />
                  <p className="text-xs text-neutral-500 uppercase tracking-wider">Resell to 20 clients</p>
                  <p className="text-xs text-neutral-500">at R2,000/mo each</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-neutral-500 mb-2 uppercase tracking-wider">Your Revenue</p>
                  <p className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 font-mono">
                    R40,000
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">/month</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-neutral-500">That&apos;s a</span>
                <span className="text-2xl font-bold text-emerald-400 font-mono">4x</span>
                <span className="text-neutral-500">return on your investment. Every single month.</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <GlowDivider />

      {/* ─── Benefits ─── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-6 font-serif">
            Everything You Need to Scale
          </RevealText>
          <RevealText as="p" className="text-neutral-500 text-center max-w-2xl mx-auto mb-16" delay={0.1}>
            Your brand. Your revenue. Our technology.
          </RevealText>

          <StaggerChildren className="grid md:grid-cols-2 gap-6">
            {BENEFITS.map((b) => (
              <motion.div
                key={b.title}
                variants={fadeUp}
                className="group relative p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-emerald-500/20 transition-all duration-500 overflow-hidden"
              >
                <div
                  className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br ${b.accent} to-transparent`}
                />
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6 group-hover:border-emerald-500/20 transition-colors">
                    <b.icon className="w-6 h-6 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{b.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{b.desc}</p>
                </div>
              </motion.div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      <GlowDivider />

      {/* ─── Testimonials ─── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-6 font-serif">
            Trusted by Agencies
          </RevealText>
          <RevealText as="p" className="text-neutral-500 text-center max-w-2xl mx-auto mb-16" delay={0.1}>
            Early partners are already seeing results.
          </RevealText>

          <StaggerChildren className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <motion.div
                key={t.name}
                variants={fadeUp}
                className="relative p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl"
              >
                <Quote className="w-8 h-8 text-emerald-500/20 mb-4" />
                <p className="text-sm text-neutral-300 leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-emerald-400">{t.avatar}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.role}</p>
                  </div>
                </div>
                {/* Stars */}
                <div className="flex gap-1 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                  ))}
                </div>
              </motion.div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      <GlowDivider />

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-6 font-serif">
            Enterprise White-Label Plan
          </RevealText>
          <RevealText as="p" className="text-neutral-500 text-center max-w-2xl mx-auto mb-16" delay={0.1}>
            Everything your agency needs to dominate with AI.
          </RevealText>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative p-10 md:p-14 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.04] to-transparent backdrop-blur-xl overflow-hidden"
          >
            {/* Corner glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-[100px]" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em]">
                  Enterprise
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl md:text-6xl font-bold text-white font-mono">R49,997</span>
                <span className="text-neutral-500">/month</span>
              </div>
              <p className="text-sm text-neutral-500 mb-10">
                5 white-label sub-licenses included. Scale as you grow.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-10">
                {ENTERPRISE_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300">{f}</span>
                  </div>
                ))}
              </div>

              <MagneticButton>
                <Link
                  href="/partner"
                  className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-white text-black text-sm font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all w-full sm:w-auto justify-center"
                >
                  Book a Strategy Call <ArrowRight className="w-4 h-4" />
                </Link>
              </MagneticButton>
            </div>
          </motion.div>
        </div>
      </section>

      <GlowDivider />

      {/* ─── Outreach Email Templates ─── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <RevealText as="h2" className="text-3xl md:text-4xl font-bold text-center mb-6 font-serif">
            Outreach Templates
          </RevealText>
          <RevealText as="p" className="text-neutral-500 text-center max-w-2xl mx-auto mb-16" delay={0.1}>
            Copy-paste emails to land your first clients. Customize the placeholders and send.
          </RevealText>

          <StaggerChildren className="space-y-6">
            {OUTREACH_TEMPLATES.map((t) => {
              const fullEmail = `Subject: ${t.subject}\n\n${t.body}`;
              return (
                <motion.div
                  key={t.id}
                  variants={fadeUp}
                  className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden hover:border-emerald-500/20 transition-all duration-500"
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-emerald-500/[0.03] to-transparent" />

                  <div className="relative z-10 p-8">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <Mail className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">{t.label}</h3>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Subject: <span className="text-neutral-400">{t.subject}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <CopyButton text={t.subject} label="Subject" />
                        <CopyButton text={fullEmail} label="Full Email" />
                      </div>
                    </div>

                    {/* Email body */}
                    <div className="rounded-xl bg-black/30 border border-white/[0.04] p-6">
                      <pre className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap font-sans">
                        {t.body}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </StaggerChildren>
        </div>
      </section>

      <GlowDivider />

      {/* ─── CTA ─── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <RevealText as="h2" className="text-3xl md:text-5xl font-bold mb-6 font-serif">
            Ready to 4x Your Revenue?
          </RevealText>
          <RevealText as="p" className="text-neutral-500 mb-10 max-w-xl mx-auto" delay={0.1}>
            Join the next generation of AI-powered agencies. Your competitors are already here.
          </RevealText>
          <MagneticButton>
            <Link
              href="/partner"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold uppercase tracking-widest hover:from-emerald-600 hover:to-teal-600 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            >
              Book a Strategy Call <ArrowRight className="w-4 h-4" />
            </Link>
          </MagneticButton>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <SovereignLogo size="sm" />
            <span className="text-xs text-neutral-500">
              Sovereign Matrix &mdash; AI Infrastructure for Agencies
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-neutral-500">
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/partner" className="hover:text-white transition-colors">
              Partner Program
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
