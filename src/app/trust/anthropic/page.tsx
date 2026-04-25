import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claude in production · Sovereign Matrix",
  description:
    "Live safety + quality outcomes from running Claude as the critic gate on every agent output across Sovereign Matrix. Engineering data, not marketing.",
  alternates: { canonical: "https://sovereignmatrix.agency/trust/anthropic" },
  openGraph: {
    title: "Claude in production — Sovereign Matrix",
    description:
      "Production safety + quality metrics from running Claude as the consensus critic on our agent platform.",
    url: "https://sovereignmatrix.agency/trust/anthropic",
    type: "website",
  },
};

// Keep this page server-rendered so the metrics fetch runs at request
// time (no client-side flash of zeros). Revalidate every hour —
// matches the underlying /api/_misc/safety-diff edge cache.
export const revalidate = 3600;

interface SafetyDiffResponse {
  generatedAt: string;
  window: string;
  rateCardVersion?: string;
  scope?: {
    description?: string;
    noteOnInterpretation?: string;
  };
  counts: {
    totalRuns: number;
    claudeInvolved: number;
    claudePercent: number;
    safetyBlocks: number;
    blocksPer1kRuns: number;
  };
  layers?: Record<string, string>;
  commitments?: Record<string, unknown>;
  note?: string;
}

async function fetchSafetyDiff(): Promise<SafetyDiffResponse | null> {
  try {
    // Self-fetch via the public endpoint so the page + the API stay
    // in sync. VERCEL_URL gets us the current deployment's URL; in
    // local dev we fall back to localhost.
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(`${base}/api/_misc/safety-diff`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as SafetyDiffResponse;
  } catch {
    return null;
  }
}

export default async function AnthropicTrustPage() {
  const data = await fetchSafetyDiff();

  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      {/* Editorial header */}
      <div className="max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Field Note · Integration
        </p>
        <h1 className="font-serif text-5xl lg:text-7xl leading-[1.05] tracking-tight mb-6">
          Claude, <em className="text-[#B5532C] not-italic">in production.</em>
        </h1>
        <p className="text-lg text-[#5C544A] leading-relaxed max-w-2xl">
          Not a case study. Not marketing. This page pulls live
          production metrics from our platform every hour and shows
          exactly how Claude participates in keeping our agents honest.
        </p>
      </div>

      {/* Metrics block */}
      <section className="mt-20 border-t border-[#D8CDB7] pt-12">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-6">
          {data?.window ?? "last 30 days"}
          {data?.generatedAt && (
            <span className="ml-4 text-[#B5532C]">
              · refreshed {new Date(data.generatedAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })} UTC
            </span>
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
          <MetricBlock
            label="Total agent runs"
            value={data ? formatNumber(data.counts.totalRuns) : "—"}
            context="Every chained agent invocation, across all customers."
          />
          <MetricBlock
            label="Runs where Claude participated"
            value={data ? formatNumber(data.counts.claudeInvolved) : "—"}
            context={
              data
                ? `${data.counts.claudePercent}% of runs — Claude as critic or extended-thinking generator.`
                : "Claude as critic or extended-thinking generator."
            }
          />
          <MetricBlock
            label="Safety blocks triggered"
            value={data ? formatNumber(data.counts.safetyBlocks) : "—"}
            context="Jailbreak + PII + policy + quality-floor rejections from our 5-layer pipeline."
          />
          <MetricBlock
            label="Blocks per 1,000 runs"
            value={data ? formatNumber(data.counts.blocksPer1kRuns) : "—"}
            context="A higher number means the pipeline is catching what it should. Not a failure mode."
          />
        </div>

        {data?.note && (
          <p className="mt-8 max-w-2xl text-sm text-[#5C544A] italic leading-relaxed">
            {data.note}
          </p>
        )}

        {data?.scope?.noteOnInterpretation && (
          <div className="mt-10 max-w-2xl border-l-2 border-[#B5532C] pl-6">
            <p className="text-[10px] font-mono tracking-[0.18em] uppercase text-[#8F8576] mb-2">
              On interpretation
            </p>
            <p className="text-sm text-[#5C544A] leading-relaxed">
              {data.scope.noteOnInterpretation}
            </p>
          </div>
        )}
      </section>

      {/* Safety pipeline — deterministic content */}
      <section className="mt-24 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Chapter II · The Pipeline
        </p>
        <h2 className="font-serif text-3xl lg:text-4xl leading-tight mb-8">
          Every agent output passes five gates.
          <br />
          <em className="text-[#B5532C] not-italic">Claude is the last one.</em>
        </h2>

        <ol className="space-y-8 mt-12 text-[#1A1712]">
          <PipelineStep
            n="01"
            title="Jailbreak detection"
            body="Nemotron-4B content-safety classifier catches prompt-injection attempts before they reach the model. Zero-shot, sub-100ms."
            path="src/lib/jailbreak-detect.ts"
          />
          <PipelineStep
            n="02"
            title="Content safety"
            body="Pre-flight policy check on user input. Toxic/illegal/unsafe prompts are refused with a clear reason, not a corporate non-answer."
            path="src/lib/content-safety.ts"
          />
          <PipelineStep
            n="03"
            title="PII scan"
            body="Regex + entity recognition on generated output. Any email/phone/SSN leakage gets flagged; agent decides whether to redact or refuse."
            path="src/lib/quality-scorer.ts"
          />
          <PipelineStep
            n="04"
            title="Quality scorer"
            body="A grading pass that rejects low-quality output (missing structure, incoherent, contradicts input). Up to one automatic regeneration."
            path="src/lib/quality-scorer.ts"
          />
          <PipelineStep
            n="05"
            title="Critic gate — Claude"
            body="Claude Sonnet 4.5 reads the generated output + original prompt and decides: ship, regenerate, or refuse. This is where hallucinations that survived the cheaper-model filter get caught."
            path="src/lib/consensus.ts → verifiedAi()"
            highlight
          />
        </ol>
      </section>

      {/* Commitments block */}
      <section className="mt-24 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Chapter III · The Commitments
        </p>
        <h2 className="font-serif text-3xl lg:text-4xl leading-tight mb-10">
          Things we will <em className="text-[#B5532C] not-italic">not do</em>, regardless of pricing pressure.
        </h2>

        <ul className="space-y-6 text-[#1A1712]">
          <Commitment
            label="Customer data never trains a model."
            detail="Not ours, not Anthropic's, not any provider's. Customers have a contractual no-training clause in our DPA + MSA. No exceptions, even for quality improvement."
          />
          <Commitment
            label="Claude stays the default critic."
            detail="We route generation to cheaper models because customers pay for runs, not brands. But the quality gate is Claude — that's what our /built-with-claude page promises and what this page exists to prove."
          />
          <Commitment
            label="Every agent run is auditable."
            detail={
              <>
                Any customer can export a cryptographically-signed snapshot of any run — inputs, model selections, safety checks, outputs, checksum — via{" "}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API endpoint, intentional <a> for JSON download */}
                <a href="/api/_replay/verify" className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C] transition-colors">
                  /api/_replay/verify
                </a>
                . Auditors can verify integrity without a Sovereign account.
              </>
            }
          />
          <Commitment
            label="The safety pipeline is public code."
            detail={
              <>
                All five layers are open-source in this repo. Read{" "}
                <code className="rounded bg-[#1A1712]/[0.04] px-2 py-0.5 text-[11px] font-mono">
                  src/lib/output-verifier.ts
                </code>{" "}
                to see exactly what runs on your output.
              </>
            }
          />
        </ul>
      </section>

      {/* Colophon */}
      <footer className="mt-32 pt-12 border-t border-[#D8CDB7] max-w-4xl text-[11px] font-mono text-[#8F8576] leading-loose">
        <p>
          Sovereign Matrix operates independently. Not formally affiliated
          with Anthropic. We use the Claude name with respect — and with
          substance. When we say &ldquo;Claude as critic,&rdquo; we can
          point to the line of code.
        </p>
        <p className="mt-3">
          Metrics auto-refresh every hour from <code>/api/_misc/safety-diff</code>.
          Rate card: {data?.rateCardVersion ?? "—"}.
        </p>
      </footer>
    </main>
  );
}

/* ─── Editorial sub-components ─── */

function MetricBlock({
  label,
  value,
  context,
}: {
  label: string;
  value: string;
  context: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#8F8576] mb-2">
        {label}
      </p>
      <p className="font-serif text-5xl lg:text-6xl text-[#1A1712] leading-none tracking-tight">
        {value}
      </p>
      <p className="mt-3 text-sm text-[#5C544A] leading-relaxed max-w-sm">
        {context}
      </p>
    </div>
  );
}

function PipelineStep({
  n,
  title,
  body,
  path,
  highlight,
}: {
  n: string;
  title: string;
  body: string;
  path: string;
  highlight?: boolean;
}) {
  return (
    <li
      className={`flex gap-8 items-start ${
        highlight ? "bg-[#B5532C]/[0.06] -mx-6 rounded px-6 py-6 border-l-2 border-[#B5532C]" : ""
      }`}
    >
      <span className="font-mono text-sm text-[#8F8576] tabular-nums pt-1">{n}</span>
      <div className="flex-1">
        <h3 className="font-serif text-xl text-[#1A1712] mb-2">{title}</h3>
        <p className="text-sm text-[#5C544A] leading-relaxed max-w-xl mb-2">{body}</p>
        <code className="text-[11px] font-mono text-[#8F8576]">{path}</code>
      </div>
    </li>
  );
}

function Commitment({
  label,
  detail,
}: {
  label: string;
  detail: string | React.ReactNode;
}) {
  return (
    <li>
      <p className="font-serif text-lg text-[#1A1712] mb-1">
        <em className="text-[#B5532C] not-italic">—</em> {label}
      </p>
      <p className="text-sm text-[#5C544A] leading-relaxed max-w-xl ml-6">
        {detail}
      </p>
    </li>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
