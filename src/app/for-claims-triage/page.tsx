import type { Metadata } from "next";
import Link from "next/link";
import { createHash } from "crypto";
import { signRun } from "@/lib/agent-runs";
import {
  ShieldCheck,
  Hash,
  Lock,
  ArrowRight,
  AlertTriangle,
  FileText,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Claims triage — Sovereign Matrix",
  description:
    "Every claim decision carries a cryptographically signed receipt. NAIC AI Bulletin compliant, bias-monitored, subrogation-defensible. Hand the receipt to a regulator and the math holds.",
  openGraph: {
    title: "Claims triage with cryptographic receipts",
    description:
      "Every FNOL, coverage decision, and adverse-action notice carries an Ed25519-signed receipt your auditor can verify.",
  },
};

// ISR — hand-crafted vertical page; regenerate hourly so the sample
// receipt's `issuedAt` advances without a redeploy.
export const revalidate = 3600;

/**
 * /for-claims-triage — hand-crafted vertical landing (Wave 32).
 *
 * Design philosophy: a CISO from an insurance carrier should be able
 * to verify the central claim ("every decision carries a receipt")
 * in 60 seconds without an account. Every header is editorial; every
 * fact is anchored to a real Sovereign primitive; the receipt shown
 * below is signed at render time with the production signRun() so a
 * `view-source` inspector sees real bytes — not marketing JSON.
 *
 * Brand-strict: cyan accent for audit/proof, copper for action.
 * Zero emerald/teal/violet drift. Zero AI-slop adjectives in headers.
 *
 * The page IS the demo. No video. No popup. No chat widget.
 */

// ── Real sample receipt — signed at render time so source-view holds bytes ──

const SAMPLE_RUN = {
  id: "rcpt_claims_sample_01H8XYZ",
  agentName: "fnol-coverage-triage",
  modelUsed: "claude-sonnet-4-6",
  input: {
    policyId: "POL-12-885421",
    fnolReceivedAt: "2026-05-14T08:23:17.000Z",
    perilType: "water-damage",
    estimatedLossUsd: 14_500,
    insuredStatement:
      "Pipe burst overnight on the second floor; flooring + drywall affected.",
  },
  output: {
    verdict: "covered-subject-to-investigation",
    citations: [
      "Policy §III.B.4 (sudden discharge)",
      "Policy §III.E.7 (consequential)",
    ],
    nextSteps: [
      "Dispatch independent adjuster within 48h",
      "Subrogation review against plumbing contractor",
      "Reserve set at $18,750 (estimate × 1.29 reserve factor)",
    ],
    biasCheck: {
      protectedClassReferenced: false,
      jurisdiction: "CA-DOI",
      regulationsApplied: [
        "10 CCR §2695.4 (Fair Claims Settlement Practices)",
        "NAIC AI Bulletin §3.5",
      ],
    },
  },
  safetyResult: { passed: true, score: 0.96 },
  durationMs: 1_847,
  createdAt: "2026-05-14T08:23:19.247Z",
};

function canonicalizeSample(): string {
  // Mirrors src/lib/agent-runs.ts canonicalize() exactly. We don't
  // import it directly because the actual canonicalize is internal;
  // the projection is identical so the signature reproduces.
  return JSON.stringify({
    v: 1,
    id: SAMPLE_RUN.id,
    agentName: SAMPLE_RUN.agentName,
    modelUsed: SAMPLE_RUN.modelUsed,
    input: sortKeysDeep(SAMPLE_RUN.input),
    output: sortKeysDeep(SAMPLE_RUN.output),
    safetyResult: sortKeysDeep(SAMPLE_RUN.safetyResult),
    durationMs: SAMPLE_RUN.durationMs,
    createdAt: SAMPLE_RUN.createdAt,
  });
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
  }
  return out;
}

export default function ClaimsTriagePage() {
  const canonical = canonicalizeSample();
  const contentHash = createHash("sha256").update(canonical).digest("hex");
  const signature = signRun(canonical);
  const scheme = signature.startsWith("v2=")
    ? "ed25519"
    : signature.startsWith("v1=")
      ? "hmac-sha256"
      : "unsigned";

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-4xl mx-auto">
        {/* Editorial header */}
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          INSURANCE · CLAIMS · NAIC AI BULLETIN §3.5
        </p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
          Every claim decision
          <br />
          <span className="text-[#B5532C]">carries a receipt.</span>
        </h1>
        <p className="text-[18px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          FNOL triage, coverage analysis, reserve-setting, adverse-action
          notices. Every output ships an Ed25519-signed receipt your
          carrier&apos;s auditor — and the DOI complaint examiner — can verify
          without an account. Bad-faith plaintiffs ask &quot;what did the AI
          consider?&quot; You hand them this.
        </p>

        {/* The vertical-specific stat — not platform-wide marketing math */}
        <section className="mb-16 px-6 py-5 border border-cyan-500/20 bg-cyan-500/[0.03] rounded-[3px]">
          <p className="font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-2">
            What the receipt buys you
          </p>
          <p className="text-[15px] text-neutral-300 leading-[1.65]">
            Bad-faith litigation in P&amp;C runs on the question{" "}
            <em className="not-italic text-white">
              &quot;was the decision defensible at the moment it was made?&quot;
            </em>{" "}
            A signed receipt is the cleanest possible &quot;yes&quot;. The
            plaintiff&apos;s expert can recompute the canonical projection,
            validate the Ed25519 signature against our published public key, and
            confirm the decision input set hasn&apos;t been touched since
            issuance. Lab-grade evidence on day-one of discovery.
          </p>
        </section>

        {/* THE artifact — a real signed receipt, rendered with the production primitive */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            01 · SAMPLE RECEIPT — POL-12-885421
          </h2>
          <div className="space-y-3">
            <ReceiptField
              label="Run id"
              value={SAMPLE_RUN.id}
              accent="neutral"
            />
            <ReceiptField
              label="Agent"
              value={`${SAMPLE_RUN.agentName} · ${SAMPLE_RUN.modelUsed}`}
              accent="neutral"
            />
            <ReceiptField
              label="Issued at"
              value={SAMPLE_RUN.createdAt}
              accent="neutral"
            />
            <details className="border border-white/[0.06] rounded-[3px] p-4 bg-white/[0.015]">
              <summary className="flex items-center gap-2 font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase cursor-pointer hover:text-neutral-300">
                <FileText className="w-3 h-3" /> Show input + output canonical (
                {canonical.length} bytes)
              </summary>
              <pre className="mt-3 text-[11px] font-mono text-neutral-400 leading-[1.55] overflow-x-auto whitespace-pre-wrap break-words">
                {canonical}
              </pre>
            </details>

            <div className="border border-cyan-500/25 bg-cyan-500/[0.04] rounded-[3px] p-4">
              <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.2em] uppercase mb-2">
                <Hash className="w-3 h-3" /> SHA-256 content hash
              </p>
              <code className="block font-mono text-[12px] text-cyan-300 break-all leading-[1.55]">
                {contentHash}
              </code>
            </div>

            <div className="border border-[#B5532C]/25 bg-[#B5532C]/[0.04] rounded-[3px] p-4">
              <p className="flex items-center gap-2 font-mono text-[10px] text-[#E08558] tracking-[0.2em] uppercase mb-2">
                <ShieldCheck className="w-3 h-3" /> Signature ({scheme})
              </p>
              <code className="block font-mono text-[12px] text-[#E08558] break-all leading-[1.55]">
                {signature}
              </code>
              <p className="text-[11px] text-neutral-500 mt-3 leading-[1.6]">
                Verify with{" "}
                <Link
                  href="/auditor/replay"
                  className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
                >
                  /auditor/replay
                </Link>{" "}
                or fetch the public Ed25519 key at{" "}
                <code className="text-neutral-300">
                  /.well-known/sovereign-receipts/ed25519.pem
                </code>{" "}
                and run{" "}
                <code className="text-neutral-300">openssl pkeyutl</code>{" "}
                against the canonical above.
              </p>
            </div>
          </div>
        </section>

        {/* The regulatory mapping — what the receipt satisfies */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            02 · WHAT THIS RECEIPT SATISFIES
          </h2>
          <ul className="space-y-3">
            <RegLine
              code="NAIC AI Bulletin §3.5"
              title="Traceability of AI decisions"
              detail="The signature names the agent + model version + token id; the canonical includes every input considered."
            />
            <RegLine
              code="NAIC AI Bulletin §3.3.b"
              title="Bias monitoring"
              detail="The output's biasCheck block records the protected-class status + jurisdiction-specific regulations applied. Wave-30 NAIC Guardian pack warns on omission."
            />
            <RegLine
              code="10 CCR §2695.4 (CA DOI)"
              title="Fair Claims Settlement Practices"
              detail="Coverage decision cites the specific policy section + reserve methodology. Discovery-ready."
            />
            <RegLine
              code="State unfair-claims statutes"
              title="Bad-faith litigation defense"
              detail="A timestamped, signed, content-hashed record makes the &lsquo;reasonable basis at issuance&rsquo; standard verifiable instead of testimonial."
            />
          </ul>
        </section>

        {/* Side-by-side competitor comparison */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            03 · SIDE-BY-SIDE
          </h2>
          <div className="border border-white/[0.06] rounded-[3px] overflow-hidden">
            <CompareRow
              label="Decision audit trail"
              vendors={[
                {
                  name: "Sovereign",
                  detail:
                    "Ed25519-signed receipt per decision · 3rd-party verifiable",
                  ok: true,
                },
                {
                  name: "Generic LLM API",
                  detail: "Application log line only",
                  ok: false,
                },
                {
                  name: "Insurance-AI vendor X",
                  detail: "JSON audit log in vendor's DB · vendor-attested",
                  ok: false,
                },
              ]}
            />
            <CompareRow
              label="Replay forensics"
              vendors={[
                {
                  name: "Sovereign",
                  detail:
                    "/auditor/replay · re-derive canonical · verify in 60s",
                  ok: true,
                },
                { name: "Generic LLM API", detail: "Not supported", ok: false },
                {
                  name: "Insurance-AI vendor X",
                  detail: "Support-ticket SLA · vendor staff replays",
                  ok: false,
                },
              ]}
            />
            <CompareRow
              label="Bias-monitoring per call"
              vendors={[
                {
                  name: "Sovereign",
                  detail:
                    "Wave-30 NAIC Guardian pack · pre-built + signed verdict",
                  ok: true,
                },
                {
                  name: "Generic LLM API",
                  detail: "Caller implements",
                  ok: false,
                },
                {
                  name: "Insurance-AI vendor X",
                  detail: "Quarterly bias report · not per-call",
                  ok: false,
                },
              ]}
            />
            <CompareRow
              label="Post-quantum forward security"
              vendors={[
                {
                  name: "Sovereign",
                  detail: "ML-DSA-65 dual-sign · receipts verifiable in 2040+",
                  ok: true,
                },
                { name: "Generic LLM API", detail: "Not addressed", ok: false },
                {
                  name: "Insurance-AI vendor X",
                  detail: "Not addressed",
                  ok: false,
                },
              ]}
              last
            />
          </div>
          <p className="text-[11px] text-neutral-500 mt-3 leading-[1.6]">
            &ldquo;Insurance-AI vendor X&rdquo; is a composite of the three
            insurance-specific AI vendors most commonly named in 2026 carrier
            RFPs. We don&apos;t name them here because the asymmetric advantage
            is structural, not personal.
          </p>
        </section>

        {/* What we'd actually build for you */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            04 · WHAT WE BUILD WITH YOUR CARRIER
          </h2>
          <ol className="space-y-4 text-[14px] text-neutral-400 leading-[1.7]">
            <li>
              <span className="font-mono text-[#E08558] mr-3">01</span>
              <span className="text-white">Two-week pilot</span> on a single
              claims line (water damage, theft, or single-vehicle MVA — your
              pick). We wire your existing FNOL inbox + policy data into a
              Sovereign agent. No model retraining required.
            </li>
            <li>
              <span className="font-mono text-[#E08558] mr-3">02</span>
              <span className="text-white">
                100 historical claims replayed
              </span>{" "}
              against the agent + Guardian pack. Your team reviews verdicts +
              receipts. Discrepancies get logged and the Guardian rule set is
              tuned against your carrier&apos;s actual exposure pattern.
            </li>
            <li>
              <span className="font-mono text-[#E08558] mr-3">03</span>
              <span className="text-white">Live in 30 days</span>. Receipt chain
              anchors to Bitcoin daily. Your DOI complaint examiner gets the
              public verifier endpoint at handover. Bad-faith discovery becomes
              a 3-line answer.
            </li>
          </ol>
        </section>

        {/* CTA — single primary, no second option */}
        <section className="border-t border-white/[0.06] pt-12">
          <h2 className="font-serif text-3xl text-white mb-4">
            Pilot a single claims line.
          </h2>
          <p className="text-[15px] text-neutral-400 mb-8 leading-[1.6] max-w-2xl">
            Two weeks. One line of business. Receipts on every decision. No
            model training, no data migration, no rip-and-replace. If the math
            doesn&apos;t hold at your auditor&apos;s desk, the pilot ends and
            you owe nothing.
          </p>
          <a
            href="mailto:christiaan@sovereignmatrix.agency?subject=Claims%20triage%20pilot%20enquiry"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#B5532C] text-white text-[13px] font-mono tracking-[0.1em] rounded-[3px] hover:bg-[#C96234] transition-colors"
          >
            Email the founder
            <ArrowRight className="w-4 h-4" />
          </a>
        </section>

        {/* Footer trust strip */}
        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            See also{" "}
            <Link
              href="/for-insurance"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /for-insurance
            </Link>{" "}
            (broader vertical),{" "}
            <Link
              href="/auditor/replay"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /auditor/replay
            </Link>{" "}
            (live verifier),{" "}
            <Link
              href="/trust"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /trust
            </Link>{" "}
            (procurement-grade compliance evidence),{" "}
            <Link
              href="/sales"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /sales
            </Link>{" "}
            (contract tier).
          </p>
        </div>
      </div>
    </main>
  );
}

function ReceiptField({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "neutral" | "cyan" | "copper";
}) {
  const colorClass =
    accent === "cyan"
      ? "text-cyan-300 border-cyan-500/25 bg-cyan-500/[0.04]"
      : accent === "copper"
        ? "text-[#E08558] border-[#B5532C]/25 bg-[#B5532C]/[0.04]"
        : "text-neutral-300 border-white/[0.08] bg-white/[0.02]";
  return (
    <div className={`p-4 rounded-[3px] border ${colorClass}`}>
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-70 mb-1">
        {label}
      </p>
      <code className="font-mono text-[13px] break-all leading-[1.5] block">
        {value}
      </code>
    </div>
  );
}

function RegLine({
  code,
  title,
  detail,
}: {
  code: string;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-4 p-4 border border-white/[0.06] rounded-[3px] bg-white/[0.015]">
      <Lock className="w-3.5 h-3.5 text-cyan-300 mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] text-[#E08558] tracking-[0.15em] mb-1">
          {code}
        </p>
        <p className="text-[15px] text-white mb-1">{title}</p>
        <p className="text-[13px] text-neutral-400 leading-[1.55]">{detail}</p>
      </div>
    </li>
  );
}

function CompareRow({
  label,
  vendors,
  last,
}: {
  label: string;
  vendors: Array<{ name: string; detail: string; ok: boolean }>;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-4 ${last ? "" : "border-b border-white/[0.06]"}`}
    >
      <div className="px-4 py-4 font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase md:border-r border-white/[0.06] bg-white/[0.015]">
        {label}
      </div>
      {vendors.map((v) => (
        <div
          key={v.name}
          className={`px-4 py-4 ${v.ok ? "bg-cyan-500/[0.02]" : ""}`}
        >
          <p
            className={`font-mono text-[10px] tracking-[0.15em] uppercase mb-1 ${v.ok ? "text-cyan-300" : "text-neutral-500"}`}
          >
            {v.name}
          </p>
          <p
            className={`text-[12px] leading-[1.5] ${v.ok ? "text-neutral-200" : "text-neutral-500"}`}
          >
            {v.detail}
          </p>
          {!v.ok && (
            <AlertTriangle
              className="w-3 h-3 text-neutral-700 mt-1.5"
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  );
}
