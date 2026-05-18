"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  Plus,
  Minus,
  Equal,
  Loader2,
  AlertTriangle,
  Hash,
} from "lucide-react";

/**
 * Receipt diff widget.
 *
 * Fetches two receipts from /api/agent-runs/<id> (or /api/verify lookup)
 * and renders a field-by-field comparison. Use case: model-version
 * regression detection. Procurement teams paste a baseline receipt id
 * and a candidate receipt id from the same agent, see what changed
 * between two runs of the same workflow.
 *
 * Diff strategy: flatten both receipt objects to dotted keys, then
 * three buckets — common-changed, only-in-a, only-in-b. Signatures
 * + canonical bytes are surfaced separately so a viewer can confirm
 * the diff is genuine (not just the receipt id differing).
 */

interface Receipt {
  id?: string;
  agentName?: string;
  modelUsed?: string;
  input?: unknown;
  output?: unknown;
  safetyResult?: unknown;
  durationMs?: number;
  createdAt?: string;
  signature?: string;
  [k: string]: unknown;
}

interface FlatEntry {
  key: string;
  value: string;
}

function flatten(
  obj: unknown,
  prefix = "",
  out: FlatEntry[] = [],
): FlatEntry[] {
  if (obj === null || obj === undefined) {
    out.push({ key: prefix || "(root)", value: String(obj) });
    return out;
  }
  if (typeof obj !== "object") {
    out.push({ key: prefix || "(root)", value: String(obj) });
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) =>
      flatten(item, prefix ? `${prefix}[${i}]` : `[${i}]`, out),
    );
    return out;
  }
  const entries = Object.entries(obj as Record<string, unknown>).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  for (const [k, v] of entries) {
    flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

interface DiffResult {
  changed: Array<{ key: string; a: string; b: string }>;
  onlyInA: FlatEntry[];
  onlyInB: FlatEntry[];
  unchanged: number;
}

function diff(a: Receipt, b: Receipt): DiffResult {
  // Skip the signature field — it ALWAYS differs across receipts and
  // is shown separately so the viewer knows the diff is genuine.
  const aCopy: Receipt = { ...a };
  const bCopy: Receipt = { ...b };
  delete aCopy.signature;
  delete bCopy.signature;

  const aFlat = flatten(aCopy);
  const bFlat = flatten(bCopy);
  const aMap = new Map(aFlat.map((e) => [e.key, e.value]));
  const bMap = new Map(bFlat.map((e) => [e.key, e.value]));

  const changed: DiffResult["changed"] = [];
  const onlyInA: FlatEntry[] = [];
  const onlyInB: FlatEntry[] = [];
  let unchanged = 0;

  for (const [k, av] of aMap) {
    if (bMap.has(k)) {
      const bv = bMap.get(k)!;
      if (av === bv) unchanged++;
      else changed.push({ key: k, a: av, b: bv });
    } else {
      onlyInA.push({ key: k, value: av });
    }
  }
  for (const [k, bv] of bMap) {
    if (!aMap.has(k)) onlyInB.push({ key: k, value: bv });
  }

  changed.sort((x, y) => x.key.localeCompare(y.key));
  onlyInA.sort((x, y) => x.key.localeCompare(y.key));
  onlyInB.sort((x, y) => x.key.localeCompare(y.key));

  return { changed, onlyInA, onlyInB, unchanged };
}

async function fetchReceipt(id: string): Promise<Receipt> {
  // Try the public lookup endpoint first; fall back to direct verify
  // (which returns the receipt body for public/listed runs).
  const res = await fetch(`/api/agent-runs/${encodeURIComponent(id)}`);
  if (res.ok) {
    return (await res.json()) as Receipt;
  }
  if (res.status === 404) {
    throw new Error(
      `Receipt ${id} not found. It may be private or not yet published.`,
    );
  }
  throw new Error(`Failed to fetch receipt ${id} (HTTP ${res.status})`);
}

export function DiffWidget() {
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState<Receipt | null>(null);
  const [b, setB] = useState<Receipt | null>(null);
  const [result, setResult] = useState<DiffResult | null>(null);

  async function onCompare(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setA(null);
    setB(null);
    setLoading(true);
    try {
      if (!idA.trim() || !idB.trim()) {
        throw new Error("Both receipt ids required");
      }
      const [ra, rb] = await Promise.all([
        fetchReceipt(idA.trim()),
        fetchReceipt(idB.trim()),
      ]);
      setA(ra);
      setB(rb);
      setResult(diff(ra, rb));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onCompare} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="font-mono text-[10px] text-cyan-300/80 tracking-[0.2em] uppercase mb-1 block">
            Baseline (A)
          </span>
          <input
            type="text"
            value={idA}
            onChange={(e) => setIdA(e.target.value)}
            placeholder="rcpt_..."
            className="w-full px-3 py-2 bg-black/40 border border-white/[0.10] rounded-[3px] font-mono text-[12px] text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/40"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] text-[#E08558] tracking-[0.2em] uppercase mb-1 block">
            Candidate (B)
          </span>
          <input
            type="text"
            value={idB}
            onChange={(e) => setIdB(e.target.value)}
            placeholder="rcpt_..."
            className="w-full px-3 py-2 bg-black/40 border border-white/[0.10] rounded-[3px] font-mono text-[12px] text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B5532C]/40 focus-visible:border-[#B5532C]/40"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B5532C] text-white text-[13px] font-mono tracking-[0.1em] rounded-[3px] hover:bg-[#C96234] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Fetching + comparing…
          </>
        ) : (
          <>
            <ArrowLeftRight className="w-4 h-4" />
            Compare receipts
          </>
        )}
      </button>

      {error && (
        <div className="p-4 border border-rose-500/30 bg-rose-500/[0.04] rounded-[3px]">
          <p className="flex items-center gap-2 font-mono text-[10px] text-rose-300 tracking-[0.2em] uppercase mb-2">
            <AlertTriangle className="w-3 h-3" /> Error
          </p>
          <p className="text-[13px] text-neutral-300 leading-[1.6]">{error}</p>
        </div>
      )}

      {result && a && b && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SignatureCard
              label="A signature"
              sig={a.signature}
              accent="cyan"
            />
            <SignatureCard
              label="B signature"
              sig={b.signature}
              accent="copper"
            />
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="changed" value={result.changed.length} accent="rose" />
            <Stat
              label="only in A"
              value={result.onlyInA.length}
              accent="cyan"
            />
            <Stat
              label="only in B"
              value={result.onlyInB.length}
              accent="copper"
            />
            <Stat label="unchanged" value={result.unchanged} accent="neutral" />
          </div>

          {result.changed.length > 0 && (
            <Section title="Changed fields">
              {result.changed.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-1 md:grid-cols-[200px_1fr_1fr] gap-2 p-2 rounded-[3px] border border-rose-500/15 bg-rose-500/[0.03]"
                >
                  <p className="font-mono text-[11px] text-rose-300 break-all">
                    {row.key}
                  </p>
                  <p className="font-mono text-[11px] text-cyan-300 break-all">
                    A: {row.a}
                  </p>
                  <p className="font-mono text-[11px] text-[#E08558] break-all">
                    B: {row.b}
                  </p>
                </div>
              ))}
            </Section>
          )}

          {result.onlyInA.length > 0 && (
            <Section title="Only in A (removed in B)">
              {result.onlyInA.map((row) => (
                <RowSingle
                  key={row.key}
                  k={row.key}
                  v={row.value}
                  icon={<Minus className="w-3 h-3 text-cyan-300" />}
                  accent="cyan"
                />
              ))}
            </Section>
          )}

          {result.onlyInB.length > 0 && (
            <Section title="Only in B (added in B)">
              {result.onlyInB.map((row) => (
                <RowSingle
                  key={row.key}
                  k={row.key}
                  v={row.value}
                  icon={<Plus className="w-3 h-3 text-[#E08558]" />}
                  accent="copper"
                />
              ))}
            </Section>
          )}

          {result.changed.length === 0 &&
            result.onlyInA.length === 0 &&
            result.onlyInB.length === 0 && (
              <div className="p-5 border border-cyan-500/25 bg-cyan-500/[0.04] rounded-[3px]">
                <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300 tracking-[0.2em] uppercase mb-2">
                  <Equal className="w-3 h-3" /> No differences
                </p>
                <p className="text-[13px] text-neutral-300">
                  The two receipts are byte-identical aside from their
                  signatures. {result.unchanged} fields compared, all match.
                </p>
              </div>
            )}
        </div>
      )}
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mb-2">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function RowSingle({
  k,
  v,
  icon,
  accent,
}: {
  k: string;
  v: string;
  icon: React.ReactNode;
  accent: "cyan" | "copper";
}) {
  const ring = accent === "cyan" ? "border-cyan-500/15" : "border-[#B5532C]/15";
  const bg = accent === "cyan" ? "bg-cyan-500/[0.03]" : "bg-[#B5532C]/[0.03]";
  return (
    <div
      className={`flex items-start gap-2 p-2 rounded-[3px] border ${ring} ${bg}`}
    >
      {icon}
      <p className="font-mono text-[11px] text-neutral-300 break-all flex-1">
        <span className="text-neutral-500">{k}:</span> {v}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "rose" | "cyan" | "copper" | "neutral";
}) {
  const colorClass =
    accent === "rose"
      ? "text-rose-300 border-rose-500/25"
      : accent === "cyan"
        ? "text-cyan-300 border-cyan-500/25"
        : accent === "copper"
          ? "text-[#E08558] border-[#B5532C]/25"
          : "text-neutral-300 border-white/[0.10]";
  return (
    <div
      className={`p-3 rounded-[3px] border bg-white/[0.015] ${colorClass.split(" ").slice(1).join(" ")}`}
    >
      <p className={`font-mono text-[20px] ${colorClass.split(" ")[0]}`}>
        {value}
      </p>
      <p className="font-mono text-[9px] text-neutral-500 tracking-[0.15em] uppercase">
        {label}
      </p>
    </div>
  );
}

function SignatureCard({
  label,
  sig,
  accent,
}: {
  label: string;
  sig: string | undefined;
  accent: "cyan" | "copper";
}) {
  const colorClass =
    accent === "cyan"
      ? "text-cyan-300 border-cyan-500/25 bg-cyan-500/[0.04]"
      : "text-[#E08558] border-[#B5532C]/25 bg-[#B5532C]/[0.04]";
  return (
    <div className={`p-3 rounded-[3px] border ${colorClass}`}>
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase mb-1 flex items-center gap-1.5">
        <Hash className="w-3 h-3" /> {label}
      </p>
      <code className="font-mono text-[10px] break-all leading-[1.45] block">
        {sig ?? "(none)"}
      </code>
    </div>
  );
}
