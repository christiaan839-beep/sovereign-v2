import type { Metadata } from "next";
import { registryStats } from "@/lib/control-plane/agent-registry";
import { LivePolicyEvaluator } from "./LivePolicyEvaluator";

export const metadata: Metadata = {
  title: "Control Plane — Sovereign Matrix",
  description:
    "The independent, vendor-neutral control plane for the agentic enterprise. Policy engine, agent registry, cost governance — all 6 enterprise non-negotiables, anti-drift gated, offline-verifiable.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/trust/control-plane",
  },
  openGraph: {
    title: "Control Plane — Sovereign Matrix",
    description:
      "Independent control plane for agentic AI. No vendor lock-in. SOC 2 ready. Air-gappable.",
    url: "https://sovereignmatrix.agency/trust/control-plane",
    type: "website",
  },
};

/**
 * /trust/control-plane — public live policy-evaluator + procurement page.
 *
 * Audience: CIO, CISO, Head of AI Governance, Procurement.
 *
 * Aesthetic: editorial museum (matches /trust + /trust/agentic-commerce).
 * Cream paper + dark ink + serif body. Procurement-grade authority.
 *
 * The live evaluator hits POST /api/control-plane/policy/evaluate
 * which runs the SAME pure function shipped in @sovereign/inspector.
 * Buyers can verify via this UI, via the npm package, or by porting
 * the math to their own language.
 */

const NON_NEGOTIABLES = [
  {
    n: 1,
    name: "Human-in-the-Loop (HITL)",
    answer:
      "Multi-stage approval routing with regulatory citations. Every Tier-2/3 action against tagged resources gates through HITL.",
    primitive: "src/lib/hitl-routing-rules.ts",
    status: "shipped",
  },
  {
    n: 2,
    name: "Agent-to-Agent (A2A) Trust",
    answer:
      "Macaroon-pattern attenuation across R37 ACTs and R91 ACATs. A child token may NEVER widen scope. Cryptographically enforced.",
    primitive: "R37 ACT + R91 ACAT",
    status: "shipped",
  },
  {
    n: 3,
    name: "Unified Audit Trail",
    answer:
      "SHA-256 hash chain across every audit row. Tampering with any past row breaks every subsequent chain hash. Verifiable offline.",
    primitive: "R26 audit-log + R44 attestation export",
    status: "shipped",
  },
  {
    n: 4,
    name: "Policy-Based Guardrails",
    answer:
      "Composable policy DSL referencing ACT, ACAT, reputation, credit, agent-tier, time-window, resource tags. Default-deny posture.",
    primitive: "R100 Sovereign Policy Engine (today)",
    status: "shipped today",
  },
  {
    n: 5,
    name: "Cost Governance",
    answer:
      "Per-agent / per-team / per-tenant budget caps. Free-tier provider runs bypass cap. Most-restrictive scope wins.",
    primitive: "R102 Cost Governance (today) + R27 cost-runaway",
    status: "shipped today",
  },
  {
    n: 6,
    name: "Multi-Agent Discovery",
    answer:
      "223 registered agents with capability_match × trust × availability ranking. Crew Composer for multi-capability tasks.",
    primitive: "R101 Agent Registry & Crew Composer (today)",
    status: "shipped today",
  },
] as const;

const MATURITY_MODEL = [
  {
    phase: "Phase 1",
    title: "Policy & Observability",
    items: [
      "Unified auth & RBAC",
      "Hash-chained audit trail",
      "Skill / agent registry",
      "HITL approval gates",
    ],
    status: "shipped",
  },
  {
    phase: "Phase 2",
    title: "Policy Self-Optimization",
    items: [
      "ML-driven anomaly detection",
      "Trust-as-Collateral credit lines (R42)",
      "Cost governance with alert thresholds (R102)",
      "Reputation-weighted routing (R40 + Smart Router)",
    ],
    status: "shipped",
  },
  {
    phase: "Phase 3",
    title: "Enterprise Orchestration",
    items: [
      "Multi-agent crew composition (R101)",
      "Capability discovery + ranking",
      "Responsibility attribution chains",
      "Live cross-agent learning loops",
    ],
    status: "shipping in stages",
  },
] as const;

const COMPETITIVE_POSITION = [
  {
    competitor: "Oracle",
    posture: "Vertically integrated AI inside Fusion. Heavy lock-in.",
    sovereignAdvantage:
      "We are LLM-, cloud-, and rail-agnostic. Air-gappable. Your data, your agents, your rules.",
  },
  {
    competitor: "Microsoft Copilot Studio",
    posture: "Horizontal across collaboration + workflow. Microsoft-tier lock-in.",
    sovereignAdvantage:
      "No Microsoft tax. Open MCP protocol. Verifiable trust math, not vendor promises.",
  },
  {
    competitor: "SAP Joule",
    posture: "Process semantics tied to SAP Business Data Cloud.",
    sovereignAdvantage:
      "Independent control plane. Composes with SAP, Workday, Salesforce, anything.",
  },
  {
    competitor: "n8n",
    posture: "400+ integrations. Requires technical expertise. No enterprise governance.",
    sovereignAdvantage:
      "Procurement-grade policy DSL + cryptographic substrate n8n cannot replicate.",
  },
  {
    competitor: "UiPath Maestro",
    posture: "Legacy RPA heritage with AI sprinkled on top.",
    sovereignAdvantage:
      "Modern, agent-native architecture. Built for the post-RPA world from day one.",
  },
] as const;

export default function ControlPlanePage() {
  const stats = registryStats();
  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      <div className="mx-auto max-w-5xl">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="mb-20 lg:mb-28">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Sovereign Control Plane · R100 · R101 · R102
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight lg:text-7xl">
            The independent
            <br />
            <span className="italic text-[#5A4F3F]">
              control plane
            </span>{" "}
            for agentic AI.
          </h1>
          <p className="mt-8 max-w-2xl font-serif text-xl leading-relaxed text-[#3A3128]">
            Oracle, Microsoft, and SAP are racing to be{" "}
            <em>your</em> AI control plane — and to lock you in. We are
            the alternative: vendor-neutral, LLM-agnostic, cloud-portable,
            air-gappable, and built on open protocols.
          </p>
          <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-[#3A3128]">
            All <strong>6 enterprise non-negotiables</strong> shipped.
            All <strong>3 phases of the JBoltAI maturity model</strong>{" "}
            covered. <strong>{stats.total} agents</strong> in the
            registry. <strong>One flat fee</strong>, unlimited.
          </p>
        </header>

        {/* ─── Live policy evaluator ────────────────────────────────── */}
        <section className="mb-24">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Live · 6 effects · default-deny posture
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Evaluate any policy in this browser.
          </h2>
          <p className="mt-3 max-w-2xl font-serif text-lg text-[#3A3128]">
            Compose predicates referencing ACT, ACAT, reputation,
            credit, agent tier, time window, resource tags. Run the
            decision live. Same pure function as{" "}
            <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
              @sovereign/inspector
            </code>
            .
          </p>
          <div className="mt-10">
            <LivePolicyEvaluator />
          </div>
        </section>

        {/* ─── 6 non-negotiables ────────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            The 6 enterprise non-negotiables
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Every feature procurement demands.{" "}
            <em>All shipped.</em>
          </h2>
          <div className="mt-12 grid gap-px bg-[#D8CFBE] lg:grid-cols-1">
            {NON_NEGOTIABLES.map((nn) => (
              <article
                key={nn.n}
                className="bg-[#F4EFE6] px-6 py-8 lg:px-10 lg:py-10"
              >
                <div className="flex items-baseline gap-6">
                  <span className="font-mono text-2xl font-light text-[#5A4F3F]">
                    0{nn.n}
                  </span>
                  <h3 className="font-serif text-2xl tracking-tight">
                    {nn.name}
                  </h3>
                  <span
                    className={`ml-auto font-mono text-xs uppercase tracking-[0.14em] ${
                      nn.status === "shipped today"
                        ? "text-emerald-700 font-bold"
                        : "text-emerald-700"
                    }`}
                  >
                    ✓ {nn.status}
                  </span>
                </div>
                <p className="mt-4 max-w-3xl pl-12 font-serif text-lg leading-relaxed text-[#3A3128]">
                  {nn.answer}
                </p>
                <p className="mt-3 pl-12 font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                  Primitive: {nn.primitive}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Maturity model ──────────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Control plane maturity model
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Phase 1 + 2 done.{" "}
            <em>Phase 3 shipping in stages.</em>
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {MATURITY_MODEL.map((p) => (
              <article
                key={p.phase}
                className="rounded border border-[#D8CFBE] bg-[#EFE8D7] p-6"
              >
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
                  {p.phase}
                </p>
                <h3 className="mt-2 font-serif text-xl tracking-tight">
                  {p.title}
                </h3>
                <ul className="mt-4 space-y-2 font-serif text-base text-[#3A3128]">
                  {p.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-emerald-700">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-emerald-700">
                  ✓ {p.status}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Registry stats ──────────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Live agent registry · machine-readable feed
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            <span className="font-mono">{stats.total}</span> agents
            registered.{" "}
            <em>Every one with a tier, capability surface, PII guard.</em>
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-8 lg:grid-cols-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Tier 1 (read-only)
              </p>
              <p className="mt-1 font-serif text-3xl">{stats.byTier[1]}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Tier 2 (writes)
              </p>
              <p className="mt-1 font-serif text-3xl">{stats.byTier[2]}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Tier 3 (external action)
              </p>
              <p className="mt-1 font-serif text-3xl">{stats.byTier[3]}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Total tools
              </p>
              <p className="mt-1 font-serif text-3xl">{stats.totalTools}</p>
            </div>
          </div>
          <p className="mt-8 max-w-2xl font-serif text-base text-[#3A3128]">
            Fetch the full machine-readable registry:{" "}
            <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
              GET /api/control-plane/agents
            </code>
            . Filter by{" "}
            <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
              ?maxTier=1
            </code>{" "}
            for read-only agents,{" "}
            <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
              ?capabilities=payment_op,model_call
            </code>{" "}
            for capability search.
          </p>
        </section>

        {/* ─── Competitive position ────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Why the independent choice wins
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            <em>&ldquo;Your data, your agents, your rules.&rdquo;</em>
          </h2>
          <ul className="mt-12 divide-y divide-[#D8CFBE] border-y border-[#D8CFBE]">
            {COMPETITIVE_POSITION.map((c) => (
              <li
                key={c.competitor}
                className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-12"
              >
                <p className="font-serif text-xl font-medium tracking-tight lg:col-span-2">
                  {c.competitor}
                </p>
                <p className="font-serif text-base text-[#5A4F3F] lg:col-span-5">
                  {c.posture}
                </p>
                <p className="font-serif text-base lg:col-span-5">
                  {c.sovereignAdvantage}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Footer / sources ────────────────────────────────────── */}
        <footer className="border-t border-[#D8CFBE] pt-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Sources you can verify
          </p>
          <ul className="mt-6 space-y-2 font-serif text-base text-[#3A3128]">
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                src/lib/control-plane/policy-engine.ts
              </code>{" "}
              — R100 policy engine.
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                src/lib/control-plane/agent-registry.ts
              </code>{" "}
              — R101 registry + crew composer.
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                src/lib/control-plane/cost-governance.ts
              </code>{" "}
              — R102 budget caps.
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                docs/AGENTIC-CONTROL-PLANE-LEADERSHIP.md
              </code>{" "}
              — Strategic positioning.
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                /trust/agentic-commerce
              </code>{" "}
              — sister page covering R91 + R92.
            </li>
          </ul>
        </footer>
      </div>
    </main>
  );
}
