/**
 * /admin/agents — agent fleet visualization for admins.
 *
 * Reads the public manifest endpoint /api/_meta/agents.json and
 * renders:
 *   - tier distribution (1-autonomous / 2-confirm / 3-admin-approval)
 *   - per-agent capability badges (PII handling / external network /
 *     model providers)
 *   - low-confidence agents that need manual review
 *   - the full table with filters
 *
 * Server component — fetches the manifest at render time. Cache hits
 * the same edge-cached endpoint customers use so render is fast.
 *
 * Admin-gated via requireAdmin(). Non-admins get a 404 (matches the
 * pattern in /api/admin/*).
 */

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getBaseUrl } from "@/lib/base-url";

interface AgentManifestSummary {
  slug: string;
  tier: 1 | 2 | 3;
  tierReason: string;
  outputClass: "public" | "tenant-private" | "confidential";
  models: Array<{ provider: string; inferenceFn: string }>;
  tools: Array<{ name: string; origin: string }>;
  pii: { guardMode: string; handlesByDesign: boolean };
  signals: Array<{ kind: string; detail?: string }>;
  classifierConfidence: number;
}

interface AgentsManifestResponse {
  count: number;
  tierDistribution: {
    "1-autonomous": number;
    "2-confirm": number;
    "3-admin-approval": number;
  };
  manualOverrides: Array<{ slug: string; reason: string; tier?: number }>;
  lowConfidenceAgents: string[];
  agents: Record<string, AgentManifestSummary>;
}

async function loadManifests(): Promise<AgentsManifestResponse | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/_meta/agents.json`, {
      // 5-min revalidation — gives admins fresh data without round-tripping
      // every render.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as AgentsManifestResponse;
  } catch {
    return null;
  }
}

const TIER_BADGE: Record<1 | 2 | 3, { label: string; classes: string }> = {
  1: { label: "T1 autonomous", classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  2: { label: "T2 confirm", classes: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
  3: { label: "T3 admin", classes: "border-rose-500/30 bg-rose-500/10 text-rose-200" },
};

const OUTPUT_CLASS_BADGE: Record<string, string> = {
  public: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  "tenant-private": "border-neutral-500/30 bg-neutral-500/10 text-neutral-300",
  confidential: "border-violet-500/30 bg-violet-500/10 text-violet-200",
};

export default async function AdminAgentsPage() {
  const gate = await requireAdmin();
  if (gate instanceof Response) {
    notFound();
  }

  const manifest = await loadManifests();
  if (!manifest) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16 text-neutral-200">
        <h1 className="text-2xl font-bold">Agent fleet</h1>
        <p className="mt-3 text-sm text-rose-400">
          Could not load /api/_meta/agents.json. Check that the build
          regenerated the manifests.
        </p>
      </main>
    );
  }

  const total = manifest.count;
  const t1 = manifest.tierDistribution["1-autonomous"];
  const t2 = manifest.tierDistribution["2-confirm"];
  const t3 = manifest.tierDistribution["3-admin-approval"];

  // Sort agents alphabetically.
  const agentList = Object.values(manifest.agents).sort((a, b) =>
    a.slug.localeCompare(b.slug),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-neutral-200">
      <header className="mb-8">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-bold">Agent fleet</h1>
          <a
            href="/api/_meta/agents.json"
            className="text-xs text-neutral-500 underline hover:text-neutral-300"
          >
            raw JSON ↗
          </a>
        </div>
        <p className="mt-2 text-sm text-neutral-400">
          {total} agents registered.{" "}
          {manifest.manualOverrides.length} manual overrides.{" "}
          {manifest.lowConfidenceAgents.length} low-confidence.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3 mb-10">
        <TierCard tier={1} count={t1} total={total} />
        <TierCard tier={2} count={t2} total={total} />
        <TierCard tier={3} count={t3} total={total} />
      </section>

      {manifest.lowConfidenceAgents.length > 0 && (
        <section className="mb-10 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="text-xs uppercase tracking-wide text-amber-400">
            Manual review recommended ({manifest.lowConfidenceAgents.length})
          </div>
          <p className="mt-1 text-sm text-neutral-300">
            Static analyzer confidence is below 0.6 for these agents.
            Add a documented override in{" "}
            <code className="text-xs text-neutral-400">
              src/lib/agent-manifest-overrides.ts
            </code>{" "}
            or improve the patterns in{" "}
            <code className="text-xs text-neutral-400">
              scripts/analyze-agent-manifests.mjs
            </code>
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {manifest.lowConfidenceAgents.map((slug) => (
              <span
                key={slug}
                className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[11px] font-mono text-amber-200"
              >
                {slug}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">All agents</h2>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase text-neutral-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Slug</th>
                <th className="text-left px-4 py-3 font-medium">Tier</th>
                <th className="text-left px-4 py-3 font-medium">Output</th>
                <th className="text-left px-4 py-3 font-medium">Models</th>
                <th className="text-left px-4 py-3 font-medium">Tools</th>
                <th className="text-left px-4 py-3 font-medium">PII</th>
                <th className="text-left px-4 py-3 font-medium">Conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {agentList.map((a) => (
                <tr key={a.slug} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 font-mono text-xs text-neutral-200">
                    {a.slug}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-medium ${TIER_BADGE[a.tier].classes}`}
                    >
                      {TIER_BADGE[a.tier].label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[10px] ${OUTPUT_CLASS_BADGE[a.outputClass] ?? ""}`}
                    >
                      {a.outputClass}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-400">
                    {a.models.length === 0 ? (
                      <span className="text-neutral-600">—</span>
                    ) : (
                      [...new Set(a.models.map((m) => m.provider))].join(", ")
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-400">
                    {a.tools.length === 0 ? (
                      <span className="text-neutral-600">—</span>
                    ) : (
                      a.tools.map((t) => t.name).join(", ")
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-400">
                    {a.pii.handlesByDesign ? (
                      <span className="text-amber-400">flag-mode</span>
                    ) : (
                      <span className="text-neutral-500">{a.pii.guardMode}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-400 text-right">
                    {(a.classifierConfidence * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-10 text-xs text-neutral-500">
        Source: <code>scripts/analyze-agent-manifests.mjs</code> +{" "}
        <code>src/lib/agent-manifest-overrides.ts</code>. Regenerated
        on every <code>npm run gen:registry</code>. Live at{" "}
        <a href="/api/_meta/agents.json" className="underline hover:text-neutral-300">
          /api/_meta/agents.json
        </a>
        .
      </footer>
    </main>
  );
}

function TierCard({
  tier,
  count,
  total,
}: {
  tier: 1 | 2 | 3;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const badge = TIER_BADGE[tier];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
      <div
        className={`inline-block rounded border px-2 py-0.5 text-[10px] font-medium ${badge.classes}`}
      >
        {badge.label}
      </div>
      <div className="mt-3 text-3xl font-bold text-white">{count}</div>
      <div className="mt-1 text-xs text-neutral-400">
        {pct}% of fleet
      </div>
    </div>
  );
}
