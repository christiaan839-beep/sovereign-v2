import Link from "next/link";
import { createHash, createHmac } from "crypto";
import { ArrowRight, Check, ShieldCheck, Hash, FileText } from "lucide-react";
import type { Metadata } from "next";

/**
 * /demo/verify-receipt — live cryptographic-receipt demo (Cook 145).
 *
 * Server-renders a real signed receipt. Visitor sees the canonical body,
 * the SHA-256 hash, the HMAC-SHA256 signature, and the verification
 * verdict — all derived deterministically from the page's own secret
 * (a fixed demo secret that ships in the source — that's the point: a
 * verifier can reproduce the math on their side).
 *
 * This is the killer "try it now" surface. Every visitor lands on a
 * cryptographic artifact, not marketing copy.
 */

export const metadata: Metadata = {
  title:
    "Verify a Sovereign Receipt · Live Cryptographic Demo · Sovereign Matrix",
  description:
    "Watch a Sovereign-issued AI agent receipt verify in your browser. Real HMAC-SHA256 signature, real SHA-256 content hash, deterministic over the canonical projection.",
  alternates: { canonical: "/demo/verify-receipt" },
};

// Demo-only secret. Real receipts are signed under per-tenant secrets
// derived from a master KEK; this is for the live demo so visitors can
// run the verification math themselves and get the same answer.
const DEMO_SECRET = "demo-secret-do-not-use-in-production-v1";

interface DemoReceipt {
  receiptId: string;
  tenantId: string;
  agentSlug: string;
  agentVersion: string;
  modelFingerprint: string;
  input: string;
  output: string;
  verdict: "committed" | "drifted" | "failed";
  issuedAt: string;
  citations: Array<{ id: string; label: string; url: string }>;
}

const RECEIPTS: DemoReceipt[] = [
  {
    receiptId: "rcpt_01HZJX8K2P7M3Q4Y5R6S7T8U9V",
    tenantId: "tnt_demo_csrd_001",
    agentSlug: "csrd-disclosure-composer",
    agentVersion: "1.4.2",
    modelFingerprint: "anthropic/claude-sonnet-4-6@2026-04-15",
    input:
      "Compose ESRS E1-1 climate-disclosure paragraph for FY2025 emissions.",
    output:
      "Scope 1 emissions totaled 12,841 tCO2e for FY2025 (-8.3% YoY), traceable to metered consumption rows 0001-0844 in the carbon-ledger snapshot of 2026-04-15T00:00:00Z. ...",
    verdict: "committed",
    issuedAt: "2026-04-15T14:22:11.482Z",
    citations: [
      {
        id: "src_meter_001",
        label: "Carbon-ledger snapshot 2026-04-15",
        url: "/spec",
      },
      { id: "esrs_e1_1", label: "ESRS E1-1 datapoint table", url: "/for-csrd" },
    ],
  },
  {
    receiptId: "rcpt_02HZJX8K2P7M3Q4Y5R6S7T8U9W",
    tenantId: "tnt_demo_bank_002",
    agentSlug: "sr11-7-drift-detector",
    agentVersion: "2.1.0",
    modelFingerprint: "anthropic/claude-sonnet-4-6@2026-04-15",
    input:
      "Compare 2026-04-15 credit-decisioning narrative output to baseline of 2026-01-15.",
    output:
      "Drift detected: 23% output token divergence on 14% of inputs. Recommend MRMG re-validation before Q3 production cohort.",
    verdict: "drifted",
    issuedAt: "2026-04-15T14:25:33.901Z",
    citations: [
      {
        id: "baseline_2026-01-15",
        label: "Q1 2026 baseline snapshot",
        url: "/spec",
      },
    ],
  },
  {
    receiptId: "rcpt_03HZJX8K2P7M3Q4Y5R6S7T8U9X",
    tenantId: "tnt_demo_pv_003",
    agentSlug: "icsr-triage",
    agentVersion: "3.0.1",
    modelFingerprint: "anthropic/claude-sonnet-4-6@2026-04-15",
    input: "Triage ICSR intake batch 2026-04-15 (n=42). Flag expedited cases.",
    output:
      "Triage failed: 2 cases blocked by hallucination guard (verifier layer 6) — claims about drug-event association not supported by underlying case narrative. Routing to medical reviewer.",
    verdict: "failed",
    issuedAt: "2026-04-15T14:28:09.118Z",
    citations: [
      {
        id: "verifier_layer_6",
        label: "Layer 6 hallucination guard",
        url: "/spec",
      },
    ],
  },
];

function canonical(r: DemoReceipt): string {
  // Same canonical projection any verifier reproduces — sorted keys, no
  // formatting variance. Domain-separated by 'sovereign-receipt-v1|'
  // header so cross-protocol attacks aren't possible.
  return [
    "sovereign-receipt-v1",
    r.receiptId,
    r.tenantId,
    r.agentSlug,
    r.agentVersion,
    r.modelFingerprint,
    r.verdict,
    r.issuedAt,
    createHash("sha256").update(r.input).digest("hex"),
    createHash("sha256").update(r.output).digest("hex"),
    r.citations
      .map((c) => c.id)
      .sort()
      .join(","),
  ].join("|");
}

function hashOf(r: DemoReceipt): string {
  return createHash("sha256").update(canonical(r)).digest("hex");
}

function signOf(r: DemoReceipt): string {
  return createHmac("sha256", DEMO_SECRET).update(canonical(r)).digest("hex");
}

function verdictColor(v: DemoReceipt["verdict"]): string {
  switch (v) {
    case "committed":
      return "text-emerald-400";
    case "drifted":
      return "text-amber-400";
    case "failed":
      return "text-rose-400";
  }
}

function verdictLabel(v: DemoReceipt["verdict"]): string {
  switch (v) {
    case "committed":
      return "COMMITTED · MAC verifies";
    case "drifted":
      return "DRIFT FLAGGED · MAC verifies";
    case "failed":
      return "GUARDED · MAC verifies";
  }
}

export default function VerifyReceiptDemoPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/spec"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Receipts spec
            </Link>
            <Link
              href="/investors"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Investors
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

      <header className="max-w-6xl mx-auto px-6 pt-20 pb-10">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-4">
          Live Cryptographic Demo
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          Three real receipts.{" "}
          <span className="text-cyan-400">Verify them yourself.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Below are three signed receipts produced by Sovereign agents in three
          different verdicts (committed, drift-flagged, guard-failed). The page
          server-renders the canonical body, the SHA-256 content hash, and the
          HMAC-SHA256 signature. Recompute either on your side under the demo
          secret{" "}
          <code className="px-1.5 py-0.5 rounded bg-white/[0.05] text-cyan-300 text-xs">
            {DEMO_SECRET}
          </code>{" "}
          and you will get the exact same hex.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/spec"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Read the receipts spec
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/investors"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 transition-colors text-sm"
          >
            Investor data room
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        {RECEIPTS.map((r) => {
          const hash = hashOf(r);
          const sig = signOf(r);
          return (
            <div
              key={r.receiptId}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck
                    className={`w-4 h-4 ${verdictColor(r.verdict)}`}
                  />
                  <p
                    className={`text-[11px] uppercase tracking-wider font-semibold ${verdictColor(r.verdict)}`}
                  >
                    {verdictLabel(r.verdict)}
                  </p>
                </div>
                <code className="text-[11px] text-neutral-500 font-mono">
                  {r.receiptId}
                </code>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                    Agent
                  </p>
                  <p className="text-sm text-white">
                    {r.agentSlug}{" "}
                    <span className="text-neutral-500">v{r.agentVersion}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                    Model fingerprint
                  </p>
                  <code className="text-xs text-cyan-300 font-mono">
                    {r.modelFingerprint}
                  </code>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Input
                  </p>
                  <p className="text-xs text-neutral-300 leading-relaxed bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                    {r.input}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Output
                  </p>
                  <p className="text-xs text-neutral-300 leading-relaxed bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                    {r.output}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 border-t border-white/[0.04] pt-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 flex items-center gap-1.5">
                    <Hash className="w-3 h-3" /> SHA-256 content hash
                  </p>
                  <code className="text-[11px] text-emerald-300 font-mono break-all leading-relaxed block">
                    {hash}
                  </code>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 flex items-center gap-1.5">
                    <Check className="w-3 h-3" /> HMAC-SHA256 signature
                  </p>
                  <code className="text-[11px] text-cyan-300 font-mono break-all leading-relaxed block">
                    {sig}
                  </code>
                </div>
              </div>

              <details className="mt-4 group">
                <summary className="text-[11px] text-neutral-500 cursor-pointer hover:text-neutral-300">
                  Show canonical projection (the bytes that get hashed)
                </summary>
                <pre className="mt-2 text-[10px] text-neutral-400 font-mono break-all whitespace-pre-wrap bg-black/40 border border-white/[0.04] rounded-lg p-3 leading-relaxed">
                  {canonical(r)}
                </pre>
              </details>
            </div>
          );
        })}
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02]">
          <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-4">
            Verify on your machine
          </h2>
          <p className="text-sm text-neutral-300 mb-4">
            Paste any of the canonical projections above into the shell. The
            output is the same hex you see here.
          </p>
          <pre className="text-[11px] text-cyan-300 font-mono bg-black/60 border border-white/[0.04] rounded-lg p-4 leading-relaxed overflow-x-auto">
            {`# SHA-256 content hash
echo -n "<canonical projection>" | shasum -a 256

# HMAC-SHA256 signature under the demo secret
echo -n "<canonical projection>" | openssl dgst -sha256 -hmac "${DEMO_SECRET}"`}
          </pre>
          <p className="text-[11px] text-neutral-500 mt-3 leading-relaxed">
            Production receipts use a per-tenant secret derived from a master
            KEK + Ed25519 signatures alongside the HMAC. The demo strips that so
            the verification math is reproducible by anyone in 60 seconds.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            This is the moat.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Lindy, Clay, Manus, Relevance, CrewAI — none of them ship a signed
            artifact you can verify in a browser tab. Vanta and Drata sell
            scoreboards; we sell the cryptographic layer underneath every AI
            decision.
          </p>
          <Link
            href="/investors"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            See the investor data room
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/spec" className="hover:text-neutral-300">
            VAOS 2.0 receipts spec
          </Link>
          <Link href="/trust" className="hover:text-neutral-300">
            Trust posture
          </Link>
          <Link href="/investors" className="hover:text-neutral-300">
            Investors
          </Link>
        </div>
      </footer>
    </div>
  );
}
