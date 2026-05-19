import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Compliance · Dashboard · Sovereign Matrix",
  description:
    "Operator dashboard for the six regulatory-framework exporters. Generate auditor-ready reports from your tenant's signed receipts.",
};

const EXPORTERS = [
  {
    href: "/dashboard/compliance/annex-iv",
    pill: "EU regulation",
    title: "EU AI Act Annex IV",
    description:
      "Article 11 technical documentation. §3/§4/§6/§9 from receipts; §1/§2/§5/§7/§8 operator-authored stubs.",
    enforcement: "Enforcement: 2026-08-02",
  },
  {
    href: "/dashboard/compliance/iso-42001",
    pill: "AIMS standard",
    title: "ISO/IEC 42001:2023",
    description:
      "AI management-system clauses 4-10 + the 38-control Annex A matrix.",
    enforcement: "Cert bodies: BSI / TÜV SÜD throughout 2026",
  },
  {
    href: "/dashboard/compliance/nist-ai-rmf",
    pill: "US federal",
    title: "NIST AI RMF 1.0",
    description:
      "GOVERN / MAP / MEASURE / MANAGE profile with subcategory-level evidence + seven trustworthy-AI characteristics.",
    enforcement: "Federal procurement clauses",
  },
  {
    href: "/dashboard/compliance/soc2",
    pill: "Audit binder",
    title: "SOC 2 Trust Service Criteria",
    description:
      "AICPA TSC 2017 evidence binder for Type II audits with per-criterion days-of-coverage analysis.",
    enforcement: "Most-requested B2B procurement document",
  },
  {
    href: "/dashboard/compliance/gdpr-dpia",
    pill: "EU privacy",
    title: "GDPR DPIA + RoPA",
    description:
      "Article 35 Data Protection Impact Assessment + Article 30 Records of Processing Activities.",
    enforcement: "Enforced since 2018",
  },
  {
    href: "/dashboard/compliance/hipaa",
    pill: "US healthcare",
    title: "HIPAA Security Rule",
    description:
      "45 CFR § 164.308-318 evidence binder — administrative + physical + technical safeguards.",
    enforcement: "Enforced since 2003",
  },
  {
    href: "/dashboard/compliance/iso-23894",
    pill: "AI risk management",
    title: "ISO/IEC 23894:2023",
    description:
      "Risk scenarios scored via 5×5 likelihood × impact matrix, residual attenuated by receipt evidence.",
    enforcement: "Referenced by ISO 42001 as the canonical method",
  },
  {
    href: "/dashboard/compliance/eu-cra",
    pill: "EU cybersecurity",
    title: "EU Cyber Resilience Act",
    description:
      "Annex I (Part I + II) + Article 13/14 obligations for products with digital elements.",
    enforcement: "Vulnerability reporting 2026-09-11; full 2027-12-11",
  },
  {
    href: "/dashboard/compliance/ai-constitution",
    pill: "Novel primitive",
    title: "Constitutional AI Anchoring",
    description:
      "Sign an immutable AI constitution; audit receipts against article-level violations.",
    enforcement:
      "AGI / ASI accountability primitive — first OSS implementation",
  },
];

export default function ComplianceDashboardHub() {
  return (
    <div className="px-6 md:px-10 py-10 max-w-7xl mx-auto">
      <div className="mb-10 flex items-baseline gap-3 flex-wrap">
        <ShieldCheck className="w-5 h-5 text-[#B5532C]" aria-hidden="true" />
        <h1 className="font-serif text-3xl md:text-4xl tracking-tight">
          Compliance exporters
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500 mt-2">
          6 frameworks · one receipt set
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {EXPORTERS.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="group relative rounded-[8px] border border-white/[0.06] bg-white/[0.015] p-5 hover:border-[#B5532C]/30 hover:bg-white/[0.025] transition-colors"
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#B5532C] mb-3">
              {e.pill}
            </p>
            <h2 className="font-serif text-[22px] tracking-tight mb-2 group-hover:text-white">
              {e.title}
            </h2>
            <p className="text-[13px] text-neutral-400 leading-[1.55] mb-4">
              {e.description}
            </p>
            <p className="text-[11px] font-mono text-neutral-500 mb-3">
              {e.enforcement}
            </p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[12px] font-mono text-neutral-500">
                Generate report
              </span>
              <ArrowRight
                className="w-3.5 h-3.5 text-[#B5532C] transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-[6px] border border-white/[0.06] bg-black/40 px-5 py-4">
        <p className="text-[12px] text-neutral-400 leading-relaxed max-w-3xl">
          Reports are generated from your tenant&apos;s signed receipts when
          available, with a 512-receipt sample set as fallback while you wire
          your AI calls through one of the{" "}
          <Link
            href="/start"
            className="text-cyan-300/90 hover:text-cyan-300 underline decoration-cyan-500/30"
          >
            @sovereign-matrix/*-receipts
          </Link>{" "}
          SDK wrappers. Every report is byte-deterministic — an auditor with the
          same receipts can reproduce the output character-for-character.
        </p>
      </div>
    </div>
  );
}
