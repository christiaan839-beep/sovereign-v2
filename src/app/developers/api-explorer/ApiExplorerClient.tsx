"use client";

/**
 * ApiExplorerClient — interactive spec browser.
 *
 * Fetches /api/openapi on mount, groups endpoints by tag, lets the user
 * expand per endpoint. Each expanded endpoint shows:
 *   - HTTP method + path
 *   - Description
 *   - Request body (if POST)
 *   - Response codes
 *   - Copy-able cURL
 *
 * Keeps state in-component — no routing, no external store. Search
 * filter narrows by path/summary substring.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Copy, Check, Search } from "lucide-react";

interface Operation {
  operationId: string;
  tags: string[];
  summary: string;
  description: string;
  requestBody?: unknown;
  responses: Record<string, { description: string }>;
  security: Array<Record<string, string[]>>;
}

interface OpenApiSpec {
  info: { title: string; version: string };
  servers: Array<{ url: string }>;
  paths: Record<string, Record<string, Operation>>;
  tags: Array<{ name: string; description: string }>;
}

export function ApiExplorerClient() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [openTags, setOpenTags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/openapi")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (!cancelled) setSpec(json);
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!spec) return new Map<string, Array<{ path: string; method: string; op: Operation }>>();
    const q = query.trim().toLowerCase();
    const m = new Map<string, Array<{ path: string; method: string; op: Operation }>>();
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const matches =
          !q ||
          path.toLowerCase().includes(q) ||
          op.summary.toLowerCase().includes(q) ||
          op.tags.join(" ").toLowerCase().includes(q);
        if (!matches) continue;
        const tag = op.tags[0] ?? "General";
        const bucket = m.get(tag) ?? [];
        bucket.push({ path, method, op });
        m.set(tag, bucket);
      }
    }
    // sort tags alphabetically, ops within by path
    for (const bucket of m.values()) {
      bucket.sort((a, b) => a.path.localeCompare(b.path));
    }
    return new Map([...m.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [spec, query]);

  const totalEndpoints = useMemo(() => {
    if (!spec) return 0;
    return Object.values(spec.paths).reduce((acc, methods) => acc + Object.keys(methods).length, 0);
  }, [spec]);

  const toggleTag = (tag: string) => {
    setOpenTags((prev) => ({ ...prev, [tag]: !prev[tag] }));
  };

  const copyCurl = async (path: string, method: string) => {
    const base = spec?.servers[0]?.url ?? "https://sovereignmatrix.agency";
    const curl =
      method.toUpperCase() === "POST"
        ? `curl -X POST "${base}${path}" \\\n  -H "Authorization: Bearer $SOVEREIGN_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{}'`
        : `curl "${base}${path}" \\\n  -H "Authorization: Bearer $SOVEREIGN_API_KEY"`;
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(`${method}:${path}`);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard can fail in insecure context — silently ignore
    }
  };

  if (err) {
    return (
      <section className="py-10 px-6">
        <div className="max-w-4xl mx-auto p-6 rounded-xl border border-rose-500/20 bg-rose-500/[0.04]">
          <p className="text-rose-400 font-mono text-sm">Failed to load spec: {err}</p>
        </div>
      </section>
    );
  }

  if (!spec) {
    return (
      <section className="py-10 px-6">
        <div className="max-w-4xl mx-auto p-6 rounded-xl border border-white/[0.06] bg-[#060606]">
          <p className="text-neutral-500 text-sm font-mono">Loading spec…</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="pb-6 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by path, tag, or summary…"
                className="w-full pl-9 pr-4 py-2 rounded-[4px] border border-white/[0.08] bg-[#060606] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#B5532C]/40 transition-colors"
              />
            </div>
            <span className="font-mono text-[11px] text-neutral-500">
              {totalEndpoints} endpoints · v{spec.info.version}
            </span>
          </div>
        </div>
      </section>

      <section className="py-6 px-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {[...grouped.entries()].map(([tag, ops]) => {
            const isOpen = openTags[tag] ?? true;
            return (
              <div
                key={tag}
                className="rounded-[4px] border border-white/[0.06] bg-[#060606] overflow-hidden"
              >
                <button
                  onClick={() => toggleTag(tag)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-[#080808] hover:bg-[#0A0A0A] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-200">
                      {tag}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-neutral-500">
                    {ops.length} {ops.length === 1 ? "endpoint" : "endpoints"}
                  </span>
                </button>

                {isOpen &&
                  ops.map(({ path, method, op }) => {
                    const key = `${method}:${path}`;
                    const isExpanded = openKey === key;
                    return (
                      <div
                        key={key}
                        className="border-t border-white/[0.04]"
                      >
                        <button
                          onClick={() => setOpenKey(isExpanded ? null : key)}
                          className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.015] transition-colors"
                        >
                          <span
                            className={`font-mono text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-[3px] ${
                              method === "post"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-blue-500/10 text-blue-400"
                            }`}
                          >
                            {method}
                          </span>
                          <span className="font-mono text-xs text-white truncate">{path}</span>
                          <span className="font-mono text-[10px] text-neutral-500 truncate flex-1 text-right hidden md:block">
                            {op.summary}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-4 pt-1 space-y-4 border-t border-white/[0.03] bg-[#050505]">
                            <div>
                              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600 mb-1.5">
                                Description
                              </p>
                              <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap">
                                {op.description}
                              </p>
                            </div>

                            <div>
                              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600 mb-1.5">
                                Response codes
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(op.responses).map(([code, r]) => (
                                  <span
                                    key={code}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] bg-white/[0.04] text-[10px] font-mono text-neutral-400"
                                    title={r.description}
                                  >
                                    <span
                                      className={
                                        code.startsWith("2")
                                          ? "text-emerald-400"
                                          : code.startsWith("4")
                                            ? "text-amber-400"
                                            : "text-rose-400"
                                      }
                                    >
                                      {code}
                                    </span>
                                    <span className="text-neutral-500">{r.description}</span>
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600">
                                  cURL
                                </p>
                                <button
                                  onClick={() => copyCurl(path, method)}
                                  className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 hover:text-[#B5532C] transition-colors"
                                >
                                  {copied === key ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      Copy
                                    </>
                                  )}
                                </button>
                              </div>
                              <pre className="font-mono text-[10.5px] text-neutral-300 bg-[#030303] border border-white/[0.04] rounded-[4px] p-3 overflow-x-auto leading-relaxed">
                                {method.toUpperCase() === "POST"
                                  ? `curl -X POST "${spec.servers[0]?.url ?? ""}${path}" \\
  -H "Authorization: Bearer $SOVEREIGN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{}'`
                                  : `curl "${spec.servers[0]?.url ?? ""}${path}" \\
  -H "Authorization: Bearer $SOVEREIGN_API_KEY"`}
                              </pre>
                            </div>

                            {op.security.length === 0 && (
                              <p className="text-[10px] text-emerald-400/80 font-mono">
                                🔓 Public endpoint — no authentication required
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}

          {grouped.size === 0 && (
            <div className="py-12 text-center border border-white/[0.06] rounded-xl bg-[#060606]">
              <p className="text-neutral-500 text-sm">
                No endpoints match &quot;{query}&quot;.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
