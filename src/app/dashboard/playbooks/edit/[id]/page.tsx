"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { topoSort, dryRun, type PlaybookDag } from "@/lib/playbook-dag";
import { PlaybookCanvas } from "@/components/playbook/PlaybookCanvas";
import { NodePalette } from "@/components/playbook/NodePalette";
import { MyDagsPanel } from "@/components/playbook/MyDagsPanel";
import { ConfidenceBadge } from "@/components/agent/ConfidenceBadge";
import { TokenBudgetMeter } from "@/components/agent/TokenBudgetMeter";
import { extractConfidence, extractTokenBudget } from "@/lib/agent-meta";

/**
 * D1 — drag-drop visual playbook editor.
 *
 * Phase 2 (canvas) + Phase 3 (execution) + Phase 4 (load-back loop).
 *
 *   /dashboard/playbooks/edit/new   → fresh STARTER_DAG, never hits GET
 *   /dashboard/playbooks/edit/<id>  → fetches GET /api/playbooks/dag/<id>
 *
 * After saving a "new" DAG, the editor router-pushes to /<id> so
 * subsequent saves are updates, not duplicates. This is the standard
 * Notion / Linear pattern for create-then-edit flows.
 */

interface AgentSummary {
  slug: string;
  tier: 1 | 2 | 3;
  outputClass?: string;
}

interface NodeRunResult {
  nodeId: string;
  agent: string;
  status: "completed" | "failed" | "skipped";
  output?: unknown;
  durationMs: number;
  error?: string;
}

interface RunResponse {
  success: boolean;
  status: "running" | "completed" | "failed";
  results: NodeRunResult[];
  totalDurationMs: number;
  failedAt?: string | null;
  runId?: string | null;
  recorded?: boolean;
  /** True when the run was dispatched async; false (or absent) for sync. */
  async?: boolean;
  /** Polling URL — present only on async dispatches. */
  pollUrl?: string;
  /** Async progress, when polling. */
  progressNodesCompleted?: number;
  nodeCount?: number;
}

const STARTER_DAG: PlaybookDag = {
  nodes: [
    { id: "n1", agent: "leads", position: { x: 80, y: 100 }, config: { count: 10 } },
    { id: "n2", agent: "outreach-personalizer", position: { x: 380, y: 100 }, config: {} },
  ],
  edges: [{ from: "n1.leads", to: "n2.target" }],
};

export default function PlaybookEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  // The URL segment "new" is the sentinel for "render STARTER_DAG;
  // do not fetch". Anything else is treated as a UUID and triggers
  // hydration. The DB layer enforces tenant ownership; an unknown id
  // returns 404 and we fall back to STARTER_DAG with a notice.
  const urlId = params?.id;
  const isNew = !urlId || urlId === "new";

  const [dag, setDag] = useState<PlaybookDag>(STARTER_DAG);
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : urlId);
  const [name, setName] = useState<string>("Untitled playbook");
  // We derive `hydrating` from "did we finish loading THIS url?" rather
  // than maintaining a separate boolean flag. That avoids the
  // set-state-in-effect cascade lint warning AND naturally handles
  // navigation between DAGs — when urlId changes, lastLoadedUrl is
  // still the old one, so hydrating flips back to true automatically.
  const [lastLoadedUrl, setLastLoadedUrl] = useState<string | null>(null);
  const hydrating = !isNew && lastLoadedUrl !== urlId;
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Record<string, AgentSummary>>({});
  const [requiredBySlug, setRequiredBySlug] = useState<Record<string, string[]>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [runState, setRunState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [runResult, setRunResult] = useState<RunResponse | null>(null);

  // Hydrate from /api/playbooks/dag/[id] when we have an id from the
  // URL. The DAG fetch is intentionally separate from the agents
  // fetch below — they're independent and parallel.
  useEffect(() => {
    if (isNew) return;
    let alive = true;
    fetch(`/api/playbooks/dag/${urlId}`)
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) {
          // 404 / 401 / 500 all surface the same way to the user.
          // The store can't distinguish "doesn't exist" from "wrong
          // owner" — both should look like "not found". The editor
          // falls back to STARTER_DAG so the user can still author
          // something instead of seeing a blank screen.
          setHydrationError(
            r.status === 404
              ? "This playbook isn't available — it may have been archived or you may not have access."
              : "Failed to load this playbook. Try refreshing.",
          );
          // Mark the URL as "loaded" (with an error) so we don't show
          // the loading spinner forever on a permanent 404.
          setLastLoadedUrl(urlId ?? null);
          return;
        }
        const body = (await r.json()) as { dag: { id: string; name: string; dag: PlaybookDag } };
        if (!alive) return;
        setDag(body.dag.dag);
        setSavedId(body.dag.id);
        setName(body.dag.name);
        setHydrationError(null);
        setLastLoadedUrl(urlId ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setHydrationError("Network error loading playbook.");
        setLastLoadedUrl(urlId ?? null);
      });
    return () => {
      alive = false;
    };
  }, [isNew, urlId]);

  useEffect(() => {
    let alive = true;
    fetch("/api/_meta/agents.json")
      .then((r) => r.json())
      .then((body) => {
        if (!alive) return;
        const map: Record<string, AgentSummary> = {};
        for (const [slug, m] of Object.entries(
          (body as { agents?: Record<string, { tier: 1 | 2 | 3; outputClass?: string }> }).agents ?? {},
        )) {
          map[slug] = { slug, tier: m.tier, outputClass: m.outputClass };
        }
        setAgents(map);
        setRequiredBySlug({
          leads: ["count"],
          "outreach-personalizer": ["target", "template"],
          "email-sequence": ["audience", "touches"],
          "abm-artillery": ["company", "industry"],
          consensus: ["prompt"],
          "blog-gen": ["topic"],
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const result = useMemo(() => dryRun(dag, requiredBySlug), [dag, requiredBySlug]);
  const order = useMemo(() => topoSort(dag).order, [dag]);

  const handleAddNode = useCallback((slug: string) => {
    setDag((d) => {
      const maxX = d.nodes.reduce((acc, n) => Math.max(acc, n.position.x), 0);
      const newId = `n${d.nodes.length + 1}_${slug.slice(0, 6)}`;
      return {
        nodes: [
          ...d.nodes,
          {
            id: newId,
            agent: slug,
            position: { x: maxX + 220, y: 100 + (d.nodes.length % 3) * 100 },
            config: {},
          },
        ],
        edges: d.edges,
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaveState("saving");
    try {
      const payload: Record<string, unknown> = { dag, name };
      if (savedId) payload.id = savedId;
      const res = await fetch("/api/playbooks/dag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSaveState("error");
        return;
      }
      const body = (await res.json()) as { id: string; action: "create" | "update" };
      setSaveState("saved");
      setSavedId(body.id);
      // After the first save of a fresh "new" playbook, replace the
      // URL with the real id so browser-back works and subsequent
      // saves correctly UPDATE rather than duplicate.
      if (body.action === "create" && isNew) {
        router.replace(`/dashboard/playbooks/edit/${body.id}`);
      }
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, [dag, name, savedId, isNew, router]);

  // Clone the current playbook into a fresh draft. Useful for "I
  // want to try variations of this without losing the working version".
  // Only available once we have a savedId (the source must be in the
  // DB; cloning a fresh "new" page that hasn't been saved is a no-op
  // — they should just save first).
  const handleClone = useCallback(async () => {
    if (!savedId) return;
    try {
      const res = await fetch(`/api/playbooks/dag/${savedId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) return;
      const body = (await res.json()) as { id: string };
      router.push(`/dashboard/playbooks/edit/${body.id}`);
    } catch {
      // Clone failure isn't blocking — the user can retry. No surface
      // banner; they'll notice the URL didn't change.
    }
  }, [savedId, router]);

  // D1 Phase 3 — actually execute the DAG. Calls the run-dag endpoint
  // which self-fetches each node through the agent gateway so every
  // safety gate fires per node (manifest tier, tenant policy, token
  // budget, capability check, audit log, attestation).
  //
  // When the DAG has a savedId, we pass it so the run is recorded
  // against that parent — that's what makes the "previous runs"
  // sidebar scope correctly. Pre-save runs (savedId still null) are
  // anonymous one-shots; they record but with dagId=null.
  const handleRun = useCallback(async () => {
    setRunState("running");
    setRunResult(null);
    try {
      const res = await fetch("/api/playbooks/run-dag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dag,
          dagId: savedId ?? undefined,
          continueOnError: false,
        }),
      });
      const body = (await res.json()) as RunResponse;

      // ── Sync path: response carries the full result ──────────────
      if (!body.async) {
        setRunResult(body);
        setRunState(body.success ? "done" : "error");
        return;
      }

      // ── Async path: response is the dispatch ack; poll for state ─
      // Show the dispatch immediately so the user sees "running…"
      // status with the runId. Polling fills in per-node results as
      // they complete.
      setRunResult({
        ...body,
        results: [],
        totalDurationMs: 0,
      });

      const runId = body.runId;
      if (!runId) {
        setRunState("error");
        return;
      }

      // Poll every 2s. Cap at 5 minutes so a stuck run doesn't poll
      // forever — the run detail page is the right place to keep
      // watching. Editor cleanup runs on unmount.
      const startedAt = Date.now();
      const POLL_INTERVAL_MS = 2000;
      const POLL_TIMEOUT_MS = 5 * 60 * 1000;

      const tick = async (): Promise<void> => {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setRunState("error");
          return;
        }
        try {
          const r = await fetch(`/api/playbooks/dag/runs/${runId}`);
          if (!r.ok) {
            // Transient — keep polling. If the row eventually
            // becomes available we resume; if it never does, the
            // timeout above closes the loop.
            setTimeout(() => void tick(), POLL_INTERVAL_MS);
            return;
          }
          const detail = (await r.json()) as {
            run: {
              status: "running" | "completed" | "failed";
              results: NodeRunResult[];
              totalDurationMs: number;
              failedAt: string | null;
              progressNodesCompleted: number;
              nodeCount: number;
            };
          };
          setRunResult({
            success: detail.run.status === "completed",
            status: detail.run.status,
            results: detail.run.results,
            totalDurationMs: detail.run.totalDurationMs,
            failedAt: detail.run.failedAt ?? undefined,
            progressNodesCompleted: detail.run.progressNodesCompleted,
            nodeCount: detail.run.nodeCount,
            runId,
            recorded: true,
            async: true,
          });
          if (detail.run.status === "running") {
            setTimeout(() => void tick(), POLL_INTERVAL_MS);
          } else {
            setRunState(detail.run.status === "completed" ? "done" : "error");
          }
        } catch {
          // Network blip — retry once and let the timeout cut
          // things off if it persists.
          setTimeout(() => void tick(), POLL_INTERVAL_MS);
        }
      };

      // Kick off the first poll after a short delay so the worker
      // has time to start writing results.
      setTimeout(() => void tick(), POLL_INTERVAL_MS);
    } catch {
      setRunState("error");
    }
  }, [dag, savedId]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-neutral-200">
      <header className="mb-6 flex items-baseline justify-between gap-6">
        <div className="flex-1 min-w-0">
          <Link href="/dashboard/playbooks" className="text-xs text-neutral-500 hover:text-neutral-300">
            ← Playbooks
          </Link>
          {/*
            Inline-editable playbook name. Plain input, no chrome —
            looks like a heading until the user clicks. The Notion /
            Linear pattern: a click-to-rename heading is friction-free
            and avoids dialog-modal noise.
          */}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled playbook"
            className="mt-2 block w-full bg-transparent text-2xl font-bold text-neutral-100 outline-none placeholder:text-neutral-600 focus:bg-white/[0.02] rounded -mx-1 px-1"
            aria-label="Playbook name"
          />
          <p className="mt-1 text-sm text-neutral-400">
            {hydrating
              ? "Loading playbook…"
              : hydrationError
                ? hydrationError
                : "Drag agents from the palette. Click to add. Connect handles to wire data flow."}
            {savedId && !isNew && !hydrating && (
              <span className="ml-2 text-xs text-neutral-600 font-mono">
                · {savedId.slice(0, 8)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`text-xs rounded border px-2.5 py-1 ${
              result.valid
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            {result.valid
              ? "✓ DAG valid"
              : `${result.missingFields.length} issue${result.missingFields.length === 1 ? "" : "s"}`}
          </div>
          {/*
            Clone button — only meaningful for an already-saved DAG.
            Subtle styling because the primary actions are Save + Run.
          */}
          {savedId && (
            <button
              onClick={handleClone}
              className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200"
              title="Fork this playbook into a new draft"
            >
              Clone
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!result.valid || saveState === "saving"}
            className="rounded-md border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-neutral-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved ✓"
                : saveState === "error"
                  ? "Retry"
                  : "Save"}
          </button>
          <button
            onClick={handleRun}
            disabled={!result.valid || runState === "running"}
            className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Execute the DAG. Every node passes through the same safety gates as a top-level agent invocation."
          >
            {runState === "running"
              ? "Running…"
              : runState === "done"
                ? "Run again"
                : runState === "error"
                  ? "Retry run"
                  : "▶ Run"}
          </button>
        </div>
      </header>

      <div className="flex gap-4">
        <NodePalette agents={agents} onAddNode={handleAddNode} />
        <div className="flex-1">
          <PlaybookCanvas dag={dag} agents={agents} onChange={setDag} />
        </div>
        <MyDagsPanel currentDagId={savedId} />
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Execution order (topological)
          </div>
          <ol className="mt-3 space-y-1 text-sm text-neutral-300">
            {order ? (
              order.map((id, i) => {
                const node = dag.nodes.find((n) => n.id === id);
                return (
                  <li key={id} className="flex items-baseline gap-3">
                    <span className="text-xs text-neutral-500 font-mono">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-xs text-neutral-200">{id}</span>
                    <span className="text-xs text-neutral-500">→ {node?.agent}</span>
                  </li>
                );
              })
            ) : (
              <li className="text-rose-400">Cycle detected — DAG cannot execute</li>
            )}
          </ol>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Pre-flight checks
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-baseline gap-2">
              <span
                className={`text-xs font-mono ${
                  result.cycle == null ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {result.cycle == null ? "✓" : "✗"}
              </span>
              <span className="text-neutral-300">
                {result.cycle == null
                  ? "Acyclic — execution order computed"
                  : `Cycle: ${result.cycle.join(" → ")}`}
              </span>
            </li>
            {result.missingFields.length === 0 ? (
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-400 text-xs font-mono">✓</span>
                <span className="text-neutral-300">All required fields wired</span>
              </li>
            ) : (
              result.missingFields.map((m, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="text-amber-400 text-xs font-mono">!</span>
                  <span className="text-neutral-300">
                    Node{" "}
                    <code className="text-xs text-amber-200">{m.nodeId}</code>{" "}
                    missing field{" "}
                    <code className="text-xs text-amber-200">{m.field}</code>
                  </span>
                </li>
              ))
            )}
            <li className="pt-2 border-t border-white/5 flex items-baseline gap-2">
              <span className="text-neutral-500 text-xs">est.</span>
              <span className="text-neutral-300">
                ~{result.estimatedKtokens} Ktokens / run
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/*
        D1 Phase 3 — execution results panel. Renders nothing until the
        first Run. After completion, shows per-node status + duration so
        the user can see where time was spent and which node failed.
      */}
      {runResult && (
        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <header className="flex items-baseline justify-between border-b border-white/5 pb-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              {/*
                Three terminal states + one in-flight state. The in-flight
                state shows progress (n of m nodes done) so the user has
                a visual cue that work is happening — the polling loop
                fills this in.
              */}
              {runResult.status === "running" ? (
                <>
                  <span className="text-sm font-semibold text-amber-300">
                    ⟳ Running…
                  </span>
                  <span className="text-xs text-neutral-500 font-mono">
                    {runResult.progressNodesCompleted ?? 0} of {runResult.nodeCount ?? "?"} nodes
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={`text-sm font-semibold ${
                      runResult.success ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {runResult.success ? "✓ Run completed" : "✗ Run failed"}
                  </span>
                  <span className="text-xs text-neutral-500 font-mono">
                    {runResult.totalDurationMs}ms total
                  </span>
                  {runResult.failedAt && (
                    <span className="text-xs text-rose-400 font-mono">
                      failed at: {runResult.failedAt}
                    </span>
                  )}
                </>
              )}
              {/*
                Link to the forensic detail page. Appears for any run
                that has a persisted runId — including async dispatches
                where the user can navigate away and the run will keep
                progressing. (The UI above polls the same endpoint to
                update in-place; the link is for "save this URL" use
                cases — share with a teammate, come back tomorrow.)
              */}
              {runResult.runId && (
                <Link
                  href={`/dashboard/playbooks/runs/${runResult.runId}`}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline-offset-4 hover:underline"
                >
                  View run detail →
                </Link>
              )}
            </div>
            <button
              onClick={() => setRunResult(null)}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Clear
            </button>
          </header>

          <ol className="mt-4 space-y-2">
            {runResult.results.map((r) => (
              <li
                key={r.nodeId}
                className="flex items-start gap-3 rounded border border-white/5 bg-white/[0.01] p-3"
              >
                <span
                  className={`text-xs font-mono shrink-0 ${
                    r.status === "completed"
                      ? "text-emerald-400"
                      : r.status === "failed"
                        ? "text-rose-400"
                        : "text-neutral-500"
                  }`}
                >
                  {r.status === "completed" ? "✓" : r.status === "failed" ? "✗" : "—"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-xs text-neutral-300">{r.nodeId}</span>
                    <span className="text-xs text-neutral-500">{r.agent}</span>
                    {/*
                      Confidence + token-budget pills — surface
                      _meta.confidence and _meta.tokenBudget from the
                      gateway response. Closes OWASP LLM09 (Overreliance)
                      and LLM04 (DoS / runaway cost) on the visual-editor
                      surface: a node that "completed" but with low
                      confidence or near-cap budget shows the same
                      trust-aware UI a top-level agent invocation would.
                    */}
                    <ConfidenceBadge confidence={extractConfidence(r.output)} compact />
                    <TokenBudgetMeter budget={extractTokenBudget(r.output)} compact />
                    <span className="text-xs text-neutral-600 font-mono ml-auto">
                      {r.durationMs}ms
                    </span>
                  </div>
                  {r.error && (
                    <p className="mt-1 text-xs text-rose-300 break-words">{r.error}</p>
                  )}
                  {r.output !== undefined && (
                    <details className="mt-1.5">
                      <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-300">
                        Output
                      </summary>
                      <pre className="mt-2 overflow-auto rounded bg-black/40 p-2 text-[11px] text-neutral-300 max-h-48">
                        {JSON.stringify(r.output, null, 2).slice(0, 2000)}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
