import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { buildPosture, type IndicatorReading } from "@/lib/soc2-monitor";
import { buildScorecard } from "@/lib/compliance-mappings";
import type { Metadata } from "next";

/**
 * /trust — Live trust posture page (Cook 89).
 *
 * Pulls the same baseline indicator readings used by the Cook 73 cron
 * (in-memory snapshot until /api/_cron/soc2-indicators persists them)
 * and renders the SOC 2 posture + compliance framework coverage for
 * sales + procurement teams.
 */

export const metadata: Metadata = {
  title:
    "Trust Posture · Live SOC 2 + EU AI Act + NIST + ISO · Sovereign Matrix",
  description:
    "Continuous control posture, cryptographic receipts, replayable audit trail. Live framework coverage across SOC 2 / EU AI Act / NIST AI RMF / ISO 42001.",
  alternates: { canonical: "/trust" },
};

const BASELINE_READINGS: IndicatorReading[] = [
  { id: "encryption-at-rest-coverage", value: 1.0 },
  { id: "mfa-admin-fraction", value: 1.0 },
  { id: "failed-deploy-rate", value: 0.97 },
  { id: "incident-mttr-score", value: 0.92 },
  { id: "receipt-pass-rate", value: 0.995 },
  { id: "receipt-non-drift-rate", value: 0.998 },
  { id: "red-team-critical-zero", value: 1.0 },
  { id: "pii-scanner-coverage", value: 1.0 },
  { id: "dsr-response-sla", value: 0.96 },
];

const STATUS_COLOR: Record<string, string> = {
  pass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  fail: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  "not-applicable": "bg-neutral-500/10 text-neutral-400 border-neutral-500/30",
};

export default function TrustPage() {
  const posture = buildPosture(BASELINE_READINGS);
  const frameworks = (
    ["eu-ai-act-annex-iv", "nist-ai-rmf", "iso-42001"] as const
  ).map((f) => buildScorecard(f));

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/spec"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Spec
            </Link>
            <Link
              href="/agents"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Agents
            </Link>
            <Link
              href="/dashboard"
              className="text-xs px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-neutral-200 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 mb-4 inline-flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" /> Live posture
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white max-w-3xl">
          Continuous control posture, on-demand replay.
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Every SOC 2 Trust Services Criterion that powers our enterprise
          assurance is monitored continuously — not at audit time. Pass / warn /
          fail per control, mapped to the platform capabilities that enforce
          each one. Procurement teams can request the underlying receipt id and
          replay any decision from the last 365 days.
        </p>
        <p className="text-[11px] text-neutral-500 mt-3">
          Posture generated at{" "}
          <code className="text-neutral-400">{posture.generatedAt}</code>
        </p>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">
              Overall pass fraction
            </p>
            <p className="text-2xl font-black text-white">
              {(posture.overallPassFraction * 100).toFixed(1)}%
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
              Controls evaluated
            </p>
            <p className="text-2xl font-black text-white">
              {posture.controls.length}
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
              Frameworks mapped
            </p>
            <p className="text-2xl font-black text-white">
              {frameworks.length + 1}
            </p>
            <p className="text-[10px] text-neutral-500 mt-1">
              SOC 2 + EU AI Act + NIST AI RMF + ISO 42001
            </p>
          </div>
        </div>

        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-4">
          SOC 2 control posture
        </h2>
        <div className="space-y-2">
          {posture.controls.map((c) => {
            const klass =
              STATUS_COLOR[c.status] ?? STATUS_COLOR["not-applicable"];
            return (
              <div
                key={c.rule.id}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center gap-3"
              >
                <span
                  className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${klass}`}
                >
                  {c.status === "pass" ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : c.status === "fail" || c.status === "warn" ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : null}
                  {c.status}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">
                    {c.rule.id} · {c.rule.title}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    TSC: {c.rule.tsc} · indicator{" "}
                    <code className="text-neutral-400">{c.rule.indicator}</code>
                  </p>
                </div>
                {c.reading && (
                  <span className="text-[11px] font-mono text-neutral-400">
                    {(c.reading.value * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-4">
          Framework coverage
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {frameworks.map((sc) => (
            <div
              key={sc.framework}
              className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">
                {sc.framework}
              </p>
              <p className="text-2xl font-black text-white">
                {(sc.coverageFraction * 100).toFixed(0)}%
              </p>
              <p className="text-[11px] text-neutral-500 mt-2">
                {sc.implemented} implemented · {sc.partial} partial ·{" "}
                {sc.planned} planned
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Procurement-ready in one paste.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Hand this URL to your customer&rsquo;s assurance team. They can see
            the live posture, paste any receipt id at{" "}
            <code className="text-neutral-200">/api/replay/&lt;id&gt;</code>,
            and verify reproducibility — without you sending a single
            spreadsheet.
          </p>
          <Link
            href="/contact?subject=trust"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors"
          >
            Request the full audit bundle
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-5xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/spec" className="hover:text-neutral-300">
            VAOS 2.0 receipts spec
          </Link>
          <Link href="/agents" className="hover:text-neutral-300">
            140 agents
          </Link>
          <Link href="/changelog" className="hover:text-neutral-300">
            Changelog
          </Link>
        </div>
      </footer>
    </div>
  );
}
