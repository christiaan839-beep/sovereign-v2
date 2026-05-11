"use client";

/**
 * /api-docs — public API documentation surface.
 *
 * Companion to /mcp. Both expose the same primitives:
 *   /mcp     → JSON-RPC over MCP for AI tools (Claude Desktop, Cursor)
 *   /api-docs → OpenAPI 3.1 for REST clients (Postman, IDEs, scripts)
 *
 * Hosts a clean operation list with copy-paste curl examples per
 * endpoint. Intentionally NOT a Swagger UI iframe — that's ~3MB of
 * external JS bloat for a 5-endpoint surface. The docs page also
 * surfaces the raw OpenAPI URL prominently so any tool can import.
 *
 * Cyan accent per the dual-accent brand rule (audit / infrastructure
 * surface).
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileJson,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  Shield,
  Globe,
} from "lucide-react";

const OPENAPI_URL = "/api/openapi.json";

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  summary: string;
  description: string;
  curl: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/verify",
    summary: "Verify a receipt's HMAC signature",
    description:
      "Pass canonical + signature. Server recomputes HMAC-SHA256 and constant-time compares. Returns {valid: boolean}.",
    curl: `curl -X POST https://sovereignmatrix.agency/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "canonical": "<canonical-projection-string>",
    "signature": "v1=<hex>"
  }'`,
  },
  {
    method: "GET",
    path: "/api/agent-runs/{id}",
    summary: "Fetch a receipt by ID",
    description:
      "Returns the full receipt: canonical, signature, agent name, model, duration, safety pipeline results, timestamps. Visibility-gated.",
    curl: `curl https://sovereignmatrix.agency/api/agent-runs/<receipt-id>`,
  },
  {
    method: "GET",
    path: "/api/agent-runs/latest-public",
    summary: "Freshest public receipt",
    description:
      "The most recent receipt with visibility=public. Useful as a seed for verification demos. Returns {receipt: null} if none exist yet.",
    curl: `curl https://sovereignmatrix.agency/api/agent-runs/latest-public`,
  },
  {
    method: "GET",
    path: "/api/agent-runs/recent-public",
    summary: "Public feed (up to 50)",
    description:
      "Block-explorer-style feed. Each row is a fingerprint summary — fetch the full receipt for canonical + signature.",
    curl: `curl "https://sovereignmatrix.agency/api/agent-runs/recent-public?limit=10"`,
  },
  {
    method: "GET",
    path: "/api/stats/public",
    summary: "Aggregate platform metrics",
    description:
      "Lifetime signed-receipt count, public-receipt count, last 24h. Aggregate only — no PII.",
    curl: `curl https://sovereignmatrix.agency/api/stats/public`,
  },
];

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div
        className="fixed inset-x-0 top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
        >
          ← Sovereign Matrix
        </Link>

        <header className="mb-12">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
            <FileJson className="h-3 w-3" />
            OPENAPI 3.1 · OPEN · NO AUTH
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Five endpoints. Open contract.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            The Sovereign public verification API as a standards-compliant
            OpenAPI 3.1 schema. Importable into Cursor, Postman, Insomnia,
            VSCode REST Client, or any IDE that speaks OpenAPI.
          </p>
        </header>

        {/* OpenAPI URL card */}
        <OpenApiCard />

        {/* Endpoint list */}
        <section className="mb-12">
          <h2 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            <Shield className="h-3 w-3 text-cyan-300" aria-hidden="true" />
            Endpoints
          </h2>
          <div className="space-y-4">
            {ENDPOINTS.map((e) => (
              <EndpointCard key={`${e.method}-${e.path}`} endpoint={e} />
            ))}
          </div>
        </section>

        {/* Use-case hints */}
        <section className="mb-10 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl">
          <h2 className="mb-3 text-sm font-semibold text-white">
            Where to use this
          </h2>
          <ul className="space-y-2 text-sm leading-relaxed text-neutral-400">
            <li className="flex gap-2">
              <span className="text-cyan-300">·</span>
              <span>
                <strong className="text-neutral-200">Cursor / VSCode</strong> —
                paste the OpenAPI URL into the AI-tool config to get
                autocomplete + inline-example tool calls.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-300">·</span>
              <span>
                <strong className="text-neutral-200">Postman / Insomnia</strong>{" "}
                — Import → Link → paste the OpenAPI URL. Full collection
                generated with examples.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-300">·</span>
              <span>
                <strong className="text-neutral-200">CI / scripts</strong> —
                generate typed clients with{" "}
                <code className="font-mono text-cyan-300">
                  openapi-typescript-codegen
                </code>{" "}
                or your stack&apos;s equivalent.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-300">·</span>
              <span>
                <strong className="text-neutral-200">Procurement</strong> — hand
                the OpenAPI URL to vendor-risk teams as the API contract in
                security questionnaires.
              </span>
            </li>
          </ul>
        </section>

        {/* Cross-links */}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/mcp"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/15"
          >
            MCP server (JSON-RPC)
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/spec"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
          >
            VAOS 1.0 spec
          </Link>
          <Link
            href="/trust"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
          >
            <Globe className="h-3 w-3" />
            Trust posture
          </Link>
        </div>
      </div>
    </div>
  );
}

function OpenApiCard() {
  const [copied, setCopied] = useState(false);
  const fullUrl = `https://sovereignmatrix.agency${OPENAPI_URL}`;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent */
    }
  }, [fullUrl]);

  return (
    <section className="mb-10 overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.05] to-transparent backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.04] bg-black/30 px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
        <span>OpenAPI 3.1 schema URL</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
          aria-label="Copy OpenAPI URL"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5"
              >
                <Check className="h-3 w-3 text-emerald-300" />
                Copied
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5"
              >
                <Copy className="h-3 w-3" />
                Copy URL
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
      <div className="p-5">
        <code className="block break-all rounded-lg border border-white/[0.04] bg-black/50 px-4 py-3 font-mono text-[13px] text-cyan-100">
          {fullUrl}
        </code>
        <p className="mt-3 text-xs text-neutral-500">
          Open the URL in a browser to read the raw JSON, or paste it into your
          tool of choice. Self-references the request origin — preview deploys
          and white-label domains produce valid contracts.
        </p>
        <a
          href={OPENAPI_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan-300 transition hover:text-cyan-100"
        >
          Open raw schema
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </section>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(endpoint.curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent */
    }
  }, [endpoint.curl]);

  return (
    <article className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.04] bg-black/20 px-5 py-3">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
            endpoint.method === "POST"
              ? "bg-amber-500/15 text-amber-200 border border-amber-500/30"
              : "bg-cyan-500/15 text-cyan-200 border border-cyan-500/30"
          }`}
        >
          {endpoint.method}
        </span>
        <code className="font-mono text-[13px] text-white">
          {endpoint.path}
        </code>
        <span className="ml-auto text-[11px] text-neutral-500">
          {endpoint.summary}
        </span>
      </header>
      <div className="p-5">
        <p className="mb-3 text-xs leading-relaxed text-neutral-400">
          {endpoint.description}
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg border border-white/[0.04] bg-black/50 p-4 font-mono text-[12px] leading-relaxed text-cyan-100">
            {endpoint.curl}
          </pre>
          <button
            onClick={copy}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
            aria-label={`Copy curl example for ${endpoint.method} ${endpoint.path}`}
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-300" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </article>
  );
}
