import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Compliance Exporters — Sovereign Matrix",
  description:
    "Apache 2.0 OSS exporters for the four major AI compliance frameworks: EU AI Act Annex IV, ISO/IEC 42001 AIMS, NIST AI RMF 1.0, SOC 2 evidence binder. Receipts in, regulator-ready report out.",
};

const EXPORTERS = [
  {
    href: "/compliance/annex-iv",
    npm: "@sovereign-matrix/annex-iv",
    pill: "EU regulation",
    title: "EU AI Act Annex IV",
    description:
      "Article 11 technical-documentation. §3/§4/§6/§9 derived from receipts; §1/§2/§5/§7/§8 operator-authored stubs with regulation-clause schema hints.",
    enforcement: "Enforcement: 2026-08-02 (high-risk AI providers)",
    vendor: "$50-200K/yr closed-source",
  },
  {
    href: "/compliance/iso-42001",
    npm: "@sovereign-matrix/iso-42001",
    pill: "AIMS standard",
    title: "ISO/IEC 42001:2023",
    description:
      "AI management-system clauses 4-10 + Annex A 38-control matrix. Statement-of-applicability operator-overridable.",
    enforcement: "Adoption: BSI / TÜV SÜD certifications throughout 2026",
    vendor: "$50-200K/yr closed-source",
  },
  {
    href: "/compliance/nist-ai-rmf",
    npm: "@sovereign-matrix/nist-ai-rmf",
    pill: "US federal",
    title: "NIST AI RMF 1.0",
    description:
      "GOVERN / MAP / MEASURE / MANAGE profile with subcategory-level evidence + seven trustworthy-AI characteristics.",
    enforcement:
      "Adoption: US federal procurement clauses + state-level AI laws",
    vendor: "$50-200K/yr closed-source",
  },
  {
    href: "/compliance/soc2",
    npm: "@sovereign-matrix/soc2-evidence",
    pill: "Audit binder",
    title: "SOC 2 Trust Service Criteria",
    description:
      "AICPA TSC 2017 evidence binder for Type II audits. CC1-CC9 + A1 + PI1 + C1 + P-series. Per-criterion days-of-coverage gap analysis.",
    enforcement: "Most-requested B2B procurement document worldwide",
    vendor: "Vanta / Drata: $5-50K/yr closed-source",
  },
  {
    href: "/compliance/gdpr-dpia",
    npm: "@sovereign-matrix/gdpr-dpia",
    pill: "EU privacy",
    title: "GDPR DPIA + RoPA",
    description:
      "Article 35 Data Protection Impact Assessment + Article 30 Records of Processing Activities. Auto-flags Article 36 prior consultation when residual risk is high.",
    enforcement: "Enforced since 2018 — every EU controller needs DPIA + RoPA",
    vendor: "OneTrust / TrustArc: $10-100K/yr closed-source",
  },
  {
    href: "/compliance/hipaa",
    npm: "@sovereign-matrix/hipaa-security",
    pill: "US healthcare",
    title: "HIPAA Security Rule",
    description:
      "45 CFR § 164.308-318 evidence binder. Administrative + physical + technical safeguards. REQUIRED specs without evidence surfaced as OCR-audit findings.",
    enforcement:
      "Enforced since 2003 — every ePHI handler audited periodically",
    vendor: "HITRUST / Compliancy Group: $20-100K/yr closed-source",
  },
  {
    href: "/compliance/iso-23894",
    npm: "@sovereign-matrix/iso-23894",
    pill: "AI risk management",
    title: "ISO/IEC 23894:2023",
    description:
      "The AI-specific adaptation of ISO 31000. 5×5 likelihood × impact matrix; residual risk attenuated by receipt evidence. Operator-explainable, no black-box.",
    enforcement: "Referenced by ISO 42001 as the canonical risk-mgmt method",
    vendor: "Bundled in closed-source AIMS modules: $30-100K/yr",
  },
  {
    href: "/compliance/eu-cra",
    npm: "@sovereign-matrix/eu-cra",
    pill: "EU cybersecurity",
    title: "EU Cyber Resilience Act",
    description:
      "Regulation (EU) 2024/2847 — every product with digital elements on the EU market. Annex I (Part I + II) + Article 13/14 + post-market obligations.",
    enforcement: "Vulnerability reporting: 2026-09-11 · full: 2027-12-11",
    vendor: "Future closed-source bundles: $30-150K/yr expected",
  },
  {
    href: "/compliance/ai-constitution",
    npm: "@sovereign-matrix/ai-constitution",
    pill: "Novel primitive",
    title: "Constitutional AI anchoring",
    description:
      "Cryptographically-anchored AI constitutions. Sign an immutable policy; every receipt commits to its SHA-256 hash. The inference-time analogue to Anthropic's Constitutional AI training methodology.",
    enforcement: "AGI / ASI accountability primitive — genuinely first OSS",
    vendor: "No existing OSS or closed-source equivalent",
  },
];

export default function ComplianceHub() {
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
            href="/"
            className="text-[12px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors tracking-tight"
          >
            ← Sovereign Matrix
          </Link>
        </div>

        <div className="max-w-3xl mb-16">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-5">
            Compliance exporters · Apache 2.0
          </p>
          <h1 className="font-serif text-5xl md:text-6xl leading-[1.04] tracking-[-0.02em] mb-6">
            Eight frameworks
            <br />
            <em className="not-italic text-[#B5532C]">
              + one novel primitive.
            </em>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] mb-3">
            The same VAOS receipts that prove an individual AI call was
            defensible can be assembled into auditor-ready reports against the
            four major AI compliance frameworks. Apache 2.0 OSS — closed- source
            vendors charge $50-200K/yr for each one.
          </p>
          <p className="text-[14px] text-neutral-500 leading-relaxed">
            Every report is byte-deterministic from the receipt set. An external
            auditor with your receipts can reproduce the report
            character-for-character — that&apos;s what makes them defensible at
            regulator review.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {EXPORTERS.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="group relative rounded-[8px] border border-white/[0.06] bg-white/[0.015] p-6 hover:border-[#B5532C]/30 hover:bg-white/[0.025] transition-colors"
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#B5532C] mb-3">
                {e.pill}
              </p>
              <h2 className="font-serif text-[24px] md:text-[28px] tracking-tight mb-3 group-hover:text-white">
                {e.title}
              </h2>
              <p className="text-[14px] text-neutral-400 leading-[1.55] mb-4">
                {e.description}
              </p>
              <p className="text-[11px] font-mono text-neutral-500 mb-1">
                {e.enforcement}
              </p>
              <p className="text-[11px] font-mono text-neutral-600 mb-5">
                {e.vendor}
              </p>
              <div className="flex items-center justify-between">
                <code className="text-[11px] font-mono text-cyan-300/80">
                  {e.npm}
                </code>
                <span
                  aria-hidden="true"
                  className="text-[#B5532C] transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <section className="mt-16 rounded-[8px] border border-white/[0.06] bg-black/40 p-6 md:p-8">
          <h2 className="font-serif text-[26px] mb-3 tracking-tight">
            How they relate
          </h2>
          <p className="text-[14px] text-neutral-400 leading-relaxed max-w-3xl mb-5">
            One receipt can evidence multiple frameworks simultaneously. A
            single Guardian pack tag like{" "}
            <code className="text-cyan-300/90">iso42001-aims</code> maps to ISO
            42001 Annex A controls,{" "}
            <code className="text-cyan-300/90">euAiAct-art-9</code> maps to EU
            AI Act Annex IV § 5 plus NIST AI RMF MAP-1.1, and{" "}
            <code className="text-cyan-300/90">soc2-cc6-iam</code> maps to SOC 2
            CC6.1-CC6.3 plus NIST AI RMF GOVERN-6.1.
          </p>
          <p className="text-[13px] text-neutral-500 leading-relaxed max-w-3xl">
            Tag receipts once. Generate every framework&apos;s report.
          </p>
        </section>

        <section className="mt-12 mb-8 rounded-[10px] border border-[#B5532C]/20 bg-[#1a0f0a]/40 px-6 md:px-10 py-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#B5532C] mb-4">
            Start producing receipts
          </p>
          <h3 className="font-serif text-3xl mb-4 tracking-tight">
            Three lines around your AI call.
            <br />
            <em className="not-italic text-[#B5532C]">
              Eight frameworks worth of evidence.
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
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/[0.12] text-neutral-300 font-mono text-[13px] rounded-[3px] hover:text-white hover:border-white/25 transition-colors"
            >
              Pricing
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
