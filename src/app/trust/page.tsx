/**
 * /trust — Trust hub for compliance buyers, auditors, and security
 * leads.
 *
 * Replaces the redirect to /spec that previously occupied this slot.
 * The thesis: compliance officers expect a dedicated "Trust" page in
 * procurement docs — one URL they can paste into a security
 * questionnaire response. Forcing them to chase a spec page,
 * status page, verifier page, controls page, and disclosure file
 * across the codebase is friction.
 *
 * This page is server-rendered (no JS needed to read it; SEO-perfect;
 * a corporate browser locked down to plain HTML still renders the
 * full posture).
 *
 * Every block on this page links to a LIVE primitive, not a
 * marketing claim:
 *   - Verifier endpoint → /api/verify (open CORS, no auth)
 *   - Status → /status (synthetic probes, live)
 *   - Receipt explorer → /explorer (proof of platform activity)
 *   - Audit-bundle export → /api/me/audit-bundle (signed evidence pack)
 *   - SOC 2 controls map → docs/soc2-controls.md in repo
 *   - Security disclosure → /security + SECURITY.md (24h critical SLA)
 *   - Sub-processors → /sub-processors
 *
 * Cyan accent per the dual-accent brand rule (audit / infrastructure
 * surface).
 */

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Shield,
  KeyRound,
  Lock,
  FileText,
  Activity,
  Globe,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Cpu,
  Eye,
  ShieldCheck,
} from "lucide-react";

const TRUST_BLOCKS: TrustBlockProps[] = [
  {
    icon: KeyRound,
    title: "Every output cryptographically signed",
    body: "Every agent run produces an HMAC-SHA256-signed receipt over a canonical projection. Tamper one byte, the signature breaks. On Pro+ the receipts are also Ed25519-signed for non-repudiation; on Team they're notarized to Bitcoin via OpenTimestamps.",
    cta: { href: "/spec", label: "VAOS 1.0 spec" },
  },
  {
    icon: Eye,
    title: "Public verifier — no auth, no signup, no API key",
    body: "Any party — compliance auditor, customer, journalist — can verify any public receipt by POSTing canonical + signature to /api/verify. Open CORS so the check runs in the verifier's own browser. Same endpoint the embed badge uses.",
    cta: { href: "/verified", label: "Live verifier demo" },
  },
  {
    icon: Activity,
    title: "Live platform activity",
    body: "A public, real-time feed of receipts being signed (visibility=public only — unlisted stays share-by-link). Compliance buyers can audit current platform activity without needing access to the dashboard.",
    cta: { href: "/explorer", label: "Open the explorer" },
  },
  {
    icon: ShieldCheck,
    title: "SOC 2-mapped controls",
    body: "Every relevant Trust Services Criterion is mapped to a concrete control in this codebase. The map lives in the repo alongside the implementation — no glossy PDF disconnected from reality.",
    cta: {
      href: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/soc2-controls.md",
      label: "Read the controls map",
      external: true,
    },
  },
  {
    icon: Globe,
    title: "GDPR (EU) + POPIA (SA) endpoints",
    body: "Right-to-access (Art. 15 / s.23) + right-to-erasure (Art. 17 / s.24) + right-to-portability (Art. 20) all exposed as authenticated API endpoints. Cookie consent enforced per POPIA + GDPR at first paint.",
    cta: { href: "/privacy", label: "Privacy policy" },
  },
  {
    icon: Lock,
    title: "Security disclosure with SLAs",
    body: "Critical 24h, high 48h, medium 7d. Safe-harbor terms for good-faith researchers documented in SECURITY.md. No bug bounty yet, but written disclosure response.",
    cta: { href: "/security", label: "Disclosure policy" },
  },
  {
    icon: Cpu,
    title: "Synthetic-probe uptime monitoring",
    body: "Public status page driven by cron-triggered synthetic probes of the actual API endpoints. Not a green-light marketing widget — real HTTP calls with budgeted response-time SLOs.",
    cta: { href: "/status", label: "Live status" },
  },
  {
    icon: FileText,
    title: "Sub-processor transparency",
    body: "Every third-party vendor that touches tenant data is listed, with the data category and DPA link. Neon (DB), Clerk (auth), Stripe (billing), Anthropic / OpenAI / NVIDIA / Cerebras (model providers), Resend (email), Sentry (errors), Vercel (hosting).",
    cta: { href: "/sub-processors", label: "Full list" },
  },
];

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* Cyan ambient glow */}
      <div
        className="fixed inset-x-0 top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
        >
          ← Sovereign Matrix
        </Link>

        {/* Header */}
        <header className="mb-12">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
            <Shield className="h-3 w-3" />
            TRUST POSTURE · ONE PAGE
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Live primitives, not marketing claims.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            Every section below links to a working endpoint, a file in this
            repo, or a real status check. Paste this URL into a procurement
            response — every claim is independently verifiable.
          </p>
        </header>

        {/* Trust blocks */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {TRUST_BLOCKS.map((block) => (
            <TrustBlock key={block.title} {...block} />
          ))}
        </div>

        {/* Procurement-response footer */}
        <section className="mt-12 overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.05] to-transparent p-6 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <div>
              <h2 className="mb-2 text-sm font-semibold text-white">
                For procurement teams
              </h2>
              <p className="text-sm leading-relaxed text-neutral-300">
                Need a security questionnaire response, DPA, or SOC 2 evidence
                pack?{" "}
                <a
                  href="mailto:security@sovereignmatrix.agency"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  security@sovereignmatrix.agency
                </a>{" "}
                — 24h response SLA for procurement requests. Include your
                vendor-risk vendor (Vanta / Drata / etc.) so we can grant access
                directly.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── TrustBlock ───────────────────────────────────────────────── */

interface TrustBlockProps {
  icon: typeof Shield;
  title: string;
  body: string;
  cta: { href: string; label: string; external?: boolean };
}

function TrustBlock({
  icon: Icon,
  title,
  body,
  cta,
}: TrustBlockProps): ReactNode {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl">
      <Icon className="mb-3 h-5 w-5 text-cyan-300" aria-hidden="true" />
      <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3>
      <p className="mb-4 text-xs leading-relaxed text-neutral-400">{body}</p>
      {cta.external ? (
        <a
          href={cta.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan-300 transition hover:text-cyan-100"
        >
          {cta.label}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ) : (
        <Link
          href={cta.href}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan-300 transition hover:text-cyan-100"
        >
          {cta.label}
          <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      )}
    </article>
  );
}
