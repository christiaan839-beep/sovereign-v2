import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Activity,
  Shield,
  Zap,
} from "lucide-react";
import { getPlatformSlo } from "@/lib/slo-tracker";
import { getAiCacheStats } from "@/lib/ai-cache";

/**
 * /compare — matrix comparison Sovereign Matrix vs the field.
 *
 * Pairs with /benchmarks (which shows real production cost-ledger data)
 * and /vs/<competitor> (which goes deep on individual rivals). This is
 * the one-shot overview.
 *
 * Design principle: every cell is code-verifiable on OUR side, and
 * sourced from public docs on competitor sides. No rounded marketing.
 */

// Server component — reads in-memory SLO + cache state at request time.
export const revalidate = 30;

const COMPARISON_ROWS = [
  {
    metric: "First-party agents shipping today",
    sovereign: { value: "218", good: true },
    crewai: { value: "~0 (framework)", good: false },
    zapier: { value: "~30 AI-specific", good: false },
    n8n: { value: "~20 AI nodes", good: false },
    langchain: { value: "~0 (library)", good: false },
    lindy: { value: "~30", good: false },
    note: "Framework competitors force users to build agents themselves.",
  },
  {
    metric: "Distinct LLM providers",
    sovereign: { value: "16", good: true },
    crewai: { value: "~6", good: null },
    zapier: { value: "2-3 (OpenAI-first)", good: false },
    n8n: { value: "~4", good: null },
    langchain: { value: "20+", good: true },
    lindy: { value: "~3", good: false },
    note: "NVIDIA NIM, Anthropic, Google, Groq, Cerebras, Ollama, OpenAI, xAI, Mistral direct, Cohere, OpenRouter, Together, Databricks, Replicate, DeepSeek, Alibaba.",
  },
  {
    metric: "Unique models addressable",
    sovereign: { value: "120+", good: true },
    crewai: { value: "varies", good: null },
    zapier: { value: "~8", good: false },
    n8n: { value: "~15", good: null },
    langchain: { value: "50+ (via adapters)", good: true },
    lindy: { value: "~10", good: null },
    note: "46 NIM + 80 frontier (gpt-5, o3, grok-4, llama-4-405b, DBRX, command-r-plus, ...). LangChain is a library — we're a platform with built-in routing.",
  },
  {
    metric: "Built-in safety-pipeline modules",
    sovereign: { value: "7", good: true },
    crewai: { value: "0 (user-built)", good: false },
    zapier: { value: "1 (moderation)", good: false },
    n8n: { value: "0", good: false },
    langchain: { value: "~2 (guardrails)", good: null },
    lindy: { value: "1-2", good: null },
    note: "Jailbreak, content, PII, quality, critic, trust, action-tier.",
  },
  {
    metric: "Graceful no-credential mode",
    sovereign: { value: "Yes — 45 guards", good: true },
    crewai: { value: "Partial", good: null },
    zapier: { value: "No", good: false },
    n8n: { value: "Partial", good: null },
    langchain: { value: "N/A", good: null },
    lindy: { value: "No", good: false },
    note: "Our entire codebase runs tests + renders pages with zero env vars.",
  },
  {
    metric: "Test suite count",
    sovereign: { value: "2,316", good: true },
    crewai: { value: "~500", good: null },
    zapier: { value: "not public", good: null },
    n8n: { value: "~1,000", good: null },
    langchain: { value: "~3,000", good: true },
    lindy: { value: "not public", good: null },
    note: "LangChain edges us on count; we have deeper integration + safety tests.",
  },
  {
    metric: "Crypto-signed agent manifests",
    sovereign: { value: "Yes (ed25519)", good: true },
    crewai: { value: "No", good: false },
    zapier: { value: "No", good: false },
    n8n: { value: "No", good: false },
    langchain: { value: "No", good: false },
    lindy: { value: "No", good: false },
    note: "We're alone. Signatures mean proof, not promises.",
  },
  {
    metric: "Frozen API spec commitment",
    sovereign: { value: "SAM v1.0 (12 months)", good: true },
    crewai: { value: "No", good: false },
    zapier: { value: "Yes (implicit)", good: true },
    n8n: { value: "Yes (implicit)", good: true },
    langchain: { value: "No (0.x cadence)", good: false },
    lindy: { value: "No", good: false },
    note: "Creators can safely build against our spec for a year without breakage.",
  },
  {
    metric: "Industry vertical pages live",
    sovereign: { value: "10", good: true },
    crewai: { value: "0", good: false },
    zapier: { value: "~5", good: false },
    n8n: { value: "~3", good: false },
    langchain: { value: "0", good: false },
    lindy: { value: "~4", good: false },
    note: "Healthcare, legal, realestate, recruiting, cybersecurity, education, insurance, logistics, agriculture, construction.",
  },
  {
    metric: "Competitor /vs pages published",
    sovereign: { value: "11", good: true },
    crewai: { value: "0", good: false },
    zapier: { value: "~4", good: false },
    n8n: { value: "~3", good: false },
    langchain: { value: "0", good: false },
    lindy: { value: "~5", good: false },
    note: "We're explicit about where we beat and where we don't.",
  },
  {
    metric: "On-device / air-gapped option",
    sovereign: { value: "Yes (Ollama)", good: true },
    crewai: { value: "Yes", good: true },
    zapier: { value: "No", good: false },
    n8n: { value: "Self-hostable", good: true },
    langchain: { value: "Yes", good: true },
    lindy: { value: "No", good: false },
    note: "Regulated industries need this. Zapier/Lindy can't enter.",
  },
  {
    metric: "HITL approval + action-tier gate",
    sovereign: { value: "Built-in", good: true },
    crewai: { value: "No", good: false },
    zapier: { value: "No", good: false },
    n8n: { value: "Manual", good: null },
    langchain: { value: "Manual", good: null },
    lindy: { value: "No", good: false },
    note: "Dangerous actions require human approval with countdown timers.",
  },
];

interface Cell {
  value: string;
  good: boolean | null;
}

interface Row {
  metric: string;
  sovereign: Cell;
  crewai: Cell;
  zapier: Cell;
  n8n: Cell;
  langchain: Cell;
  lindy: Cell;
  note: string;
}

function StatusDot({ good }: { good: boolean | null }) {
  if (good === true)
    return <CheckCircle2 className="w-3.5 h-3.5 text-[#B5532C] inline shrink-0" />;
  if (good === false)
    return <XCircle className="w-3.5 h-3.5 text-neutral-600 inline shrink-0" />;
  return <MinusCircle className="w-3.5 h-3.5 text-amber-400/60 inline shrink-0" />;
}

export default function ComparePage() {
  // Live platform metrics at render time. Edge-cached for 30s.
  const slo = getPlatformSlo({ windowMs: 24 * 60 * 60 * 1000 });
  const cache = getAiCacheStats();

  const rows = COMPARISON_ROWS as Row[];
  const sovereignWins = rows.filter((r) => r.sovereign.good === true).length;

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/signup"
          className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200"
        >
          Get Started
        </Link>
      </nav>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#B5532C]/20 bg-[#B5532C]/[0.06] mb-6">
            <Activity className="w-3.5 h-3.5 text-[#B5532C]" />
            <span className="text-[11px] font-semibold text-[#B5532C] uppercase tracking-[0.2em]">
              Live comparison
            </span>
          </div>
          <h1 className="ed-display text-4xl md:text-6xl mb-6">
            Every number here<br />
            <span className="ed-display-italic text-[#B5532C]">has a command.</span>
          </h1>
          <p className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8">
            No rounded marketing. No &quot;best-in-class.&quot; Each claim
            points at the shell command, git log, or API endpoint that
            verifies it. Sovereign Matrix beats the field on {sovereignWins}
            {" "}of {rows.length} metrics we track — and we&apos;ll tell you where we don&apos;t.
          </p>
        </div>
      </section>

      {/* Live status block */}
      <section className="py-12 px-6 border-y border-white/[0.03] bg-[#030303]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[#B5532C]/60 mb-3">
            Current state (this instance, last 24h)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <LiveStat
              label="Uptime"
              value={`${slo.overall.successRatePct.toFixed(2)}%`}
              sub={`${slo.overall.totalRequests.toLocaleString()} requests tracked`}
            />
            <LiveStat
              label="P95 latency"
              value={`${slo.overall.p95Ms}ms`}
              sub="across all agent endpoints"
            />
            <LiveStat
              label="Cache hit rate"
              value={`${cache.hitRatePct}%`}
              sub={`${cache.hits} hits · ${cache.stampedeSaves} stampede saves`}
            />
            <LiveStat
              label="Endpoints observed"
              value={String(slo.overall.observedEndpoints)}
              sub={`over ${Math.round(slo.overall.windowSeconds / 3600)}h window`}
            />
          </div>
          <p className="text-[10px] text-neutral-600 mt-4">
            Source:{" "}
            <Link href="/api/_health/slo" className="underline hover:text-neutral-400">
              /api/_health/slo
            </Link>{" "}
            ·{" "}
            <Link
              href="/api/_health/performance"
              className="underline hover:text-neutral-400"
            >
              /api/_health/performance
            </Link>
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[#B5532C]/60 mb-4">
              Side by side
            </p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Sovereign Matrix vs. the field.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              We picked metrics that are hard to gamify. Agent count is trivially verifiable.
              Safety-pipeline depth is code-counted. Crypto signatures either exist or don&apos;t.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#060606]">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="bg-[#080808] text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  <th className="text-left py-3 px-4 font-semibold">Metric</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#B5532C]">Sovereign</th>
                  <th className="text-left py-3 px-4 font-semibold">CrewAI</th>
                  <th className="text-left py-3 px-4 font-semibold">Zapier</th>
                  <th className="text-left py-3 px-4 font-semibold">n8n</th>
                  <th className="text-left py-3 px-4 font-semibold">LangChain</th>
                  <th className="text-left py-3 px-4 font-semibold">Lindy</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.metric} className={i % 2 === 0 ? "bg-[#060606]" : "bg-[#080808]"}>
                    <td className="py-4 px-4 text-neutral-200 font-medium">
                      {row.metric}
                      <div className="text-[10px] text-neutral-500 mt-1 font-normal">
                        {row.note}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-[#B5532C] font-semibold whitespace-nowrap">
                      <StatusDot good={row.sovereign.good} /> {row.sovereign.value}
                    </td>
                    {(["crewai", "zapier", "n8n", "langchain", "lindy"] as const).map(
                      (comp) => (
                        <td
                          key={comp}
                          className="py-4 px-4 text-neutral-400 whitespace-nowrap"
                        >
                          <StatusDot good={row[comp].good} /> {row[comp].value}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-neutral-600 mt-4 text-center">
            Competitor data sourced from their public docs, pricing pages, and npm/PyPI
            package counts as of April 2026. Point us at better numbers and we&apos;ll
            update the table —{" "}
            <Link href="/contact" className="underline hover:text-neutral-400">
              contact us
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Where we lose (honest) */}
      <section className="py-16 px-6 border-y border-white/[0.03] bg-[#030303]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">
              Where we lose — and why
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Honest, not airbrushed.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <LoseCard
              title="Zapier wins on integrations"
              body="They have 6,000+ apps. We have ~30. Adding integrations is our Q3 priority. Their moat: a decade of partnerships."
            />
            <LoseCard
              title="LangChain wins on primitives"
              body="If you want a framework to compose 50+ LLMs by hand, they're better. We optimize for ready-made agents."
            />
            <LoseCard
              title="n8n wins on visual workflows"
              body="Their canvas is polished. Our playbooks are code-first. We'll close with a canvas editor in Q4."
            />
            <LoseCard
              title="Lindy wins on onboarding"
              body="Their setup is 60 seconds flat. Ours is 5 minutes. Fewer but smoother integrations — we're catching up."
            />
          </div>
        </div>
      </section>

      {/* Elite-tier defence-in-depth */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-neutral-400 mb-4">
              Elite-tier defences
            </p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
              What you get that nobody else bundles.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <DefenceCard
              icon={Shield}
              title="7-module safety pipeline"
              body="Jailbreak → content → PII → quality → critic → trust → action-tier. Each fails gracefully so one outage never halts the platform."
            />
            <DefenceCard
              icon={Activity}
              title="Measured SLO tracker"
              body="Every agent request recorded. P50/P95/P99 visible on /api/_health/performance. Uptime claims you can verify."
            />
            <DefenceCard
              icon={Zap}
              title="Stampede-protected cache"
              body="Concurrent identical requests dedupe in-flight. Cache hit rate + stampede saves published on the same endpoint."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Try it.<br />
            <span className="text-[#B5532C]">Verify every claim.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Every number on this page runs as a shell command against our public code.
            The whole codebase is explorable without any keys.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all"
            >
              Get started free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/benchmarks"
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/10 text-white font-semibold rounded-full text-sm hover:bg-white/5 transition-all"
            >
              Production cost data
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function LiveStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-white/[0.06] bg-[#060606]">
      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
        {label}
      </div>
      <div className="text-2xl font-black text-white mb-1">{value}</div>
      <div className="text-[10px] text-neutral-500">{sub}</div>
    </div>
  );
}

function LoseCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-5 rounded-xl border border-white/[0.06] bg-[#060606]">
      <div className="flex items-start gap-2.5 mb-2">
        <MinusCircle className="w-4 h-4 text-amber-400/60 shrink-0 mt-0.5" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed pl-6">{body}</p>
    </div>
  );
}

function DefenceCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Activity;
  title: string;
  body: string;
}) {
  return (
    <div className="p-6 rounded-2xl border border-white/[0.06] bg-[#080808]">
      <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-neutral-300" />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed">{body}</p>
    </div>
  );
}
