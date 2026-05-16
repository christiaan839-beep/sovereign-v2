/**
 * /dashboard/governance — Wave 20 elite-tier surface.
 *
 * The operator's one-screen answer to every CISO question. Pulls:
 *   - Wave 16: live JIT agent tokens (with one-click revoke).
 *   - Wave 7:  recent agent receipts (each linkable to /auditor/replay).
 *   - Wave 9:  latest Bitcoin-anchored audit chain head + row count.
 *   - Wave 15: live success rate + p95 latency.
 *
 * Admin-only — the page redirects to the dashboard when the visitor
 * is not on the ADMIN_USER_IDS allowlist. Brand-strict (cyan / copper),
 * no marketing fluff, no emoji.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin-auth";
import { listActiveTokens } from "@/lib/agent-tokens";
import { computeStatusMetrics } from "@/lib/status-metrics";
import { db } from "@/db";
import { agentRuns, auditLogAnchors } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ShieldCheck, KeyRound, Anchor, Activity } from "lucide-react";
import { RevokeButton } from "./RevokeButton";

export const metadata: Metadata = {
  title: "Governance — Sovereign Matrix",
  description:
    "Admin-only operator surface: live agent tokens, recent receipts, audit-chain head, one-click revoke.",
};

export const dynamic = "force-dynamic";

export default async function GovernancePage() {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) {
    redirect("/dashboard");
  }

  // Parallel fetches — every block is independent and degrades to an
  // empty list on missing tables.
  const [tokens, metrics, recentRuns, latestAnchor] = await Promise.all([
    listActiveTokens({ limit: 25 }),
    computeStatusMetrics(),
    safeRecentRuns(),
    safeLatestAnchor(),
  ]);

  const window24h = metrics.windows.find((w) => w.window === "24h");

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          GOVERNANCE · ADMIN ONLY · ONE-CLICK CONTROL PLANE
        </p>
        <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-[-0.02em] text-white mb-3">
          Every agent.
          <br />
          <span className="text-[#B5532C]">Revocable in one click.</span>
        </h1>
        <p className="text-[15px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          Live identity tokens, recent receipts, the Bitcoin-anchored
          audit-chain head, and production health — all on one screen. Any token
          can be revoked instantly; every revoke action is itself a
          receipt-anchored audit row.
        </p>

        {/* Top KPIs — 4 cards across */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-12">
          <Kpi
            icon={KeyRound}
            label="Active tokens"
            value={tokens.length.toString()}
            sub="Wave 16 · JIT"
          />
          <Kpi
            icon={Activity}
            label="24h success rate"
            value={
              window24h && window24h.count > 0
                ? `${(window24h.successRate * 100).toFixed(2)}%`
                : "—"
            }
            sub={`${window24h?.count.toLocaleString() ?? "0"} runs`}
          />
          <Kpi
            icon={ShieldCheck}
            label="24h p95 latency"
            value={
              window24h?.latencyMs.p95 != null
                ? `${Math.round(window24h.latencyMs.p95).toLocaleString()} ms`
                : "—"
            }
            sub="Wave 15 · live"
          />
          <Kpi
            icon={Anchor}
            label="Anchored rows"
            value={latestAnchor?.rowCount.toLocaleString() ?? "—"}
            sub={
              latestAnchor
                ? `${new Date(latestAnchor.attestedAt).toISOString().slice(0, 10)}`
                : "Wave 9 · pending"
            }
          />
        </div>

        {/* Active tokens — with revoke action */}
        <Section title="01 · Active agent identity tokens">
          {tokens.length === 0 ? (
            <EmptyHint>No agents are currently in flight.</EmptyHint>
          ) : (
            <div className="space-y-2">
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 border border-white/[0.06] rounded-[3px] bg-white/[0.015]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-mono text-[11px] text-[#E08558] tracking-[0.15em] uppercase">
                        {t.agentSlug}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/80">
                        {t.scheme}
                      </span>
                      <span className="font-mono text-[9px] text-neutral-500">
                        expires{" "}
                        {new Date(t.expiresAt).toISOString().slice(11, 19)}Z
                      </span>
                    </div>
                    <code className="font-mono text-[10px] text-neutral-400 break-all">
                      {t.id}
                    </code>
                  </div>
                  <RevokeButton tokenId={t.id} />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Recent receipts */}
        <Section title="02 · Recent agent receipts (last 10)">
          {recentRuns.length === 0 ? (
            <EmptyHint>
              No agent_runs visible — either the table is empty in this
              environment, or the migration hasn&apos;t been applied.
            </EmptyHint>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((r) => (
                <Link
                  key={r.id}
                  href={`/auditor/replay?id=${encodeURIComponent(r.id)}`}
                  className="block px-4 py-3 border border-white/[0.06] rounded-[3px] bg-white/[0.015] hover:bg-white/[0.04] hover:border-cyan-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="font-mono text-[11px] text-[#E08558] tracking-[0.15em] uppercase mr-3">
                        {r.agentName}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-500">
                        {r.modelUsed}
                      </span>
                      <span
                        className={`ml-3 font-mono text-[9px] uppercase tracking-[0.15em] ${
                          r.trustDecision === "blocked"
                            ? "text-rose-300"
                            : r.trustDecision === "needs-approval"
                              ? "text-amber-300"
                              : "text-cyan-300"
                        }`}
                      >
                        {r.trustDecision}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-neutral-600">
                      {new Date(r.createdAt).toISOString().slice(0, 19)}Z ·{" "}
                      {r.durationMs}ms
                    </span>
                  </div>
                  <code className="block mt-1 font-mono text-[10px] text-neutral-500 break-all">
                    {r.id}
                  </code>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* Audit chain head */}
        <Section title="03 · Audit-log chain head (Bitcoin-anchored)">
          {latestAnchor ? (
            <div className="px-4 py-4 border border-cyan-500/20 bg-cyan-500/[0.04] rounded-[3px]">
              <p className="font-mono text-[10px] text-cyan-300/80 tracking-[0.2em] uppercase mb-2">
                chain head · sha-256
              </p>
              <code className="block font-mono text-[12px] text-cyan-200 break-all mb-3">
                {latestAnchor.chainHead}
              </code>
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 flex-wrap gap-2">
                <span>
                  {latestAnchor.rowCount.toLocaleString()} rows · attested{" "}
                  {new Date(latestAnchor.attestedAt).toISOString().slice(0, 19)}
                  Z
                </span>
                <Link
                  href="/api/auditor/anchor"
                  className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
                >
                  /api/auditor/anchor
                </Link>
              </div>
            </div>
          ) : (
            <EmptyHint>
              No audit anchors yet — the daily cron at{" "}
              <code>/api/cron/audit-log-anchor</code> runs at 02:30 UTC. First
              anchor lands after a non-empty audit log + one cron cycle.
            </EmptyHint>
          )}
        </Section>

        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            Surfaces: live tokens →{" "}
            <Link
              href="/identity"
              className="text-cyan-300 hover:text-cyan-200"
            >
              /identity
            </Link>
            . Per-receipt replay →{" "}
            <Link
              href="/auditor/replay"
              className="text-cyan-300 hover:text-cyan-200"
            >
              /auditor/replay
            </Link>
            . Production metrics →{" "}
            <Link href="/status" className="text-cyan-300 hover:text-cyan-200">
              /status
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

// ── Section + helpers ─────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] uppercase mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="px-4 py-4 border border-white/[0.06] rounded-[3px] bg-white/[0.015]">
      <p className="flex items-center gap-1.5 font-mono text-[9px] text-neutral-500 tracking-[0.2em] uppercase mb-2">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <p className="font-serif text-2xl text-white tabular-nums leading-tight">
        {value}
      </p>
      <p className="font-mono text-[10px] text-neutral-600 tracking-[0.1em] uppercase mt-1">
        {sub}
      </p>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-8 border border-white/[0.06] rounded-[3px] bg-white/[0.015] text-center">
      <p className="text-[13px] text-neutral-500 leading-[1.6]">{children}</p>
    </div>
  );
}

// ── Best-effort fetchers — never throw, always return arrays ──────────

async function safeRecentRuns(): Promise<
  Array<{
    id: string;
    agentName: string;
    modelUsed: string;
    durationMs: number;
    trustDecision: string;
    createdAt: Date;
  }>
> {
  try {
    return await db
      .select({
        id: agentRuns.id,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        durationMs: agentRuns.durationMs,
        trustDecision: agentRuns.trustDecision,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .orderBy(desc(agentRuns.createdAt))
      .limit(10);
  } catch {
    return [];
  }
}

async function safeLatestAnchor(): Promise<{
  chainHead: string;
  rowCount: number;
  attestedAt: Date;
} | null> {
  try {
    const [row] = await db
      .select({
        chainHead: auditLogAnchors.chainHead,
        rowCount: auditLogAnchors.rowCount,
        attestedAt: auditLogAnchors.attestedAt,
      })
      .from(auditLogAnchors)
      .orderBy(desc(auditLogAnchors.attestedAt))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}
