import type { Metadata } from "next";
import {
  DEFAULT_PERFORMANCE_TARGETS,
  targetRegistryStats,
  listTargets,
} from "@/lib/performance";
import { LiveBenchmarkBoard } from "./LiveBenchmarkBoard";

export const metadata: Metadata = {
  title: "Performance Observatory — Sovereign Matrix",
  description:
    "The procurement-grade scoreboard of what 'elite' performance means in 2026 — and Sovereign's commitments. Anti-AI-washing by design: every score carries a verificationKind + runHash.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/trust/performance-observatory",
  },
  openGraph: {
    title: "Performance Observatory — Sovereign Matrix",
    description:
      "Honest performance scoreboard. SWE-bench Pro, GAIA L3, LongMemEval, gateway throughput — verificationKind + runHash mandatory.",
    url: "https://sovereignmatrix.agency/trust/performance-observatory",
    type: "website",
  },
};

const PHASES = [
  {
    id: "phase-1" as const,
    name: "Phase 1 (months 1-3)",
    blurb:
      "Enterprise-Ready Foundation — agent control plane, graph memory, SOC 2 / ISO 27001, 100+ connectors.",
  },
  {
    id: "phase-2" as const,
    name: "Phase 2 (months 4-6)",
    blurb:
      "Developer & Analyst Powerhouse — ultra-long-context, multi-agent swarms, ≥80% SWE-bench Verified, ≥50% SWE-bench Pro, >60% GAIA L3.",
  },
  {
    id: "phase-3" as const,
    name: "Phase 3 (months 7-12)",
    blurb:
      "Symbiotic Digital Workforce — self-healing, autonomous UI control, 350+ rps gateway, 10K msg/s broker, edge + air-gapped.",
  },
];

const ARCHITECTURE_VS = [
  {
    label: "Cherry-picked benchmarks",
    detail:
      "Vendor publishes the easy benchmark, hides the hard one. SWE-bench Verified at 81%, but SWE-bench Pro 46%. Procurement learns the gap too late.",
    badge: "Industry default",
    accent: "rose",
  },
  {
    label: "Generic dashboard",
    detail:
      "DB-backed scoreboard with 'current' vs 'target.' Nothing structurally prevents AI-washing — anyone can update current_value with no measurement audit.",
    badge: "Most platforms",
    accent: "amber",
  },
  {
    label: "Sovereign Performance Observatory",
    detail:
      "Every target has a verificationKind. Every result requires runHash + measuredAt + harnessCommit + datasetVersion + modelId. Dashboard refuses to claim a score without a measurement. Inspector replays the math.",
    badge: "Today (R130)",
    accent: "emerald",
  },
] as const;

const ANTI_AI_WASHING_RULES = [
  {
    rule: "verificationKind is required",
    detail:
      "Every target carries one of independent-replayable / internal-only / claimed-only. Procurement teams filter on this.",
  },
  {
    rule: "runHash is required for results",
    detail:
      "Empty runHash → result rejected. Without it, there's no audit trail tying a claimed score to a reproducible measurement.",
  },
  {
    rule: "measuredAt + source are required",
    detail:
      "Source must include harnessCommit + datasetVersion + modelId. The full reproducibility envelope, never inferred.",
  },
  {
    rule: "Verification can never be downgraded",
    detail:
      "If a target is independent-replayable, a result claiming only internal-only is rejected. You can't silently weaken rigor.",
  },
  {
    rule: "Dashboard shows 'not measured' honestly",
    detail:
      "When a target has no recorded result, the dashboard explicitly says so — not 'pending,' not '—,' but a procurement-grade explanation.",
  },
] as const;

export default function PerformanceObservatoryPage() {
  const stats = targetRegistryStats(DEFAULT_PERFORMANCE_TARGETS);
  const targets = listTargets();

  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      <div className="mx-auto max-w-5xl">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="mb-20 lg:mb-28">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Sovereign Performance Observatory · R130
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight lg:text-7xl">
            We refuse to lie
            <br />
            <span className="italic text-[#5A4F3F]">
              about our own performance.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl font-serif text-xl leading-relaxed text-[#3A3128]">
            Vendors cherry-pick the easy benchmarks. SWE-bench Verified
            says 81%; SWE-bench Pro (the contamination-resistant
            version) drops the same model to 46%.{" "}
            <strong>
              The Performance Observatory is structurally anti-AI-washing
            </strong>
            : every target carries a{" "}
            <code className="font-mono text-base">verificationKind</code>;
            every result requires a{" "}
            <code className="font-mono text-base">runHash</code> plus a
            full measurement envelope.
          </p>
          <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-[#3A3128]">
            The dashboard refuses to claim a score without a
            measurement. Procurement gets <em>receipts</em>, not press
            releases. Inspector replays the math offline.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-8 lg:grid-cols-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Targets registered
              </p>
              <p className="mt-1 font-serif text-3xl">{stats.total}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Phase-1 / 2 / 3 split
              </p>
              <p className="mt-1 font-serif text-3xl">
                {stats.byPhase["phase-1"]} / {stats.byPhase["phase-2"]} /{" "}
                {stats.byPhase["phase-3"]}
              </p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Independent-replayable
              </p>
              <p className="mt-1 font-serif text-3xl">
                {stats.byVerification["independent-replayable"]}
              </p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Claimed-only (still aspirational)
              </p>
              <p className="mt-1 font-serif text-3xl">
                {stats.byVerification["claimed-only"]}
              </p>
            </div>
          </div>
        </header>

        {/* ─── Live board ──────────────────────────────────────────── */}
        <section className="mb-24">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Live · gap analysis · linear time-to-target
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Pick a target. Submit a synthetic history.{" "}
            <em>See the gap report.</em>
          </h2>
          <p className="mt-3 max-w-2xl font-serif text-lg text-[#3A3128]">
            The board hits POST /api/performance/gap-analysis which runs
            the SAME pure function as @sovereign/inspector. CI pipelines
            use this to verify that benchmark trajectories are tracking
            toward target.
          </p>
          <div className="mt-10">
            <LiveBenchmarkBoard />
          </div>
        </section>

        {/* ─── Architecture comparison ────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Why structural rules beat dashboards
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Three approaches.{" "}
            <em>Only one is anti-AI-washing by design.</em>
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {ARCHITECTURE_VS.map((a) => (
              <article
                key={a.label}
                className={`rounded border-l-4 bg-[#EFE8D7] p-6 ${
                  a.accent === "rose"
                    ? "border-rose-700"
                    : a.accent === "amber"
                    ? "border-amber-700"
                    : "border-emerald-700"
                }`}
              >
                <p
                  className={`font-mono text-xs uppercase tracking-[0.18em] ${
                    a.accent === "rose"
                      ? "text-rose-700"
                      : a.accent === "amber"
                      ? "text-amber-700"
                      : "text-emerald-700"
                  }`}
                >
                  {a.badge}
                </p>
                <h3 className="mt-2 font-serif text-xl tracking-tight">
                  {a.label}
                </h3>
                <p className="mt-3 font-serif text-base leading-relaxed text-[#3A3128]">
                  {a.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── 5 anti-AI-washing rules ────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            The five anti-AI-washing rules
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            <em>Type-system enforced.</em> Anti-drift gated.
          </h2>
          <ul className="mt-12 divide-y divide-[#D8CFBE] border-y border-[#D8CFBE]">
            {ANTI_AI_WASHING_RULES.map((r) => (
              <li
                key={r.rule}
                className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-12"
              >
                <code className="font-mono text-sm uppercase tracking-[0.12em] text-[#5A4F3F] lg:col-span-3">
                  {r.rule}
                </code>
                <p className="font-serif text-base lg:col-span-9">{r.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Three-phase roadmap ─────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            12-month elite-tier roadmap
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Three phases.{" "}
            <em>Public commitments, replayable evidence.</em>
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PHASES.map((p) => {
              const phaseTargets = targets.filter((t) => t.phase === p.id);
              return (
                <article
                  key={p.id}
                  className="rounded border border-[#D8CFBE] bg-[#EFE8D7] p-6"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
                    {p.name}
                  </p>
                  <p className="mt-3 font-serif text-base leading-relaxed text-[#3A3128]">
                    {p.blurb}
                  </p>
                  <ul className="mt-4 space-y-1 font-serif text-sm">
                    {phaseTargets.map((t) => (
                      <li key={t.id} className="text-[#3A3128]">
                        <code className="font-mono text-xs text-[#5A4F3F]">
                          {t.id}
                        </code>
                        : target {t.targetValue}
                        {t.unit} (SOTA {t.sotaValue}
                        {t.unit})
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        {/* ─── Live target table ──────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Live registry feed · machine-readable at /api/performance/targets
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            <em>Every target. Every SOTA citation. Every commitment.</em>
          </h2>
          <ul className="mt-12 divide-y divide-[#D8CFBE] border-y border-[#D8CFBE]">
            {targets.map((t) => (
              <li
                key={t.id}
                className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-12"
              >
                <div className="lg:col-span-4">
                  <code className="font-mono text-sm text-[#5A4F3F]">
                    {t.id}
                  </code>
                  <p className="mt-1 font-serif text-base font-medium">
                    {t.name}
                  </p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-amber-700">
                    {t.verificationKind}
                  </p>
                </div>
                <div className="lg:col-span-8">
                  <p className="font-serif text-base">
                    Sovereign target:{" "}
                    <strong>
                      {t.direction === "higher-is-better" ? "≥" : "≤"}{" "}
                      {t.targetValue}
                      {t.unit}
                    </strong>{" "}
                    · SOTA: {t.sotaValue}
                    {t.unit}
                  </p>
                  <p className="mt-1 font-serif text-sm text-[#5A4F3F]">
                    {t.description}
                  </p>
                  <p className="mt-1 font-serif text-xs italic text-[#5A4F3F]">
                    SOTA source: {t.sotaSource}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Footer ──────────────────────────────────────────────── */}
        <footer className="border-t border-[#D8CFBE] pt-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Sources you can verify
          </p>
          <ul className="mt-6 space-y-2 font-serif text-base text-[#3A3128]">
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                src/lib/performance/
              </code>{" "}
              — R130 framework: targets, results, gap-analysis, attestation.
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                docs/PERFORMANCE-OBSERVATORY.md
              </code>{" "}
              — Strategic positioning + integration roadmap (R131-R138 harness adapters).
            </li>
            <li>
              Public APIs:{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                GET /api/performance/targets
              </code>{" "}
              ·{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                POST /api/performance/results/verify
              </code>{" "}
              ·{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                POST /api/performance/gap-analysis
              </code>
            </li>
            <li>
              Sister pages:{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                /trust/edge-nodes
              </code>{" "}
              ·{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                /trust/control-plane
              </code>{" "}
              ·{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                /trust/perception
              </code>{" "}
              ·{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                /trust/agentic-commerce
              </code>
            </li>
          </ul>
        </footer>
      </div>
    </main>
  );
}
