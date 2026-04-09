"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  FileText,
  LogIn,
  Search,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { SignInButton, useUser } from "@clerk/nextjs";
import Link from "next/link";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface PortalConfig {
  agencyName: string;
  logoUrl: string | null;
  primaryColor: string;
  supportEmail: string | null;
  domain: string;
}

/* ═══════════════════════════════════════════
   White-Label Client Portal Page

   This is the page agency clients see when they
   visit /portal/d/[domain]. It:
   - Fetches the whitelabel config from DB
   - Renders agency-branded landing / login
   - Authenticated users see a mini-dashboard
   - Zero Sovereign Matrix branding visible
   ═══════════════════════════════════════════ */

export default function WhiteLabelPortal({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = use(params);
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch(`/api/portal/${encodeURIComponent(domain)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.error) setConfig(data);
      } catch {
        /* handled by layout 404 */
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, [domain]);

  // Layout handles loading + 404
  if (loading || !config) return null;

  const accent = config.primaryColor || "#00B7FF";

  // Authenticated clients see the dashboard view
  if (userLoaded && isSignedIn) {
    return <AuthenticatedPortal config={config} domain={domain} />;
  }

  // Unauthenticated — branded landing + sign-in
  return <PortalLanding config={config} accent={accent} />;
}

/* ═══════════════════════════════════════════
   Landing — Unauthenticated
   ═══════════════════════════════════════════ */

function PortalLanding({
  config,
  accent,
}: {
  config: PortalConfig;
  accent: string;
}) {
  const capabilities = [
    {
      icon: Users,
      title: "Lead Generation",
      description: "AI agents find and qualify leads around the clock.",
    },
    {
      icon: FileText,
      title: "Content Creation",
      description: "Blog posts, social media, and email sequences on demand.",
    },
    {
      icon: Search,
      title: "SEO Optimization",
      description: "Technical audits, keyword research, and ranking reports.",
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description: "Real-time dashboards with full campaign visibility.",
    },
  ];

  return (
    <div className="pb-20">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Accent glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.08] pointer-events-none"
          style={{ backgroundColor: accent }}
        />

        <div className="max-w-4xl mx-auto px-6 pt-28 pb-20 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Agency Logo */}
            <div className="flex justify-center mb-8">
              {config.logoUrl ? (
                <Image
                  src={config.logoUrl}
                  alt={config.agencyName}
                  width={72}
                  height={72}
                  className="w-[72px] h-[72px] rounded-2xl object-contain"
                />
              ) : (
                <div
                  className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                  style={{
                    backgroundColor: accent,
                    boxShadow: `0 0 60px ${accent}33`,
                  }}
                >
                  {config.agencyName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
              Welcome to{" "}
              <span style={{ color: accent }}>{config.agencyName}</span>
            </h1>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Your dedicated AI-powered workspace. Sign in to access your
              campaign dashboard, real-time analytics, and autonomous agent
              results.
            </p>

            {/* Sign In CTA */}
            <SignInButton mode="modal">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-bold text-base transition-all shadow-lg"
                style={{
                  backgroundColor: accent,
                  boxShadow: `0 8px 32px ${accent}40`,
                }}
              >
                <LogIn className="w-5 h-5" />
                Sign In to Your Portal
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </SignInButton>
          </motion.div>
        </div>
      </section>

      {/* ── Capabilities Grid ── */}
      <section className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-10"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2">
            What We Deliver
          </p>
          <h2 className="text-2xl font-bold text-white">
            Powered by Autonomous AI
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="backdrop-blur-xl bg-white/[0.03] rounded-2xl p-6 border border-white/[0.06] hover:border-white/[0.12] transition-colors group"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors"
                style={{ backgroundColor: `${accent}1a` }}
              >
                <cap.icon className="w-5 h-5" style={{ color: accent }} />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                {cap.title}
              </h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                {cap.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <section className="max-w-5xl mx-auto px-6 mt-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="backdrop-blur-xl bg-white/[0.02] rounded-2xl border border-white/[0.04] px-8 py-6 flex flex-col sm:flex-row items-center justify-center gap-6 text-center"
        >
          <div className="flex items-center gap-2 text-neutral-500">
            <ShieldCheck className="w-4 h-4" style={{ color: accent }} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              5-Layer Security
            </span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-white/[0.06]" />
          <div className="flex items-center gap-2 text-neutral-500">
            <Bot className="w-4 h-4" style={{ color: accent }} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              130+ AI Agents
            </span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-white/[0.06]" />
          <div className="flex items-center gap-2 text-neutral-500">
            <Zap className="w-4 h-4" style={{ color: accent }} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Always On
            </span>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Dashboard — Authenticated
   ═══════════════════════════════════════════ */

function AuthenticatedPortal({
  config,
  domain,
}: {
  config: PortalConfig;
  domain: string;
}) {
  const { user } = useUser();
  const accent = config.primaryColor || "#00B7FF";

  const quickLinks = [
    {
      label: "Campaign Dashboard",
      description: "Live agent executions, leads, and content metrics.",
      icon: BarChart3,
      href: `/portal/${encodeURIComponent(domain)}`,
    },
    {
      label: "Revenue Attribution",
      description: "See which AI agents drive the most value.",
      icon: Users,
      href: `/portal/${encodeURIComponent(domain)}/revenue`,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-20">
      {/* ── Welcome Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <p
          className="text-xs font-bold uppercase tracking-[0.2em] mb-2"
          style={{ color: accent }}
        >
          {config.agencyName} Portal
        </p>
        <h1 className="text-3xl font-bold text-white mb-1">
          Welcome back
          {user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-sm text-neutral-500">
          Access your campaign data and AI agent results below.
        </p>
      </motion.div>

      {/* ── Status Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6 mb-8 flex items-center gap-4"
      >
        <div
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: accent }}
        />
        <div>
          <p className="text-sm font-semibold text-white">Agents Active</p>
          <p className="text-xs text-neutral-500">
            Your AI workforce is running. Results update in real time.
          </p>
        </div>
      </motion.div>

      {/* ── Quick Links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <AnimatePresence>
          {quickLinks.map((link, i) => (
            <motion.div
              key={link.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <Link
                href={link.href}
                className="block backdrop-blur-xl bg-white/[0.03] rounded-2xl p-6 border border-white/[0.06] hover:border-white/[0.12] transition-colors group h-full"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${accent}1a` }}
                >
                  <link.icon className="w-5 h-5" style={{ color: accent }} />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  {link.label}
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed mb-4">
                  {link.description}
                </p>
                <span
                  className="text-xs font-semibold flex items-center gap-1.5 group-hover:gap-2.5 transition-all"
                  style={{ color: accent }}
                >
                  Open <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Contact Support ── */}
      {config.supportEmail && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <p className="text-xs text-neutral-600">
            Need help?{" "}
            <a
              href={`mailto:${config.supportEmail}`}
              className="hover:text-neutral-300 transition-colors underline underline-offset-4"
              style={{ color: accent }}
            >
              Contact your account manager
            </a>
          </p>
        </motion.div>
      )}
    </div>
  );
}
