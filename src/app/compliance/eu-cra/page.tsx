import type { Metadata } from "next";
import Link from "next/link";
import {
  buildEuCra,
  toMarkdown,
  type CraRequirement,
} from "@sovereign-matrix/eu-cra";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

export const metadata: Metadata = {
  title: "EU Cyber Resilience Act — Live Preview · Sovereign Matrix",
  description:
    "Apache 2.0 EU Cyber Resilience Act (Regulation 2024/2847) compliance exporter. Annex I + Article 13/14 from VAOS receipts. Enforcement begins 2026 (vulnerability reporting) and 2027 (full obligations).",
};

const SAMPLE_RECEIPTS: ReceiptRecord[] = (() => {
  const base = new Date("2026-01-01T00:00:00Z").getTime();
  const span = new Date("2026-12-31T23:59:59Z").getTime() - base;
  const out: ReceiptRecord[] = [];
  const packs = [
    "cra-secure-design",
    "cra-encryption-aes",
    "cra-tls-1.3",
    "cra-iam-rbac",
    "cra-audit-log",
    "cra-sbom",
    "cra-vuln-scan",
    "cra-incident-response",
    "cra-secure-update",
    "cra-patch-mgmt",
    "vaos-receipt-signature",
    "owasp-agentic",
    "soc2-cc6-iam",
    "iso-23894-risk-assessment",
  ];
  for (let i = 0; i < 1840; i++) {
    out.push({
      verdictId: `v_${i.toString(36).padStart(6, "0")}`,
      overall: "pass" as const,
      issuedAt: new Date(base + (i * span) / 1840).toISOString(),
      agentSlug: "receipt-mint",
      pack: packs[i % packs.length] as string,
    } as ReceiptRecord);
  }
  return out;
})();

export default function EuCraPreview() {
  const report = buildEuCra({
    scope: {
      manufacturer: "Sample Operator — Acme AI Inc.",
      productName: "Sovereign Receipt Mint",
      productIdentifier: "srm-1.0",
      category: "important-class-II",
      intendedUse:
        "Server-side mint of cryptographically signed receipts for autonomous AI agents.",
      placedOnMarketAt: "2026-06-01T00:00:00Z",
    },
    receipts: SAMPLE_RECEIPTS,
    implementationStatus: {
      "AI.TD.4": {
        status: "compliant",
        note: "CE marking affixed 2026-06-01 per Annex V.",
      },
      "AI.I.3.h": {
        status: "not-applicable",
        note: "Product does not interact with other devices or networks.",
      },
    },
    residualRisks: [
      "Quantum-computer-led break of ECDSA signatures within 5-10 years (mitigated by ML-DSA-65 dual-signing).",
      "Supply-chain attack via an upstream transitive npm dep (mitigated by SBOM + dependency-review CI).",
    ],
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
            EU Cyber Resilience Act,
            <br />
            <em className="not-italic text-[#B5532C]">
              generated from receipts.
            </em>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] mb-3">
            Annex I (Part I + Part II) + Article 13/14 evidence generated from a
            sample 12-month window using{" "}
            <code className="font-mono text-[14px] text-cyan-300/90">
              @sovereign-matrix/eu-cra
            </code>
            .
          </p>
          <p className="text-[14px] text-neutral-500 leading-relaxed">
            CRA vulnerability reporting begins 2026-09-11; full obligations
            apply 2027-12-11. Every product with digital elements on the EU
            market — including AI software — needs this.
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
            {`npm install @sovereign-matrix/eu-cra @sovereign-matrix/verifiable-receipts`}
          </pre>
        </div>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            Summary
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="Total requirements"
              value={report.summary.totalRequirements.toString()}
              tone="neutral"
            />
            <Stat
              label="Compliant"
              value={`${report.summary.compliant} / ${report.summary.totalRequirements}`}
              tone="emerald"
            />
            <Stat
              label="Open findings"
              value={report.findings.length.toString()}
              tone={report.findings.length > 0 ? "amber" : "emerald"}
            />
            <Stat
              label="Receipts in window"
              value={report.reportingWindow.totalReceipts.toLocaleString()}
              tone="neutral"
            />
          </div>
          <h3 className="font-serif text-[18px] mt-8 mb-3 tracking-tight">
            By category
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(
              [
                "design",
                "vulnerability-handling",
                "post-market",
                "documentation",
              ] as const
            ).map((cat) => {
              const total = report.requirements.filter(
                (r: CraRequirement) => r.category === cat,
              ).length;
              const evidenced = report.summary.byCategory[cat];
              return (
                <div
                  key={cat}
                  className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-4 py-3"
                >
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#B5532C] mb-1">
                    {cat}
                  </p>
                  <p className="font-mono text-[18px]">
                    <span className="text-emerald-400">{evidenced}</span>
                    <span className="text-neutral-600 text-[14px]">
                      {" "}
                      / {total}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {report.findings.length > 0 && (
          <section className="mt-12 rounded-[6px] border border-amber-500/20 bg-amber-500/[0.04] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-400 mb-3">
              Open findings · {report.findings.length}
            </p>
            <ul className="grid md:grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
              {report.findings.slice(0, 20).map((f: CraRequirement) => (
                <li key={f.id} className="flex items-baseline gap-2">
                  <span className="font-mono text-amber-400/90 text-[11px]">
                    {f.id}
                  </span>
                  <span className="text-neutral-500 truncate">{f.title}</span>
                </li>
              ))}
              {report.findings.length > 20 && (
                <li className="text-neutral-600 italic">
                  … + {report.findings.length - 20} more
                </li>
              )}
            </ul>
          </section>
        )}

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Annex I Part I — Cybersecurity requirements
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            The 13 essential cybersecurity requirements every product must
            satisfy. Open requirements with no evidence become CRA-audit
            findings.
          </p>
          <div className="rounded-[6px] border border-white/[0.06] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-white/[0.02] text-neutral-500 font-mono uppercase tracking-[0.14em] text-[10px]">
                <tr>
                  <th className="text-left px-4 py-2.5">ID</th>
                  <th className="text-left px-4 py-2.5">Title</th>
                  <th className="text-left px-4 py-2.5">Annex ref</th>
                  <th className="text-right px-4 py-2.5">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {report.requirements
                  .filter((r: CraRequirement) => r.category === "design")
                  .map((r: CraRequirement) => (
                    <tr
                      key={r.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-2 font-mono text-cyan-300/90 text-[11px]">
                        {r.id}
                      </td>
                      <td className="px-4 py-2 text-neutral-300">{r.title}</td>
                      <td className="px-4 py-2 font-mono text-neutral-500 text-[10px]">
                        {r.annexReference}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {r.evidenceCount > 0 ? (
                          <span className="text-emerald-400">
                            {r.evidenceCount}
                          </span>
                        ) : (
                          <span className="text-neutral-600">0</span>
                        )}
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
            CRA vulnerability reporting: 2026-09-11
          </p>
          <h3 className="font-serif text-3xl md:text-4xl mb-4 tracking-tight">
            Three lines around your AI call.
            <br />
            <em className="not-italic text-[#B5532C]">
              CRA-ready evidence, automatic.
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
              href="https://www.npmjs.com/package/@sovereign-matrix/eu-cra"
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/[0.12] text-neutral-300 font-mono text-[13px] rounded-[3px] hover:text-white hover:border-white/25 transition-colors"
            >
              View on npm
            </Link>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/[0.04] text-[12px] font-mono text-neutral-600">
          Generated by{" "}
          <code className="text-cyan-300/80">@sovereign-matrix/eu-cra</code>{" "}
          v0.1.0 · Apache 2.0 · schema{" "}
          <code className="text-cyan-300/80">vaos-eu-cra-v1</code>
        </footer>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "neutral";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "amber"
        ? "text-amber-400"
        : "text-neutral-300";
  return (
    <div className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-5 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#B5532C] mb-2">
        {label}
      </p>
      <p className={`font-serif text-[28px] tracking-tight ${color}`}>
        {value}
      </p>
    </div>
  );
}
