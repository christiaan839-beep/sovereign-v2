"use client";

/**
 * /dashboard/api-keys — manage Sovereign API keys.
 *
 * One-time reveal pattern: the full secret is shown ONCE on creation,
 * then only the prefix is ever returned by the list endpoint. Mirrors
 * Stripe's UX so customers know not to lose it.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Plus,
  Copy,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  label: string | null;
  plan: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface CreatedKey extends ApiKeyRow {
  key: string; // full secret — only on creation
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch("/api/keys");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { keys: ApiKeyRow[] };
      setKeys(data.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() || null }),
      });
      const data = (await res.json()) as CreatedKey & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCreatedKey(data);
      setNewLabel("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this key? Apps using it will start getting 401."))
      return;
    setRevokingId(id);
    try {
      const res = await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setRevokingId(null);
    }
  };

  const copyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your key", createdKey.key);
    }
  };

  const active = keys.filter((k) => !k.revokedAt);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30">
            <KeyRound className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              API keys
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Use these with the{" "}
              <code className="rounded bg-white/5 px-1 text-cyan-300">
                @sovereign-matrix/agent-sdk
              </code>{" "}
              client to invoke any agent from your code.
            </p>
          </div>
        </header>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3 text-sm text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* One-time reveal */}
        <AnimatePresence>
          {createdKey && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/[0.06] to-transparent p-5 backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center gap-2">
                <Lock className="h-4 w-4 text-cyan-300" />
                <h2 className="text-sm font-medium text-white">
                  Save this key — it won&apos;t be shown again
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-black/50 p-3 font-mono text-xs text-cyan-200">
                  {createdKey.key}
                </code>
                <button
                  onClick={copyKey}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/25"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={() => setCreatedKey(null)}
                className="mt-3 text-xs text-neutral-400 transition hover:text-neutral-200"
              >
                I&apos;ve saved it — dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create new key */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl">
          <h2 className="mb-3 text-sm font-medium text-white">
            Create a new key
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value.slice(0, 100))}
              placeholder="Label (optional) — eg. production server"
              className="flex-1 rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-cyan-500/40"
            />
            <button
              onClick={create}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/15 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? "Creating…" : "Create key"}
            </button>
          </div>
        </section>

        {/* Active keys */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Active keys ({active.length})
          </h2>
          {loading ? (
            <div className="flex h-24 items-center justify-center text-neutral-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : active.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-neutral-400">
              No keys yet. Create one above to get started with the SDK.
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-xl"
                >
                  <KeyRound className="h-4 w-4 flex-shrink-0 text-neutral-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm text-neutral-200">
                        {k.keyPrefix}
                        <span className="text-neutral-600">…</span>
                      </code>
                      {k.label && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-300">
                          {k.label}
                        </span>
                      )}
                      <span className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wide text-cyan-200">
                        {k.plan}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt
                        ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                        : " · never used"}
                    </p>
                  </div>
                  <button
                    onClick={() => revoke(k.id)}
                    disabled={revokingId === k.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    {revokingId === k.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
