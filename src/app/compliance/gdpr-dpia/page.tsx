import type { Metadata } from "next";
import Link from "next/link";
import {
  buildDpia,
  toMarkdown,
  type ProcessingActivity,
} from "@sovereign-matrix/gdpr-dpia";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";
import { packageUrl } from "@/lib/package-links";

export const metadata: Metadata = {
  title: "GDPR DPIA + RoPA — Live Preview · Sovereign Matrix",
  description:
    "Apache 2.0 GDPR Article 35 DPIA + Article 30 RoPA exporter. Operator-declared activities + VAOS receipts in, regulator-ready report out. Live preview.",
};

const ACTIVITIES: ProcessingActivity[] = [
  {
    id: "diag-triage",
    name: "AI-Assisted Diagnostic Triage",
    purpose:
      "Real-time triage recommendations to emergency-department clinicians based on patient symptoms.",
    dataSubjectCategories: ["patients", "emergency-department staff"],
    dataCategories: [
      "demographics",
      "vital signs",
      "presenting symptoms",
      "medical-history snippet",
    ],
    specialCategories: ["health data (Art. 9(1)(h))"],
    recipients: ["internal clinicians"],
    retention: "90 days after discharge",
    securityMeasures: [
      "AES-256-GCM at rest",
      "TLS 1.3 in transit",
      "RBAC + immutable audit log",
    ],
    legalBasis: "vital-interests",
  },
  {
    id: "patient-chatbot",
    name: "Patient FAQ Chatbot",
    purpose: "Answer patient questions about appointments and medications.",
    dataSubjectCategories: ["patients"],
    dataCategories: ["name", "appointment context", "question text"],
    specialCategories: [],
    recipients: ["internal support team"],
    transfers: [{ country: "United States", safeguard: "SCCs" }],
    retention: "30 days",
    securityMeasures: ["TLS 1.3", "no audio recording", "consent-based"],
    legalBasis: "consent",
  },
];

const SAMPLE_RECEIPTS: ReceiptRecord[] = (() => {
  const base = new Date("2026-01-15T00:00:00Z").getTime();
  const out: ReceiptRecord[] = [];
  const packs = [
    "gdpr-art-9-health",
    "gdpr-art-32-security",
    "encryption-aes",
    "soc2-cc6-rbac",
    "audit-log",
    "consent-management",
    "tls-1.3",
  ];
  for (let i = 0; i < 412; i++) {
    out.push({
      verdictId: `v_${i.toString(36).padStart(6, "0")}`,
      overall: "pass" as const,
      issuedAt: new Date(base + i * 1000 * 60 * 15).toISOString(),
      agentSlug: "diag-agent",
      pack: packs[i % packs.length] as string,
    } as ReceiptRecord);
  }
  return out;
})();

export default function GdprDpiaPreview() {
  const report = buildDpia({
    controller: {
      name: "Sample Operator — Acme Health AI Ltd",
      address: "Königsallee 1, Düsseldorf, Germany",
      email: "privacy@acmehealth.example",
      dpoName: "Dr. Anna Müller",
      dpoEmail: "dpo@acmehealth.example",
    },
    activities: ACTIVITIES,
    risks: {
      "diag-triage": {
        necessityProportionality:
          "Triage decisions save minutes that save lives. No less-intrusive alternative meets the latency budget.",
        risks: [
          {
            description:
              "Unauthorized internal access to patient symptom data.",
            likelihood: "low",
            severity: "high",
          },
          {
            description:
              "Algorithmic bias against under-represented demographics.",
            likelihood: "medium",
            severity: "medium",
          },
        ],
        mitigations: [
          {
            description:
              "AES-256-GCM at rest, TLS 1.3 in transit, RBAC + audit log.",
            evidencePackPrefixes: ["gdpr-art-32", "encryption", "soc2-cc6"],
          },
          {
            description:
              "Monthly bias-audit on demographic-stratified accuracy.",
            evidencePackPrefixes: ["fairness-eval", "bias-audit"],
          },
        ],
        residualRisk: "low",
        priorConsultationRequired: false,
      },
      "patient-chatbot": {
        necessityProportionality:
          "Reduces support-team load by 60%; alternative is longer wait times.",
        risks: [
          {
            description: "US transfer exposes data to FISA 702 requests.",
            likelihood: "low",
            severity: "medium",
          },
        ],
        mitigations: [
          {
            description: "EU Commission Standard Contractual Clauses.",
            evidencePackPrefixes: ["sccs", "transfer-impact"],
          },
        ],
        residualRisk: "low",
        priorConsultationRequired: false,
      },
    },
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
            GDPR DPIA + RoPA,
            <br />
            <em className="not-italic text-[#B5532C]">
              generated from receipts.
            </em>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] mb-3">
            Article 35 DPIA + Article 30 RoPA generated from operator- declared
            processing activities + a sample receipt set, using{" "}
            <code className="font-mono text-[14px] text-cyan-300/90">
              @sovereign-matrix/gdpr-dpia
            </code>
            .
          </p>
          <p className="text-[14px] text-neutral-500 leading-relaxed">
            High-residual-risk activities automatically flagged for Article 36
            prior consultation. OneTrust / TrustArc charge $10-100K/yr for the
            equivalent.
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
            {`npm install @sovereign-matrix/gdpr-dpia @sovereign-matrix/verifiable-receipts`}
          </pre>
        </div>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            Summary
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Stat
              label="Processing activities"
              value={report.summary.activitiesTotal}
            />
            <Stat
              label="High residual-risk"
              value={report.summary.highResidualRiskActivities}
              tone={
                report.summary.highResidualRiskActivities > 0
                  ? "amber"
                  : "emerald"
              }
            />
            <Stat
              label="Prior-consultation req."
              value={report.summary.priorConsultationsRequired}
              tone={
                report.summary.priorConsultationsRequired > 0
                  ? "amber"
                  : "emerald"
              }
            />
            <Stat
              label="Article 9 (special-category)"
              value={report.summary.specialCategoriesActivities}
            />
            <Stat
              label="Third-country transfers"
              value={report.summary.thirdCountryTransfers}
            />
            <Stat
              label="Receipts evidencing mitigations"
              value={report.summary.totalEvidenceReceipts}
            />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Article 30 — Records of Processing
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            Every processing activity documented per Article 30(1).
          </p>
          <div className="space-y-4">
            {report.ropa.map((a) => (
              <div
                key={a.id}
                className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] p-5"
              >
                <div className="flex items-baseline gap-3 mb-3 flex-wrap">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#B5532C]">
                    {a.id}
                  </span>
                  <h3 className="font-serif text-[20px] tracking-tight">
                    {a.name}
                  </h3>
                  {a.specialCategories.length > 0 && (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-amber-500/30 text-amber-400 bg-amber-500/[0.04]">
                      Art. 9 special-category
                    </span>
                  )}
                </div>
                <p className="text-[14px] text-neutral-300 mb-3">{a.purpose}</p>
                <div className="grid sm:grid-cols-2 gap-3 text-[12px] text-neutral-400">
                  <div>
                    <span className="text-neutral-500">Data subjects:</span>{" "}
                    {a.dataSubjectCategories.join(", ")}
                  </div>
                  <div>
                    <span className="text-neutral-500">Data categories:</span>{" "}
                    {a.dataCategories.join(", ")}
                  </div>
                  <div>
                    <span className="text-neutral-500">
                      Legal basis (Art. 6):
                    </span>{" "}
                    <span className="font-mono">{a.legalBasis}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Retention:</span>{" "}
                    {a.retention}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Article 35 — DPIA
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            Risk assessment per activity. Mitigation evidence counts derived
            from receipt pack-prefix matches.
          </p>
          <div className="space-y-4">
            {report.dpia.map((d) => (
              <div
                key={d.activityId}
                className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] p-5"
              >
                <div className="flex items-baseline gap-3 mb-3 flex-wrap">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#B5532C]">
                    {d.activityId}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                      d.residualRisk === "high"
                        ? "border-red-500/40 text-red-300 bg-red-500/[0.06]"
                        : d.residualRisk === "medium"
                          ? "border-amber-500/30 text-amber-400 bg-amber-500/[0.04]"
                          : "border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.04]"
                    }`}
                  >
                    residual risk: {d.residualRisk}
                  </span>
                  {d.priorConsultationRequired && (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-red-500/40 text-red-300 bg-red-500/[0.06]">
                      Art. 36 prior consultation required
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-neutral-400 mb-3">
                  <span className="text-neutral-500">Necessity:</span>{" "}
                  {d.necessityProportionality}
                </p>
                <p className="text-[12px] font-mono text-neutral-500">
                  {d.evidenceCount} receipt(s) evidencing mitigations
                </p>
              </div>
            ))}
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
            GDPR has been enforced since 2018
          </p>
          <h3 className="font-serif text-3xl md:text-4xl mb-4 tracking-tight">
            Three lines around your AI call.
            <br />
            <em className="not-italic text-[#B5532C]">
              DPIA-ready evidence, automatic.
            </em>
          </h3>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#B5532C] text-white font-semibold text-[13px] rounded-[3px] hover:bg-[#C96234] transition-colors tracking-tight"
            >
              Start free — 50 runs/mo
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href={packageUrl("@sovereign-matrix/gdpr-dpia")}
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/[0.12] text-neutral-300 font-mono text-[13px] rounded-[3px] hover:text-white hover:border-white/25 transition-colors"
            >
              View source
            </Link>
            <Link
              href="/compliance/hipaa"
              className="inline-flex items-center gap-2 px-5 py-3 text-neutral-500 hover:text-white font-mono text-[13px] transition-colors"
            >
              See HIPAA →
            </Link>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/[0.04] text-[12px] font-mono text-neutral-600">
          Generated by{" "}
          <code className="text-cyan-300/80">@sovereign-matrix/gdpr-dpia</code>{" "}
          v0.1.0 · Apache 2.0 · schema{" "}
          <code className="text-cyan-300/80">vaos-gdpr-dpia-v1</code>
        </footer>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "emerald" | "amber";
}) {
  const colorClass =
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
      <p className={`font-serif text-[28px] tracking-tight ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}
