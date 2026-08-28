import type { Metadata } from "next";
import Link from "next/link";
import {
  buildConstitution,
  auditAgainstConstitution,
  toMarkdown,
  type ConstitutionArticle,
} from "@sovereign-matrix/ai-constitution";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";
import { packageUrl } from "@/lib/package-links";

export const metadata: Metadata = {
  title: "Constitutional AI Anchoring — Live Preview · Sovereign Matrix",
  description:
    "Cryptographically-anchored AI constitutions. Sign an immutable policy document; every receipt commits to its hash. Genuinely novel OSS primitive — the inference-time analogue to Anthropic's Constitutional AI training methodology.",
};

const ARTICLES: ConstitutionArticle[] = [
  {
    id: "ART-1.1",
    title: "No PHI in outputs",
    text: "The agent SHALL NOT include personally-identifiable health information in any output destined for an end-user channel.",
    severity: "blocking",
    measurableCondition: {
      pack: "hipaaPack",
      ruleId: "hipaa-phi-leak-detect",
    },
    citations: ["HIPAA § 164.502(b)"],
  },
  {
    id: "ART-1.2",
    title: "Cite the chart entry",
    text: "Every factual claim about a patient MUST cite the originating chart entry by record id.",
    severity: "warning",
    measurableCondition: {
      pack: "groundednessPack",
      ruleId: "ground-source-cite",
    },
  },
  {
    id: "ART-2.1",
    title: "Honour the kill switch",
    text: "The agent MUST cease all autonomous action within 200ms of receiving a kill signal from the operator.",
    severity: "blocking",
  },
  {
    id: "ART-2.2",
    title: "No autonomous escalation past human review",
    text: "If the agent's confidence in its decision is below 0.85, it MUST defer to a human reviewer before producing an end-user output.",
    severity: "warning",
    measurableCondition: {
      pack: "humanInLoopPack",
      ruleId: "confidence-threshold-defer",
    },
  },
  {
    id: "ART-3.1",
    title: "No financial advice without disclaimer",
    text: 'The agent MUST NOT produce content that could be construed as personalised financial advice without an explicit "this is not financial advice" disclaimer.',
    severity: "blocking",
    measurableCondition: {
      pack: "finadvicePack",
      ruleId: "no-finadvice-without-disclaimer",
    },
    citations: ["SEC IA-2256", "FCA COBS 4.5"],
  },
];

const SAMPLE_CONSTITUTION = buildConstitution({
  name: "Sample Operator — Healthcare AI Constitution",
  signedBy: "Acme Health AI Inc.",
  preamble:
    "This constitution governs all autonomous AI agents operating against patient ePHI within our clinical-decision-support stack. Every receipt produced by these agents anchors to the SHA-256 of this document.",
  articles: ARTICLES,
});

const SAMPLE_RECEIPTS: ReceiptRecord[] = (() => {
  const base = new Date("2026-01-15T00:00:00Z").getTime();
  const out: ReceiptRecord[] = [];
  for (let i = 0; i < 400; i++) {
    const violationRoll = i % 89;
    const rules: Array<{ ruleId: string; pack: string; verdict: string }> = [];
    if (violationRoll === 17) {
      rules.push({
        ruleId: "ground-source-cite",
        pack: "groundednessPack",
        verdict: "warn",
      });
    } else if (violationRoll === 43) {
      rules.push({
        ruleId: "confidence-threshold-defer",
        pack: "humanInLoopPack",
        verdict: "warn",
      });
    } else if (violationRoll === 71) {
      rules.push({
        ruleId: "hipaa-phi-leak-detect",
        pack: "hipaaPack",
        verdict: "block",
      });
    }
    out.push({
      verdictId: `v_${i.toString(36).padStart(6, "0")}`,
      overall: rules.some((r) => r.verdict === "block")
        ? "block"
        : rules.some((r) => r.verdict === "warn")
          ? "warn"
          : "pass",
      issuedAt: new Date(base + i * 1000 * 60 * 10).toISOString(),
      agentSlug: "clinical-decision-support",
      pack: "hipaaPack",
      constitutionHash: SAMPLE_CONSTITUTION.hash,
      rules,
    } as unknown as ReceiptRecord);
  }
  return out;
})();

export default function AiConstitutionPreview() {
  const audit = auditAgainstConstitution({
    constitution: SAMPLE_CONSTITUTION,
    receipts: SAMPLE_RECEIPTS,
  });
  const md = toMarkdown(audit);

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
            Novel primitive · Apache 2.0
          </p>
          <h1 className="font-serif text-5xl md:text-6xl leading-[1.04] tracking-[-0.02em] mb-6">
            Constitutional AI,
            <br />
            <em className="not-italic text-[#B5532C]">
              cryptographically anchored.
            </em>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] mb-3">
            Sign an immutable policy document; every receipt commits to its
            SHA-256 hash. If the agent ever violates the constitution, the
            receipts themselves are evidence — byte-precise, auditor-
            reproducible.
          </p>
          <p className="text-[14px] text-neutral-500 leading-relaxed">
            Genuinely new: Anthropic ships Constitutional AI as a training
            methodology; this is the <em>inference-time</em> cryptographic
            commitment that makes it auditable. No existing OSS does this.
          </p>
        </div>

        <div className="mt-12 rounded-[6px] border border-cyan-500/20 bg-black/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Install · Apache 2.0
            </p>
            <p className="text-[10px] font-mono text-neutral-600">
              Zero deps beyond node:crypto + verifiable-receipts
            </p>
          </div>
          <pre className="px-5 py-4 overflow-x-auto font-mono text-[13px] leading-[1.6] text-cyan-300/95">
            {`npm install @sovereign-matrix/ai-constitution @sovereign-matrix/verifiable-receipts`}
          </pre>
        </div>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            This constitution
          </h2>
          <div className="rounded-[8px] border border-white/[0.06] bg-white/[0.015] p-6">
            <div className="flex items-baseline gap-3 mb-4 flex-wrap">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#B5532C]">
                Signed
              </span>
              <h3 className="font-serif text-[20px] tracking-tight">
                {SAMPLE_CONSTITUTION.name}
              </h3>
            </div>
            <p className="text-[13px] text-neutral-400 leading-relaxed mb-4 italic">
              {SAMPLE_CONSTITUTION.preamble}
            </p>
            <div className="grid sm:grid-cols-2 gap-2 text-[12px] font-mono mb-5">
              <KV k="Signed by" v={SAMPLE_CONSTITUTION.signedBy} />
              <KV
                k="Signed at"
                v={SAMPLE_CONSTITUTION.signedAt.slice(0, 19) + "Z"}
              />
              <KV
                k="Hash"
                v={SAMPLE_CONSTITUTION.hash.slice(0, 16) + "…"}
                mono
              />
              <KV
                k="Articles"
                v={SAMPLE_CONSTITUTION.articles.length.toString()}
              />
            </div>
            <div className="space-y-3 mt-6">
              {SAMPLE_CONSTITUTION.articles.map((a) => (
                <article
                  key={a.id}
                  className="rounded-[4px] border border-white/[0.04] bg-black/30 px-4 py-3"
                >
                  <div className="flex items-baseline gap-3 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
                      {a.id}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                        a.severity === "blocking"
                          ? "border-red-500/40 text-red-300 bg-red-500/[0.06]"
                          : a.severity === "warning"
                            ? "border-amber-500/30 text-amber-400 bg-amber-500/[0.04]"
                            : "border-neutral-500/30 text-neutral-400 bg-white/[0.02]"
                      }`}
                    >
                      {a.severity}
                    </span>
                    <strong className="font-serif text-[14px] text-white">
                      {a.title}
                    </strong>
                  </div>
                  <p className="text-[13px] text-neutral-300 leading-[1.55]">
                    {a.text}
                  </p>
                  {a.citations && a.citations.length > 0 && (
                    <p className="mt-2 text-[10px] text-neutral-500 font-mono">
                      Cites: {a.citations.join(" · ")}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            Audit summary
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="Total receipts"
              value={audit.totalReceipts.toLocaleString()}
              tone="neutral"
            />
            <Stat
              label="Bound to constitution"
              value={audit.receiptsBoundToThisConstitution.toLocaleString()}
              tone="emerald"
            />
            <Stat
              label="Blocking violations"
              value={audit.summary.blockingViolationsTotal.toString()}
              tone={
                audit.summary.blockingViolationsTotal > 0 ? "red" : "emerald"
              }
            />
            <Stat
              label="Warning violations"
              value={audit.summary.warningViolationsTotal.toString()}
              tone={
                audit.summary.warningViolationsTotal > 0 ? "amber" : "emerald"
              }
            />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Markdown preview
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            The exact bytes{" "}
            <code className="text-cyan-300/90">toMarkdown(audit)</code>{" "}
            returned. Hand to your DPO / court / regulator / insurance
            underwriter.
          </p>
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
            AGI / ASI accountability
          </p>
          <h3 className="font-serif text-3xl md:text-4xl mb-4 tracking-tight">
            The closest cryptographic analogue
            <br />
            <em className="not-italic text-[#B5532C]">
              to Asimov&apos;s Laws — enforceable.
            </em>
          </h3>
          <p className="text-[14px] text-neutral-400 leading-relaxed mb-6 max-w-3xl">
            When autonomous agents become more capable, &quot;did the agent
            follow the rules?&quot; becomes the central accountability question.
            This package makes that question cryptographically answerable —
            content-addressed, post-quantum-signed, byte- deterministic
            auditing.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#B5532C] text-white font-semibold text-[13px] rounded-[3px] hover:bg-[#C96234] transition-colors tracking-tight"
            >
              Start free
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href={packageUrl("@sovereign-matrix/ai-constitution")}
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/[0.12] text-neutral-300 font-mono text-[13px] rounded-[3px] hover:text-white hover:border-white/25 transition-colors"
            >
              View source
            </Link>
            <Link
              href="/compliance"
              className="inline-flex items-center gap-2 px-5 py-3 text-neutral-500 hover:text-white font-mono text-[13px] transition-colors"
            >
              See all 9 exporters →
            </Link>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/[0.04] text-[12px] font-mono text-neutral-600">
          Generated by{" "}
          <code className="text-cyan-300/80">
            @sovereign-matrix/ai-constitution
          </code>{" "}
          v0.1.0 · Apache 2.0 · schema{" "}
          <code className="text-cyan-300/80">vaos-constitution-audit-v1</code>
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
  tone: "emerald" | "amber" | "red" | "neutral";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "amber"
        ? "text-amber-400"
        : tone === "red"
          ? "text-red-400"
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

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-neutral-500 uppercase tracking-[0.14em] text-[10px] min-w-[80px]">
        {k}
      </dt>
      <dd
        className={`${mono ? "text-cyan-300/90" : "text-neutral-200"} text-[12px]`}
      >
        {v}
      </dd>
    </div>
  );
}
