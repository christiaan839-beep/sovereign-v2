import Link from "next/link";
import { ArrowRight, Check, X, Minus } from "lucide-react";
import type { Metadata } from "next";

/**
 * /vs/compare — Full comparison matrix (Cook 159).
 *
 * Side-by-side feature matrix vs every major competitor.
 * Designed for skim by a buyer evaluating Sovereign against:
 *
 *   - Vanta / Drata (compliance scoreboards — same buyer, no crypto)
 *   - Lindy / Clay / Manus / CrewAI / Relevance (AI agents — no audit)
 *   - n8n / Make / Zapier / Bardeen (workflow — no AI verification)
 *   - HubSpot / Apollo / Jasper (vertical — no crypto, no audit)
 *
 * Distinct from /vs/[slug] which targets one competitor each.
 */

export const metadata: Metadata = {
  title:
    "Sovereign vs Vanta · Drata · Lindy · Clay · Manus · CrewAI · Sovereign Matrix",
  description:
    "Side-by-side comparison. Sovereign Matrix is the only AI agent platform that produces cryptographically-signed receipts auditors verify in their own browser.",
  alternates: { canonical: "/vs/compare" },
};

type Cell = "yes" | "partial" | "no";

interface FeatureRow {
  category: string;
  feature: string;
  detail: string;
  values: Record<string, Cell>;
}

const COMPETITORS = [
  { id: "sovereign", name: "Sovereign Matrix", highlight: true },
  { id: "vanta", name: "Vanta" },
  { id: "drata", name: "Drata" },
  { id: "lindy", name: "Lindy" },
  { id: "clay", name: "Clay" },
  { id: "manus", name: "Manus" },
  { id: "crewai", name: "CrewAI" },
];

const ROWS: FeatureRow[] = [
  // ── Cryptographic moat ────────────────────────────────────────────────
  {
    category: "Cryptographic moat",
    feature: "Signed receipt per agent decision",
    detail: "HMAC-SHA256 + Ed25519 over canonical projection",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Cryptographic moat",
    feature: "Merkle inclusion proof",
    detail: "Receipt tied to a tamper-evident chain",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Cryptographic moat",
    feature: "ZK pass-rate proof (cross-tenant)",
    detail: "Industry consortium verification without raw-data sharing",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Cryptographic moat",
    feature: "Anonymous-credential auditor seats",
    detail: "Auditor verifies receipts without seeing tenant id",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Cryptographic moat",
    feature: "Verifiable model fingerprint",
    detail: "Detects silent provider-side model swaps",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },

  // ── Regulatory mapping ────────────────────────────────────────────────
  {
    category: "Regulatory packs",
    feature: "SOC 2 Type 2 continuous monitor",
    detail: "Live posture board (vs annual screenshot)",
    values: {
      sovereign: "yes",
      vanta: "yes",
      drata: "yes",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Regulatory packs",
    feature: "EU CSRD / ESRS disclosure pack",
    detail: "E1-E5 + S1-S4 + G1 datapoints mapped",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Regulatory packs",
    feature: "Fed SR 11-7 / PRA SS1/23 model risk",
    detail: "Drift detector + bias audit + MRMG bundles",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Regulatory packs",
    feature: "21 CFR Part 11 + ICH GCP",
    detail: "ALCOA+ trails + multi-party e-signatures",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Regulatory packs",
    feature: "NERC CIP + FedRAMP",
    detail: "OT-security + federal procurement vehicles",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Regulatory packs",
    feature: "NAIC AI Bias (insurance)",
    detail: "Decisional traceability for claims AI",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },

  // ── AI agent capability ──────────────────────────────────────────────
  {
    category: "AI agents",
    feature: "Multi-LLM cascade router",
    detail: "Ollama → Cerebras → NIM → Claude fallback",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "partial",
      clay: "partial",
      manus: "yes",
      crewai: "partial",
    },
  },
  {
    category: "AI agents",
    feature: "5-layer output verifier",
    detail: "LlamaGuard + PII + content policy + quality + trust gate",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "AI agents",
    feature: "Hallucination detector",
    detail: "Verifies every claim ties to source data",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "AI agents",
    feature: "Drift detector + shadow-run",
    detail: "Compares against baseline + previous deploy",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "AI agents",
    feature: "Multi-party attestation (e-signatures)",
    detail: "21 CFR Part 11 §11.50 compliant",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },

  // ── Distribution ─────────────────────────────────────────────────────
  {
    category: "Distribution",
    feature: "MCP server published",
    detail: "External agents call Sovereign primitives",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Distribution",
    feature: "OpenAPI 3.1 at /.well-known",
    detail: "Auto-discovered by every modern integration",
    values: {
      sovereign: "yes",
      vanta: "partial",
      drata: "partial",
      lindy: "partial",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Distribution",
    feature: "Self-serve audit + advisory SKUs",
    detail: "$99-$999 small-ticket revenue without sales call",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "yes",
      clay: "yes",
      manus: "partial",
      crewai: "yes",
    },
  },

  // ── Operational ──────────────────────────────────────────────────────
  {
    category: "Operations",
    feature: "Per-tenant data residency (US / EU / UK)",
    detail: "Tenant routing primitive",
    values: {
      sovereign: "yes",
      vanta: "partial",
      drata: "partial",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Operations",
    feature: "Envelope encryption (KEK/DEK split)",
    detail: "AES-256-GCM per-tenant DEK protected by KEK",
    values: {
      sovereign: "yes",
      vanta: "partial",
      drata: "partial",
      lindy: "partial",
      clay: "partial",
      manus: "partial",
      crewai: "partial",
    },
  },
  {
    category: "Operations",
    feature: "Right-of-erasure cascade (GDPR)",
    detail: "22-table cascade + audit-log retention with hashed user_id",
    values: {
      sovereign: "yes",
      vanta: "yes",
      drata: "yes",
      lindy: "partial",
      clay: "partial",
      manus: "no",
      crewai: "no",
    },
  },
  {
    category: "Operations",
    feature: "Open codebase visible to design partners",
    detail: "PR-level transparency, no black box",
    values: {
      sovereign: "yes",
      vanta: "no",
      drata: "no",
      lindy: "no",
      clay: "no",
      manus: "no",
      crewai: "partial",
    },
  },
];

const CATEGORIES = Array.from(new Set(ROWS.map((r) => r.category)));

function CellIcon({ value }: { value: Cell }) {
  if (value === "yes")
    return <Check className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (value === "no") return <X className="w-4 h-4 text-rose-400/40 mx-auto" />;
  return <Minus className="w-4 h-4 text-amber-400/60 mx-auto" />;
}

export default function CompareMatrixPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/investors"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Investors
            </Link>
            <Link
              href="/savings"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Savings calculator
            </Link>
            <Link
              href="/demo/verify-receipt"
              className="text-xs px-4 py-2 rounded-full bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
            >
              Verify demo
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-7xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-4">
          Comparison Matrix
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          Sovereign <span className="text-cyan-400">vs every alternative.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Vanta and Drata sell compliance scoreboards but ship no cryptographic
          primitive — auditors trust their screenshot. Lindy, Clay, Manus,
          CrewAI ship AI agents but no audit trail an examiner can verify.
          Of the alternatives compared below, Sovereign is the one at the
          intersection — scroll the matrix and check the row yourself.
        </p>
      </header>

      {CATEGORIES.map((cat) => (
        <section key={cat} className="max-w-7xl mx-auto px-6 py-8">
          <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-4">
            {cat}
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.03] sticky top-16">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium min-w-[280px]">
                    Feature
                  </th>
                  {COMPETITORS.map((c) => (
                    <th
                      key={c.id}
                      className={`text-center px-3 py-3 font-medium ${
                        c.highlight ? "text-cyan-400" : "text-neutral-500"
                      }`}
                    >
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.filter((r) => r.category === cat).map((r) => (
                  <tr
                    key={r.feature}
                    className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{r.feature}</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {r.detail}
                      </p>
                    </td>
                    {COMPETITORS.map((c) => (
                      <td
                        key={c.id}
                        className={`px-3 py-3 ${
                          c.highlight ? "bg-cyan-500/[0.02]" : ""
                        }`}
                      >
                        <CellIcon value={r.values[c.id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <p className="text-xs text-neutral-400 leading-relaxed">
            <span className="text-emerald-400 inline-flex items-center gap-1.5">
              <Check className="w-3 h-3" /> Yes
            </span>{" "}
            — ships the capability natively.{" "}
            <span className="text-amber-400 inline-flex items-center gap-1.5">
              <Minus className="w-3 h-3" /> Partial
            </span>{" "}
            — adjacent capability or third-party-integration only.{" "}
            <span className="text-rose-400 inline-flex items-center gap-1.5">
              <X className="w-3 h-3" /> No
            </span>{" "}
            — not in the product as of {new Date().getFullYear()}. Sources: each
            competitor&rsquo;s public documentation, security page, and
            engineering blog. Send corrections to{" "}
            <a
              href="mailto:founder@sovereignmatrix.agency"
              className="text-cyan-400 underline"
            >
              founder@sovereignmatrix.agency
            </a>
            .
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            The only platform at the intersection.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Compliance + AI agents + cryptographic chain-of-custody. Vanta has
            two of three. Lindy has one. Sovereign has all three.
          </p>
          <Link
            href="/demo/verify-receipt"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Verify a real receipt
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-7xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/savings" className="hover:text-neutral-300">
            Savings calculator
          </Link>
          <Link href="/investors" className="hover:text-neutral-300">
            Investors
          </Link>
          <Link href="/demo/verify-receipt" className="hover:text-neutral-300">
            Verify demo
          </Link>
        </div>
      </footer>
    </div>
  );
}
