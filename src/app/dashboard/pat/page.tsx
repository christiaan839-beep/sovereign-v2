"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  KeyRound,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

/**
 * /dashboard/pat — Personal Access Token management (Cook 88 UI).
 *
 * Lets users create + revoke PATs for the browser + VS Code extensions
 * and external SDK consumers. Cleartext token is shown ONCE in a
 * modal; copying is the only way to keep it.
 */

interface PatItem {
  id: string;
  label: string;
  prefix: string;
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
}

interface NewPat extends PatItem {
  cleartext: string;
}

function fmt(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ");
}

export default function PatPage() {
  const [items, setItems] = useState<PatItem[]>([]);
  const [label, setLabel] = useState("");
  const [ttlDays, setTtlDays] = useState("90");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<NewPat | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/pat", { cache: "no-store" });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { items: PatItem[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setPending(true);
    setError(null);
    try {
      const ttl = parseInt(ttlDays || "0", 10);
      const res = await fetch("/api/pat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          ...(ttl > 0 ? { ttlDays: ttl } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as NewPat;
      setCreated(data);
      setLabel("");
      await load();
    } finally {
      setPending(false);
    }
  }

  async function destroy(id: string) {
    const ok = confirm(
      "Revoke this PAT? Any extension or SDK using it will break.",
    );
    if (!ok) return;
    setError(null);
    const res = await fetch("/api/pat", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `HTTP ${res.status}`);
      return;
    }
    await load();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed — select the token manually");
    }
  }

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <span className="inline-flex items-center gap-2 text-xs text-neutral-300">
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" /> Access Tokens
          </span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 mb-4">
          Personal Access Tokens
        </p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-3">
          Tokens for your extensions + CLI.
        </h1>
        <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl mb-10">
          PATs authenticate the browser extension, VS Code extension, and any
          external SDK consumer. Tokens are hash-stored — the cleartext is shown
          to you ONCE at creation. Lose it and you re-issue.
        </p>

        {error && (
          <div className="mb-6 flex items-center gap-2 text-xs text-rose-300 p-3 rounded-xl border border-rose-500/40 bg-rose-500/10">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <form
          onSubmit={create}
          className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] space-y-3 mb-10"
        >
          <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Issue a new token
          </h2>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. browser-ext, vscode, cli-laptop)"
            maxLength={80}
            className="block w-full text-sm bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-400/60"
          />
          <input
            value={ttlDays}
            onChange={(e) => setTtlDays(e.target.value)}
            type="number"
            min="0"
            max="365"
            placeholder="TTL in days (0 = no expiry)"
            className="block w-full text-sm bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-400/60"
          />
          <button
            disabled={pending || !label.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 disabled:opacity-40 transition-colors"
          >
            {pending ? "Issuing…" : "Issue token"}
          </button>
        </form>

        <section>
          <h2 className="text-sm font-semibold text-white mb-3">
            Active tokens
          </h2>
          {items.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No tokens yet — issue one above.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{p.label}</p>
                    <p className="text-[11px] text-neutral-500 font-mono">
                      {p.prefix}… · created {fmt(p.createdAt)}
                      {p.expiresAt ? ` · expires ${fmt(p.expiresAt)}` : ""}
                      {p.lastUsedAt ? ` · last used ${fmt(p.lastUsedAt)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => destroy(p.id)}
                    className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {created && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
          <div className="max-w-lg w-full p-6 rounded-2xl border border-emerald-500/40 bg-[#0a0a0a]">
            <h2 className="text-base font-semibold text-white inline-flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Token issued
            </h2>
            <p className="text-xs text-neutral-400 mb-4">
              Copy this token now. It will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] font-mono bg-black/60 border border-white/10 rounded-lg p-3 break-all">
                {created.cleartext}
              </code>
              <button
                onClick={() => copy(created.cleartext)}
                className="inline-flex items-center gap-1 text-[11px] px-3 py-2 rounded-full bg-emerald-500 text-black font-semibold hover:bg-emerald-400"
              >
                <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setCreated(null)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                I&rsquo;ve saved it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
