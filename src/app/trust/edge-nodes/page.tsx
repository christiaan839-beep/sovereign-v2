import type { Metadata } from "next";
import {
  createDefaultEdgeNodeRegistry,
  edgeNodeRegistryStats,
  listEdgeNodes,
} from "@/lib/edge-nodes";
import { LiveEdgeDispatcher } from "./LiveEdgeDispatcher";

export const metadata: Metadata = {
  title: "Edge Nodes — Sovereign Matrix",
  description:
    "The formal boundary between Sovereign and the open-source agentic ecosystem. Three procurement-grade personas (Software Engineer, Analyst, Operator) — every dispatch wrapped by R100 policy, R102 cost, R26 audit, R37 ACT.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/trust/edge-nodes",
  },
  openGraph: {
    title: "Edge Nodes — Sovereign Matrix",
    description:
      "Stub-first, fail-closed adapter framework. Plug in Trae Agent, CUA, Cognee, Kimi K2.6, UI-TARS — under our trust substrate.",
    url: "https://sovereignmatrix.agency/trust/edge-nodes",
    type: "website",
  },
};

const PERSONAS = [
  {
    id: "software-engineer",
    name: "Software Engineer",
    blurb:
      "Autonomous coding swarm — feature requests in, tested + reviewed code out. Wraps Trae Agent + AgentFlow + Werkstatt under R26 audit + R100 policy + R37 ACT.",
    upstreams: ["Trae Agent", "AgentFlow", "Werkstatt"],
    deployment: "customer-cloud",
    rounds: "R121-R123",
  },
  {
    id: "analyst",
    name: "Enterprise Analyst",
    blurb:
      "Research + reasoning swarm — ingests documents, builds traceable knowledge graphs, plans queries, produces executive summaries. Wraps Kimi K2.6 + Cognee + Qualixar OS.",
    upstreams: ["Kimi K2.6", "Cognee", "Qualixar OS"],
    deployment: "customer-cloud",
    rounds: "R124-R126",
  },
  {
    id: "operator",
    name: "Operator",
    blurb:
      "UI-automation workforce — sees screens, clicks buttons, navigates legacy enterprise apps. Wraps UI-TARS-desktop + CUA + Understudy. Tier 3 by default; HITL-required for prod.",
    upstreams: ["UI-TARS-desktop", "CUA", "Understudy"],
    deployment: "customer-cloud",
    rounds: "R127-R129",
  },
] as const;

const ARCHITECTURE_VS = [
  {
    label: "Direct integration (no framework)",
    detail:
      "Each open-source project glued ad-hoc to the platform. Different auth patterns. Different audit shapes. Different cost models. Customer adopts 4 projects = 4 separate trust audits.",
    badge: "Most agent platforms",
    accent: "rose",
  },
  {
    label: "Single-vendor integration suite",
    detail:
      "Microsoft Agent Framework, Salesforce Einstein, Oracle Fusion AI bundle in their own integrations only. You get one vendor's choice; lock-in is the model.",
    badge: "Closed control planes",
    accent: "amber",
  },
  {
    label: "Sovereign Edge Node Framework",
    detail:
      "Stub-first, fail-closed adapter contract. Every dispatch wrapped by R100 policy + R102 cost + R26 audit + R37 ACT. Customers replace stubs with whichever upstream they trust — and the trust substrate is the same regardless of choice.",
    badge: "Today (R120)",
    accent: "emerald",
  },
] as const;

const COMPOSITION_LAYERS = [
  {
    layer: "R100 Policy Engine",
    role: "Gates every dispatch — deny / hitl / acat-require / break-glass.",
  },
  {
    layer: "R102 Cost Governance",
    role: "Per-tenant + per-team + per-agent budget caps; most-restrictive wins.",
  },
  {
    layer: "R37 ACT capability tokens",
    role: "Capability delegation — agents only spawn Edge Nodes for actions they hold an ACT for.",
  },
  {
    layer: "R91 ACAT (commerce)",
    role: "Commerce-bearing dispatches require ACAT in scope; offline-verifiable.",
  },
  {
    layer: "R26 Audit Chain",
    role: "Every dispatch + every result + every error written hash-chained.",
  },
  {
    layer: "@sovereign/inspector",
    role: "All routing + preflight decisions replay offline — same pure functions, no Sovereign network call.",
  },
] as const;

export default function EdgeNodesPage() {
  const registry = createDefaultEdgeNodeRegistry();
  const stats = edgeNodeRegistryStats(registry);
  const manifests = listEdgeNodes(registry);

  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      <div className="mx-auto max-w-5xl">
        {/* ─── Hero ────────────────────────────────────────────────── */}
        <header className="mb-20 lg:mb-28">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Sovereign Edge Node Framework · R120
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight lg:text-7xl">
            The formal boundary
            <br />
            <span className="italic text-[#5A4F3F]">
              between Sovereign and the
            </span>
            <br />
            open-source agentic ecosystem.
          </h1>
          <p className="mt-8 max-w-2xl font-serif text-xl leading-relaxed text-[#3A3128]">
            Plenty of platforms claim to integrate Trae Agent, CUA,
            Cognee, Kimi K2.6, UI-TARS-desktop. Anyone can call those
            APIs.{" "}
            <strong>
              The moat is integrating them under the same trust
              substrate as our internal agents.
            </strong>
          </p>
          <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-[#3A3128]">
            Three procurement-grade personas. Stub-first. Fail-closed
            by default. Every dispatch wrapped by R100 policy, R102
            cost, R26 audit, R37 ACT. <em>Replace any stub with your
            preferred upstream</em> — the substrate doesn&apos;t change.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-8 lg:grid-cols-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Personas
              </p>
              <p className="mt-1 font-serif text-3xl">
                {stats.byPersona["software-engineer"] +
                  stats.byPersona.analyst +
                  stats.byPersona.operator}
              </p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Stubs ready to wire
              </p>
              <p className="mt-1 font-serif text-3xl">{stats.stubCount}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Configured
              </p>
              <p className="mt-1 font-serif text-3xl">
                {stats.configuredCount}
              </p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                Air-gappable
              </p>
              <p className="mt-1 font-serif text-3xl">
                {stats.byDeployment["air-gapped"] +
                  stats.byDeployment["customer-cloud"]}
              </p>
            </div>
          </div>
        </header>

        {/* ─── Live dispatcher ─────────────────────────────────────── */}
        <section className="mb-24">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Live · preview-only · zero side effects
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Preview an Edge Node dispatch.
          </h2>
          <p className="mt-3 max-w-2xl font-serif text-lg text-[#3A3128]">
            Pick a scenario, hit dispatch. The platform computes
            routing + preflight (policy / cost / ACT / ACAT) + the
            DispatchResult that <em>would</em> be returned. No Edge
            Node is invoked. Same pure functions as{" "}
            <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
              @sovereign/inspector
            </code>
            .
          </p>
          <div className="mt-10">
            <LiveEdgeDispatcher />
          </div>
        </section>

        {/* ─── Architecture comparison ──────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Why a framework beats direct integration
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            One trust substrate.{" "}
            <em>Any open-source upstream you choose.</em>
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

        {/* ─── Three personas ──────────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Three procurement-grade personas
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            <em>Each ships as a stub today.</em> Replace with your
            preferred upstream.
          </h2>
          <div className="mt-12 grid gap-px bg-[#D8CFBE] lg:grid-cols-1">
            {PERSONAS.map((p) => (
              <article
                key={p.id}
                className="bg-[#F4EFE6] px-6 py-6 lg:px-10 lg:py-8"
              >
                <div className="flex items-baseline gap-6">
                  <code className="font-mono text-sm uppercase tracking-[0.14em] text-[#5A4F3F]">
                    {p.id}
                  </code>
                  <h3 className="font-serif text-2xl tracking-tight">
                    {p.name}
                  </h3>
                  <span className="ml-auto font-mono text-xs uppercase tracking-[0.14em] text-amber-700">
                    Stub today · {p.rounds}
                  </span>
                </div>
                <p className="mt-3 max-w-3xl font-serif text-lg leading-relaxed text-[#3A3128]">
                  {p.blurb}
                </p>
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                  Upstreams: {p.upstreams.join(" · ")} · Deployment: {p.deployment}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Manifest detail (live from registry) ────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Live registry feed · machine-readable at /api/edge-nodes
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            <em>Every node, every capability, every upstream — auditable.</em>
          </h2>
          <ul className="mt-12 divide-y divide-[#D8CFBE] border-y border-[#D8CFBE]">
            {manifests.map((m) => (
              <li
                key={m.id}
                className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-12"
              >
                <div className="lg:col-span-3">
                  <code className="font-mono text-sm text-[#5A4F3F]">
                    {m.id}
                  </code>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-amber-700">
                    {m.isStub ? "STUB" : "configured"}
                  </p>
                </div>
                <div className="lg:col-span-9">
                  <p className="font-serif text-base">
                    Capabilities: {m.capabilities.join(", ")}
                  </p>
                  <p className="mt-1 font-serif text-sm text-[#5A4F3F]">
                    Upstreams:{" "}
                    {m.upstreamProjects
                      .map((u) => `${u.name} (${u.license})`)
                      .join(" · ")}
                  </p>
                  {m.regulatoryNotes && m.regulatoryNotes.length > 0 && (
                    <p className="mt-1 font-serif text-sm text-[#5A4F3F]">
                      Regulatory: {m.regulatoryNotes.join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Composition layers ──────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Trust substrate · what wraps every dispatch
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            <em>Six layers.</em> Same as our internal agents.
          </h2>
          <ul className="mt-12 divide-y divide-[#D8CFBE] border-y border-[#D8CFBE]">
            {COMPOSITION_LAYERS.map((c) => (
              <li
                key={c.layer}
                className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-12"
              >
                <code className="font-mono text-sm uppercase tracking-[0.12em] text-[#5A4F3F] lg:col-span-3">
                  {c.layer}
                </code>
                <p className="font-serif text-base lg:col-span-9">{c.role}</p>
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
                src/lib/edge-nodes/
              </code>{" "}
              — R120 framework + persona stubs.
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                docs/EDGE-NODE-FRAMEWORK.md
              </code>{" "}
              — Strategic positioning + integration roadmap (R121-R129).
            </li>
            <li>
              Public APIs:{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                GET /api/edge-nodes
              </code>{" "}
              ·{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                POST /api/edge-nodes/dispatch
              </code>
            </li>
            <li>
              Sister pages:{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                /trust/agentic-commerce
              </code>{" "}
              ·{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                /trust/control-plane
              </code>{" "}
              ·{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                /trust/perception
              </code>
            </li>
          </ul>
        </footer>
      </div>
    </main>
  );
}
