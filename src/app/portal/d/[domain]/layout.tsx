"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

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
   White-Label Portal Layout

   Minimal layout for agency client portals.
   Does NOT inherit the Sovereign Matrix cinematic
   effects, branding, or root layout aesthetics.
   Instead, uses the agency's own colors and logo.
   ═══════════════════════════════════════════ */

export default function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = use(params);
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch(`/api/portal/${encodeURIComponent(domain)}`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        if (data.error) {
          setError(true);
          return;
        }
        setConfig(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, [domain]);

  const accent = config?.primaryColor || "#00B7FF";

  // Inject CSS custom properties for child components
  const cssVars = {
    "--portal-accent": accent,
    "--portal-accent-10": `${accent}1a`,
    "--portal-accent-20": `${accent}33`,
    "--portal-accent-40": `${accent}66`,
  } as React.CSSProperties;

  /* ── Loading state ── */
  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#030303] flex items-center justify-center"
        style={cssVars}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} />
          <p className="text-sm text-neutral-500">Loading portal...</p>
        </motion.div>
      </div>
    );
  }

  /* ── Error / not configured ── */
  if (error || !config) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">?</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            Portal Not Configured
          </h1>
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
            No white-label portal is configured for{" "}
            <span className="font-mono text-neutral-400">{domain}</span>. If you
            are an agency administrator, set up your custom domain in the
            dashboard settings.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/[0.06] text-sm text-neutral-300 hover:bg-white/10 transition-colors"
          >
            Go to homepage
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200" style={cssVars}>
      {/* ── Branded Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#030303]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.logoUrl ? (
              <Image
                src={config.logoUrl}
                alt={config.agencyName}
                width={28}
                height={28}
                className="w-7 h-7 rounded-lg object-contain"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: accent }}
              >
                {config.agencyName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-bold tracking-widest uppercase text-white">
              {config.agencyName}
            </span>
          </div>

          {config.supportEmail && (
            <a
              href={`mailto:${config.supportEmail}`}
              className="text-xs text-neutral-500 hover:text-white transition-colors"
            >
              Support
            </a>
          )}
        </div>
      </nav>

      {/* ── Main Content ── */}
      <AnimatePresence mode="wait">
        <motion.main
          key={domain}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pt-14"
        >
          {children}
        </motion.main>
      </AnimatePresence>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <p className="text-[10px] text-neutral-600 uppercase tracking-[0.2em]">
            {config.agencyName}
          </p>
          {config.supportEmail && (
            <a
              href={`mailto:${config.supportEmail}`}
              className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              {config.supportEmail}
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
