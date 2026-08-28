import type { Metadata } from "next";
import Link from "next/link";
import {
  buildIso23894,
  toMarkdown,
  type ScoredScenario,
  type RiskScenario,
} from "@sovereign-matrix/iso-23894";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";
import { packageUrl } from "@/lib/package-links";

export const metadata: Metadata = {
  title: "ISO/IEC 23894 AI Risk Management — Live Preview · Sovereign Matrix",
  description:
    "Apache 2.0 ISO/IEC 23894:2023 AI risk management exporter. Receipts in, 5×5 likelihood × impact matrix scored, residual risk attenuated by evidence. Live preview.",
};

const SCENARIOS: RiskScenario[] = [
  {
    id: "RS-1",
    description:
      "Prompt-injection causes the model to disclose a competitor's internal pricing.",
    source: "prompt-injection",
    likelihood: "possible",
    impact: "major",
    characteristic: "secure-and-resilient",
    treatment: "reduce",
    treatmentDescription:
      "OWASP Agentic Top 10 pack + structured-output validation + jailbreak detector.",
    evidencePackPrefixes: ["owasp", "owasp-agentic", "jailbreak"],
  },
  {
    id: "RS-2",
    description:
      "Model drift over time produces fairness regression on demographic-stratified accuracy.",
    source: "model-drift",
    likelihood: "likely",
    impact: "moderate",
    characteristic: "fair-with-bias-managed",
    treatment: "reduce",
    treatmentDescription:
      "Weekly fairness-eval pack run across stratified test set.",
    evidencePackPrefixes: ["fairness-eval"],
  },
  {
    id: "RS-3",
    description:
      "Training-data poisoning at upstream vendor causes regulatory non-compliance in EU outputs.",
    source: "supply-chain",
    likelihood: "unlikely",
    impact: "catastrophic",
    characteristic: "valid-and-reliable",
    treatment: "share",
    treatmentDescription:
      "Vendor risk pack + SBOM-bound dependency review + cryptographic provenance receipts.",
    evidencePackPrefixes: ["supply-chain", "sbom", "vaos-receipt"],
  },
  {
    id: "RS-4",
    description:
      "PII leak in chat response delivered to end-user via memory retrieval.",
    source: "pii-leak",
    likelihood: "possible",
    impact: "major",
    characteristic: "privacy-enhanced",
    treatment: "reduce",
    treatmentDescription:
      "GDPR Article 32 pack + PII redactor + output verifier.",
    evidencePackPrefixes: ["gdpr-art-32", "pii-redactor"],
  },
];

const SAMPLE_RECEIPTS: ReceiptRecord[] = (() => {
  const base = new Date("2026-01-15T00:00:00Z").getTime();
  const out: ReceiptRecord[] = [];
  const packs = [
    "owasp-agentic",
    "jailbreak-detect",
    "fairness-eval",
    "supply-chain-vendor-risk",
    "vaos-receipt-signature",
    "gdpr-art-32-security",
    "pii-redactor",
  ];
  for (let i = 0; i < 480; i++) {
    out.push({
      verdictId: `v_${i.toString(36).padStart(6, "0")}`,
      overall: "pass" as const,
      issuedAt: new Date(base + i * 1000 * 60 * 30).toISOString(),
      agentSlug: "rmf-agent",
      pack: packs[i % packs.length] as string,
    } as ReceiptRecord);
  }
  return out;
})();

export default function Iso23894Preview() {
  const report = buildIso23894({
    scope: {
      organizationName: "Sample Operator — Acme AI Inc.",
      systemName: "Loan Underwriting AI",
      lifecyclePhase: "operation-monitoring",
      policyVersion: "RMP-2026-v3",
      periodStart: "2026-01-01T00:00:00Z",
      periodEnd: "2026-12-31T00:00:00Z",
    },
    scenarios: SCENARIOS,
    receipts: SAMPLE_RECEIPTS,
  });

  const md = toMarkdown(report);

  return (
    <div className="relative min-h-dvh bg-[#030303] text-white antialiased">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-30"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 0%, rgba(181,83,44,0.18) 0%, transparent 70%)",
        }}
      />
      <main className="relative max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <div className="mb-12">
          <Link
            href="/compliance"
            className="text-[12px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors tracking-tight"
          >
            ← All compliance exporters
          </Link>
        </div>

        <div className="max-w-3xl">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-5">
            Live preview · Apache 2.0 OSS
          </p>
          <h1 className="font-serif text-5xl md:text-6xl leading-[1.04] tracking-[-0.02em] mb-6">
            ISO/IEC 23894 AI risk,
            <br />
            <em className="not-italic text-[#B5532C]">scored from receipts.</em>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] mb-3">
            ISO/IEC 23894:2023 AI risk management — the AI-specific adaptation
            of ISO 31000 — generated from operator-declared risk scenarios + a
            sample receipt set using{" "}
            <code className="font-mono text-[14px] text-cyan-300/90">
              @sovereign-matrix/iso-23894
            </code>
            .
          </p>
          <p className="text-[14px] text-neutral-500 leading-relaxed">
            Inherent risk computed from the 5×5 likelihood × impact matrix.
            Residual risk attenuated by receipt evidence: 10+ receipts → 1 band
            lower; 100+ → 2 bands lower. Operator-explainable, no black-box
            arithmetic.
          </p>
        </div>

        <div className="mt-12 rounded-[6px] border border-cyan-500/20 bg-black/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Install · Apache 2.0
            </p>
            <p className="text-[10px] font-mono text-neutral-600">
              Zero deps beyond verifiable-receipts
            </p>
          </div>
          <pre className="px-5 py-4 overflow-x-auto font-mono text-[13px] leading-[1.6] text-cyan-300/95">
            {`npm install @sovereign-matrix/iso-23894 @sovereign-matrix/verifiable-receipts`}
          </pre>
        </div>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            Risk levels (residual)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(["very-low", "low", "medium", "high", "extreme"] as const).map(
              (lv) => {
                const colors: Record<string, string> = {
                  "very-low": "text-emerald-400 border-emerald-500/30",
                  low: "text-emerald-300 border-emerald-500/20",
                  medium: "text-amber-400 border-amber-500/30",
                  high: "text-orange-400 border-orange-500/30",
                  extreme: "text-red-400 border-red-500/30",
                };
                return (
                  <div
                    key={lv}
                    className={`rounded-[6px] border bg-white/[0.015] px-4 py-3 ${colors[lv]}`}
                  >
                    <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-neutral-500 mb-1">
                      {lv}
                    </p>
                    <p className="font-mono text-[20px]">
                      {report.byLevel[lv]}
                    </p>
                  </div>
                );
              },
            )}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Risk scenarios
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            Each scenario shows inherent risk (no treatment) and residual risk
            (after evidence-based attenuation).
          </p>
          <div className="rounded-[6px] border border-white/[0.06] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-white/[0.02] text-neutral-500 font-mono uppercase tracking-[0.14em] text-[10px]">
                <tr>
                  <th className="text-left px-4 py-2.5">ID</th>
                  <th className="text-left px-4 py-2.5">Description</th>
                  <th className="text-left px-4 py-2.5">Inherent</th>
                  <th className="text-right px-4 py-2.5">Evidence</th>
                  <th className="text-left px-4 py-2.5">Residual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {report.scenarios.map((s: ScoredScenario) => (
                  <tr
                    key={s.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2 font-mono text-cyan-300/90 text-[11px]">
                      {s.id}
                    </td>
                    <td className="px-4 py-2 text-neutral-300 max-w-md">
                      {s.description}
                    </td>
                    <td className="px-4 py-2 text-neutral-400 font-mono text-[11px]">
                      {s.inherentRisk}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-400">
                      {s.evidenceCount}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px]">
                      <span
                        className={
                          s.residualRisk === "very-low" ||
                          s.residualRisk === "low"
                            ? "text-emerald-400"
                            : s.residualRisk === "medium"
                              ? "text-amber-400"
                              : s.residualRisk === "high"
                                ? "text-orange-400"
                                : "text-red-400"
                        }
                      >
                        {s.residualRisk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Markdown preview
          </h2>
          <div className="rounded-[6px] border border-white/[0.06] bg-black/40 max-h-[560px] overflow-y-auto">
            <pre className="px-5 py-4 font-mono text-[11px] leading-[1.55] text-neutral-300 whitespace-pre-wrap break-words">
              {md.slice(0, 4500)}
              {md.length > 4500 &&
                "\n\n… (truncated — full output is ~" +
                  (md.length / 1000).toFixed(1) +
                  "kB)"}
            </pre>
          </div>
        </section>

        <section className="mt-20 mb-8 rounded-[10px] border border-[#B5532C]/20 bg-[#1a0f0a]/40 px-6 md:px-10 py-10 md:py-14">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#B5532C] mb-4">
            The &ldquo;how&rdquo; that ISO 42001 references
          </p>
          <h3 className="font-serif text-3xl md:text-4xl mb-4 tracking-tight">
            Operator-explainable risk scoring,
            <br />
            <em className="not-italic text-[#B5532C]">
              attenuated by receipts.
            </em>
          </h3>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#B5532C] text-white font-semibold text-[13px] rounded-[3px] hover:bg-[#C96234] transition-colors tracking-tight"
            >
              Start free
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href={packageUrl("@sovereign-matrix/iso-23894")}
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/[0.12] text-neutral-300 font-mono text-[13px] rounded-[3px] hover:text-white hover:border-white/25 transition-colors"
            >
              View source
            </Link>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/[0.04] text-[12px] font-mono text-neutral-600">
          Generated by{" "}
          <code className="text-cyan-300/80">@sovereign-matrix/iso-23894</code>{" "}
          v0.1.0 · Apache 2.0 · schema{" "}
          <code className="text-cyan-300/80">vaos-iso-23894-v1</code>
        </footer>
      </main>
    </div>
  );
}
