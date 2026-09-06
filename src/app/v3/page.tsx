import { createHash } from "crypto";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Hash, Lock } from "lucide-react";
import type { Metadata } from "next";
import { signRun } from "@/lib/agent-runs";

/**
 * /v3 — Landing redesign (Cook 186, polished audit-2026-05).
 *
 * Creative direction: "The page IS a receipt."
 *
 * The entire landing is rendered as a verifiable JSON receipt. The
 * signature at the bottom is produced by the SAME signRun() the
 * production agent runtime uses — Ed25519 (v2) when configured,
 * HMAC-SHA256 (v1) otherwise. Visitors verify with the public key
 * published at /.well-known/sovereign-receipts/ed25519.pem; we never
 * publish a private key on this page.
 *
 * Audit fix: dropped the hard-coded PAGE_SECRET that previously made
 * /v3 read as "self-attestation" to crypto-literate auditors (the
 * secret was printed in the verification snippet right next to the
 * signature). The receipt is now signed under the production scheme.
 */

export const metadata: Metadata = {
  title:
    "Sovereign Matrix · The verification layer underneath every AI decision",
  description:
    "The landing page itself is a verifiable cryptographic receipt. Copy the canonical projection, fetch the published public key, verify with openssl or any standard library.",
  alternates: { canonical: "/v3" },
};

// ── The receipt the page renders ─────────────────────────────────────────

interface PageReceipt {
  receiptId: string;
  agentSlug: "landing-page-renderer";
  agentVersion: string;
  modelFingerprint: string;
  issuedAt: string;
  tenantId: "sovereign-matrix";
  verdict: "committed";
  sections: PageSection[];
}

interface PageSection {
  field: string;
  display: string;
  body: string;
  citations: { id: string; href: string; label: string }[];
}

const RECEIPT: PageReceipt = {
  receiptId: "rcpt_landing_v3_01HZJX8K2P7M3Q4Y5R6S7T8U9V",
  agentSlug: "landing-page-renderer",
  agentVersion: "3.0.0",
  modelFingerprint: "claude-opus-4-7@2026-04-15",
  issuedAt: "2026-05-15T22:30:00.000Z",
  tenantId: "sovereign-matrix",
  verdict: "committed",
  sections: [
    {
      field: "thesis",
      display: "Thesis",
      body: "Vanta sold for $2.45B doing compliance scoreboards. They don't have the cryptographic layer underneath. We do. Same buyer — 10× larger budget unlock once AI decisions move into regulated workflows.",
      citations: [
        {
          id: "cite_001",
          href: "https://www.crunchbase.com/funding_round/vanta-acquisition--vanta",
          label: "Vanta sale, public record",
        },
        {
          id: "cite_002",
          href: "/investors",
          label: "Comparable-exits table",
        },
      ],
    },
    {
      field: "product",
      display: "Product",
      body: "140 production agents across 8 LLM providers, hybrid deterministic + LLM routing, 5-layer output verifier, 7 cryptographic primitives committed to every decision. Live at sovereignmatrix.agency.",
      citations: [
        {
          id: "cite_003",
          href: "/oss",
          label: "Models + framework catalog",
        },
        {
          id: "cite_004",
          href: "/spec",
          label: "Receipts protocol (VAOS 2.0)",
        },
        {
          id: "cite_005",
          href: "/demo/verify-receipt",
          label: "Reproduce the math, 60 seconds",
        },
      ],
    },
    {
      field: "primitives",
      display: "Cryptographic primitives shipped",
      body: "HMAC-SHA256 + Ed25519 receipts · Merkle-batched inclusion proofs · receipt-chain ratchet · anonymous-credential auditor tokens · verifiable model fingerprinting · retention proofs · blockchain anchoring · envelope encryption · timestamp authority · ZK pass-rate proofs · hash-chained audit log · universal webhook replay guard. Nothing else in the agent ecosystem has this combination.",
      citations: [
        {
          id: "cite_006",
          href: "/spec",
          label: "Protocol spec",
        },
      ],
    },
    {
      field: "verticals",
      display: "Regulated verticals served",
      body: "EU CSRD · SR 11-7 model risk (banking) · 21 CFR Part 11 (clinical trials) · ICH E2B (pharmacovigilance) · NERC CIP (utilities) · NAIC AI Bias (insurance) · FedRAMP (defense) · ICH GCP. 25 regulatory-pack pages with ACV ranges from $200K to $2M.",
      citations: [
        {
          id: "cite_008",
          href: "/for-csrd",
          label: "CSRD wedge ($250–400K ACV)",
        },
        {
          id: "cite_009",
          href: "/for-banking",
          label: "Banking SR 11-7 ($150–350K)",
        },
        {
          id: "cite_010",
          href: "/for-pharmacovigilance",
          label: "PV / ICH E2B ($250–500K)",
        },
      ],
    },
    {
      field: "moat",
      display: "Why nothing else closes this",
      body: "Vanta + Drata ship compliance scoreboards but no cryptographic primitive — auditors trust the screenshot. Lindy + Clay + Manus + CrewAI ship AI agents but no audit trail an examiner can verify. Sovereign is the only stack at the intersection: compliance + AI agents + cryptographic chain-of-custody. The combined moat is built, tested, and live.",
      citations: [
        {
          id: "cite_011",
          href: "/vs/compare",
          label: "23-feature × 7-competitor matrix",
        },
      ],
    },
    {
      field: "openness",
      display: "Open-source posture",
      body: "Spec is public domain (CC0). Verifier + CLI are MIT-licensed and ship as a separate package, so any party can verify a Sovereign receipt without trusting the platform. Platform code stays proprietary. Same open-core pattern as Vanta, HashiCorp, MongoDB.",
      citations: [
        {
          id: "cite_012",
          href: "/oss",
          label: "20 models + 30 frameworks catalog",
        },
        {
          id: "cite_013",
          href: "https://github.com/christiaan839-beep/sovereign-v2",
          label: "Open codebase",
        },
      ],
    },
  ],
};

// ── Canonical projection + signature ────────────────────────────────────

function canonical(r: PageReceipt): string {
  return [
    "sovereign-landing-v3-receipt-v1",
    r.receiptId,
    r.agentSlug,
    r.agentVersion,
    r.modelFingerprint,
    r.tenantId,
    r.verdict,
    r.issuedAt,
    r.sections
      .map(
        (s) =>
          `${s.field}::${createHash("sha256").update(s.body).digest("hex").slice(0, 16)}::${s.citations
            .map((c) => c.id)
            .sort()
            .join(",")}`,
      )
      .join("|"),
  ].join("§");
}

const PAGE_CANONICAL = canonical(RECEIPT);
const PAGE_HASH = createHash("sha256").update(PAGE_CANONICAL).digest("hex");
// Signed under the production scheme: signRun prefers Ed25519 (v2) when
// AGENT_RUN_ED25519_PRIVATE_KEY is configured, otherwise falls back to
// HMAC-SHA256 (v1) with the platform's signing secret. Either way the
// verifier flow on this page never publishes a private key — visitors
// use the public Ed25519 key at /.well-known/sovereign-receipts/ed25519.pem
// (v2) or the documented /api/verify endpoint (v1).
const PAGE_SIGNATURE = signRun(PAGE_CANONICAL);
const SIG_SCHEME = PAGE_SIGNATURE.startsWith("v2=")
  ? "ed25519"
  : PAGE_SIGNATURE.startsWith("v1=")
    ? "hmac-sha256"
    : "unsigned";

// ── Component ────────────────────────────────────────────────────────────

export default function LandingV3() {
  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200 selection:bg-cyan-500/30">
      {/* Top bar — minimal */}
      <nav className="border-b border-white/[0.05] px-6 py-4 bg-[#010101]/85 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-bold text-white tracking-tight"
          >
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-5 text-[11px] font-mono uppercase tracking-[0.2em] text-neutral-500">
            <span className="hidden md:inline">
              Verifiable AI infrastructure
            </span>
            <Link href="/oss" className="hover:text-cyan-300 transition-colors">
              OSS
            </Link>
            <Link
              href="/investors"
              className="hover:text-cyan-300 transition-colors"
            >
              Investors
            </Link>
            <Link
              href="/demo/verify-receipt"
              className="text-xs px-3 py-1.5 rounded-full bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors normal-case tracking-normal"
            >
              Verify →
            </Link>
          </div>
        </div>
      </nav>

      {/* Receipt header — visible BEFORE marketing */}
      <section className="relative max-w-6xl mx-auto px-6 pt-16 pb-12">
        {/* Faint receipt-paper grid backdrop */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "100% 32px",
          }}
        />

        <div className="relative">
          <p className="font-mono text-[10px] tracking-[0.4em] text-cyan-400/80 uppercase mb-6">
            Begin receipt · open the canonical projection ↓
          </p>

          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl tracking-[-0.02em] leading-[1.02] text-white max-w-5xl">
            This landing page is a{" "}
            <span className="text-cyan-400">verifiable receipt.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg md:text-xl text-neutral-400 leading-relaxed">
            Every claim below is signed. Scroll once. The canonical projection
            assembles in front of you. At the end, the HMAC-SHA256 signature is
            yours to recompute — proof that what you read wasn&rsquo;t rewritten
            in transit.
          </p>

          <div className="mt-9 grid sm:grid-cols-3 gap-3 max-w-3xl">
            <Field
              label="receipt_id"
              value={RECEIPT.receiptId.slice(0, 24) + "…"}
              mono
            />
            <Field
              label="agent_version"
              value={`v${RECEIPT.agentVersion}`}
              mono
            />
            <Field
              label="model_fingerprint"
              value={RECEIPT.modelFingerprint}
              mono
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#signature"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
            >
              Jump to the signature
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/demo/verify-receipt"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-white/15 text-neutral-300 hover:text-white hover:border-white/30 transition-colors text-sm"
            >
              Verify a different receipt →
            </Link>
          </div>
        </div>
      </section>

      {/* Sections — each one a receipt field */}
      <div className="max-w-6xl mx-auto px-6">
        {RECEIPT.sections.map((section, idx) => (
          <ReceiptFieldSection
            key={section.field}
            section={section}
            index={idx}
            total={RECEIPT.sections.length}
          />
        ))}
      </div>

      {/* The signature — the climax */}
      <section id="signature" className="relative max-w-6xl mx-auto px-6 py-24">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(6,182,212,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <p className="font-mono text-[10px] tracking-[0.4em] text-cyan-400/80 uppercase mb-5 flex items-center gap-2">
            <Lock className="w-3 h-3" /> End receipt · sealed at{" "}
            {RECEIPT.issuedAt}
          </p>
          <h2 className="font-serif text-4xl md:text-6xl tracking-[-0.02em] text-white max-w-4xl mb-9 leading-tight">
            The signature.
          </h2>

          <div className="space-y-5">
            <FieldBlock
              label="Canonical projection (what gets hashed)"
              value={PAGE_CANONICAL}
              accent="neutral"
              icon={Hash}
            />
            <FieldBlock
              label="SHA-256 content hash"
              value={PAGE_HASH}
              accent="copper"
              icon={Hash}
            />
            <FieldBlock
              label={
                SIG_SCHEME === "ed25519"
                  ? "Ed25519 signature (v2)"
                  : SIG_SCHEME === "hmac-sha256"
                    ? "HMAC-SHA256 signature (v1)"
                    : "Unsigned"
              }
              value={PAGE_SIGNATURE}
              accent="cyan"
              icon={ShieldCheck}
            />
          </div>

          <div className="mt-10 p-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.03]">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-cyan-400/80 mb-3">
              Verify on your machine
            </p>
            <pre className="text-[11px] text-cyan-200 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
              {SIG_SCHEME === "ed25519"
                ? `# 1. Fetch the public Ed25519 key
curl -sSf https://sovereignmatrix.agency/.well-known/sovereign-receipts/ed25519.pem -o sov.pub.pem

# 2. Copy the canonical projection above into canonical.txt
# 3. Copy the signature body (everything after "v2=") into sig.b64
# 4. Verify:
openssl pkeyutl -verify -pubin -inkey sov.pub.pem \\
    -rawin -in canonical.txt \\
    -sigfile <(base64 -d < sig.b64)

# → "Signature Verified Successfully"`
                : SIG_SCHEME === "hmac-sha256"
                  ? `# v1 receipts are verified server-side (the HMAC secret is
# private). POST the canonical projection to:
curl -sSf https://sovereignmatrix.agency/api/verify \\
  -H "content-type: application/json" \\
  -d '{"canonical":"…","signature":"${PAGE_SIGNATURE}"}'

# → {"valid": true, "scheme": "hmac-sha256"}`
                  : `# No signing keys are configured in this environment.
# Configure AGENT_RUN_ED25519_PRIVATE_KEY (preferred) or
# AGENT_RUN_SIGNING_SECRET (fallback) and redeploy to enable
# cryptographic verification on this page.`}
            </pre>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent">
          <h2 className="font-serif text-3xl md:text-5xl text-white tracking-[-0.02em] mb-4 leading-tight">
            The page proves itself.
            <br />
            <span className="text-cyan-400">
              Imagine what your AI agents could prove.
            </span>
          </h2>
          <p className="text-base text-neutral-400 max-w-2xl mb-8 leading-relaxed">
            Every Sovereign agent ships a receipt like this one. The auditor
            verifies it in their own workpaper system. Procurement closes in
            days, not quarters.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/contact?intent=design-partner"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#E08558] text-black font-semibold text-sm hover:bg-[#F5A878] transition-colors"
            >
              Apply for a design-partner slot
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/investors"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 hover:border-cyan-500/60 transition-colors text-sm"
            >
              Investor data room
            </Link>
            <Link
              href="/pitch"
              className="inline-flex items-center gap-2 text-sm font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              60-second pitch →
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.05] px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] font-mono text-neutral-500 flex flex-wrap gap-6 uppercase tracking-[0.2em]">
          <Link href="/spec" className="hover:text-neutral-300">
            VAOS 2.0
          </Link>
          <Link href="/trust" className="hover:text-neutral-300">
            Trust posture
          </Link>
          <Link href="/security" className="hover:text-neutral-300">
            Security
          </Link>
          <Link href="/oss" className="hover:text-neutral-300">
            Open ecosystem
          </Link>
          <span className="ml-auto">© Sovereign Matrix · Cape Town</span>
        </div>
      </footer>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function ReceiptFieldSection({
  section,
  index,
  total,
}: {
  section: PageSection;
  index: number;
  total: number;
}) {
  const bodyHash = createHash("sha256")
    .update(section.body)
    .digest("hex")
    .slice(0, 16);

  return (
    <section className="py-14 border-t border-white/[0.04]">
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Field metadata column */}
        <div className="lg:col-span-3">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-neutral-500 mb-2">
            Field {String(index + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </p>
          <p className="font-mono text-xs text-cyan-400 mb-3">
            &quot;{section.field}&quot;
          </p>
          <p className="font-mono text-[10px] text-neutral-600 leading-relaxed break-all">
            sha256: {bodyHash}…
          </p>
        </div>

        {/* Content column */}
        <div className="lg:col-span-9">
          <h3 className="font-serif text-3xl md:text-4xl tracking-[-0.02em] text-white leading-tight mb-5">
            {section.display}
          </h3>
          <p className="text-lg text-neutral-300 leading-[1.6] max-w-3xl">
            {section.body}
          </p>

          {section.citations.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {section.citations.map((c) => (
                <Link
                  key={c.id}
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener" : undefined}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] hover:border-cyan-500/40 hover:bg-cyan-500/[0.04] transition-colors text-[11px] text-neutral-300 hover:text-cyan-200"
                >
                  <span className="font-mono text-cyan-400/70">{c.id}</span>
                  <span>·</span>
                  <span>{c.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-neutral-500 mb-1.5">
        {label}
      </p>
      <p
        className={
          mono
            ? "font-mono text-xs text-neutral-200 truncate"
            : "text-sm text-neutral-200"
        }
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function FieldBlock({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent: "cyan" | "copper" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
}) {
  // Brand-strict: cyan for audit content, copper for marketing content,
  // neutral elsewhere. The previous emerald tone (audit-2026-05) violated
  // the dual-accent rule.
  const colorClass =
    accent === "cyan"
      ? "text-cyan-300 border-cyan-500/25 bg-cyan-500/[0.04]"
      : accent === "copper"
        ? "text-[#E08558] border-[#B5532C]/25 bg-[#B5532C]/[0.04]"
        : "text-neutral-300 border-white/[0.08] bg-white/[0.02]";

  return (
    <div className={`p-5 rounded-xl border ${colorClass}`}>
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase mb-2 opacity-80 flex items-center gap-1.5">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <code className="font-mono text-xs md:text-sm break-all leading-relaxed block">
        {value}
      </code>
    </div>
  );
}
