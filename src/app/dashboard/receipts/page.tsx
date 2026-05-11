"use client";

/**
 * /dashboard/receipts — every signed agent run, grouped by recency.
 *
 * For each run the user can:
 *   - open the public receipt page at /r/[id]
 *   - copy the URL
 *   - flip visibility (private ↔ public ↔ unlisted)
 *
 * The list is paged via the cursor returned by /api/agent-runs.
 * Empty state coaches users to try one of the core agents.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Link as LinkIcon,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface ReceiptListItem {
  id: string;
  agentName: string;
  modelUsed: string;
  durationMs: number;
  trustDecision: string;
  visibility: "private" | "public" | "unlisted";
  signaturePrefix: string;
  createdAt: string;
  inputPreview: string;
  outputPreview: string;
  safetyResult: {
    jailbreak?: "pass" | "fail";
    pii?: "pass" | "fail";
    content?: "pass" | "fail";
    quality?: number;
    critic?: "pass" | "fail";
  };
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function visibilityChip(v: ReceiptListItem["visibility"]) {
  const config = {
    private: {
      Icon: EyeOff,
      label: "Private",
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    },
    public: {
      Icon: Globe,
      label: "Public",
      cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    },
    unlisted: {
      Icon: LinkIcon,
      label: "Unlisted",
      cls: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    },
  }[v];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.cls}`}
    >
      <config.Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function safetyChip(item: ReceiptListItem) {
  const r = item.safetyResult ?? {};
  const fails =
    r.jailbreak === "fail" ||
    r.pii === "fail" ||
    r.content === "fail" ||
    r.critic === "fail";
  if (fails) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-200">
        <AlertTriangle className="h-3 w-3" />
        flagged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      verified
    </span>
  );
}

export default function ReceiptsPage() {
  const [items, setItems] = useState<ReceiptListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadPage = useCallback(async (after: string | null) => {
    const url = after
      ? `/api/agent-runs?limit=50&cursor=${encodeURIComponent(after)}`
      : "/api/agent-runs?limit=50";
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load receipts (HTTP ${res.status})`);
    }
    return (await res.json()) as {
      items: ReceiptListItem[];
      nextCursor: string | null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await loadPage(null);
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.nextCursor);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load receipts",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await loadPage(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const cycleVisibility = async (item: ReceiptListItem) => {
    const next: Record<typeof item.visibility, typeof item.visibility> = {
      private: "unlisted",
      unlisted: "public",
      public: "private",
    };
    const target = next[item.visibility];
    setUpdatingId(item.id);
    try {
      const res = await fetch(`/api/agent-runs/${item.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: target }),
      });
      if (!res.ok) throw new Error(`Visibility update failed (${res.status})`);
      setItems((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, visibility: target } : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  const copyLink = async (id: string) => {
    const url = `${window.location.origin}/r/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy link", url);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex items-center gap-3"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30">
            <Shield className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Verifiable receipts
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Every agent run produces an HMAC-signed receipt. Share the public
              URL with auditors, customers, or regulators — they can verify the
              signature without our help.
            </p>
          </div>
        </motion.header>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3 text-sm text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-32 items-center justify-center text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-start gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-medium text-white">
                          {item.agentName}
                        </span>
                        {safetyChip(item)}
                        {visibilityChip(item.visibility)}
                      </div>
                      <p className="line-clamp-2 break-words text-xs text-neutral-400">
                        {item.outputPreview ||
                          item.inputPreview ||
                          "(empty payload)"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {relativeTime(item.createdAt)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Cpu className="h-3 w-3" />
                          {item.modelUsed}
                        </span>
                        <span>{item.durationMs} ms</span>
                        <code className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-cyan-300/80">
                          sig {item.signaturePrefix}…
                        </code>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cycleVisibility(item)}
                        disabled={updatingId === item.id}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
                        title="Cycle visibility"
                      >
                        {updatingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => copyLink(item.id)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10"
                        title="Copy link"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                      </button>
                      <Link
                        href={`/r/${item.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/15"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {cursor && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </span>
                ) : (
                  "Load older"
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center backdrop-blur-xl">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04]">
        <Shield className="h-5 w-5 text-neutral-400" />
      </div>
      <h2 className="text-lg font-medium text-white">No runs yet</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Trigger any agent and a signed receipt appears here. Your first run is
        on the house.
      </p>
      <Link
        href="/marketplace"
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/15"
      >
        Browse the marketplace
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
