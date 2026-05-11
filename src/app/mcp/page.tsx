"use client";

/**
 * /mcp — public discoverability page for the Sovereign verifier MCP server.
 *
 * Sovereign-as-a-tool inside every Claude Desktop, Claude Code, Cursor,
 * and Continue.dev install. This page is the install surface — three
 * tabs of copy-pasteable config snippets, a tools list, and the
 * "what this gives you" pitch.
 *
 * Server is at /api/mcp/verifier — no auth, open CORS, JSON-RPC 2.0.
 *
 * Cyan accent (audit/infrastructure surface per the dual-accent rule).
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Copy,
  Check,
  Terminal,
  Code2,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

const CANONICAL_URL = "https://sovereignmatrix.agency/api/mcp/verifier";

const CONFIGS = {
  "claude-desktop": {
    label: "Claude Desktop",
    path: "~/Library/Application Support/Claude/claude_desktop_config.json",
    pathWin: "%APPDATA%\\Claude\\claude_desktop_config.json",
    snippet: `{
  "mcpServers": {
    "sovereign-verifier": {
      "type": "http",
      "url": "${CANONICAL_URL}"
    }
  }
}`,
  },
  "claude-code": {
    label: "Claude Code",
    path: "~/.claude.json (global) or .mcp.json (project root)",
    snippet: `{
  "mcpServers": {
    "sovereign-verifier": {
      "type": "http",
      "url": "${CANONICAL_URL}"
    }
  }
}`,
  },
  cursor: {
    label: "Cursor",
    path: "~/.cursor/mcp.json (or Settings → Tools & MCP)",
    snippet: `{
  "mcpServers": {
    "sovereign-verifier": {
      "url": "${CANONICAL_URL}"
    }
  }
}`,
  },
} as const;

type ConfigKey = keyof typeof CONFIGS;

const TOOLS = [
  {
    name: "verify_receipt",
    pitch:
      "Verify any Sovereign receipt by passing canonical + signature. Returns {valid: true|false} — same endpoint compliance auditors use.",
  },
  {
    name: "fetch_receipt",
    pitch:
      "Pull a receipt by id. Returns canonical + signature + agent name + model + timestamps. Visibility-gated: only public/unlisted receipts.",
  },
  {
    name: "latest_public_receipt",
    pitch:
      "Get the freshest public receipt. Useful for 'show me what was just signed' demos in AI tools.",
  },
  {
    name: "recent_public_receipts",
    pitch:
      "Feed of the last N public receipts (1-50, default 10). Each row is a fingerprint summary — call fetch_receipt for full data.",
  },
];

export default function MCPPage() {
  const [active, setActive] = useState<ConfigKey>("claude-desktop");
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CONFIGS[active].snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent */
    }
  }, [active]);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* Cyan ambient */}
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

        {/* Header */}
        <header className="mb-12">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
            <Terminal className="h-3 w-3" />
            MCP SERVER · OPEN · NO AUTH
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Verify AI receipts from inside any AI tool.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            Install Sovereign as an MCP server. Verify any agent-run receipt,
            fetch the freshest public one, or stream the live feed — directly
            from Claude Desktop, Claude Code, Cursor, or any MCP-compatible
            client. One config line. No API key.
          </p>
        </header>

        {/* Tab nav */}
        <div className="mb-3 flex flex-wrap gap-2">
          {(Object.keys(CONFIGS) as ConfigKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              aria-pressed={active === key}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition ${
                active === key
                  ? "border-cyan-500/40 bg-cyan-500/[0.08] text-cyan-200"
                  : "border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:border-white/[0.12] hover:text-white"
              }`}
            >
              {CONFIGS[key].label}
            </button>
          ))}
        </div>

        {/* Install card */}
        <section className="mb-10 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] bg-black/30 px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
            <div className="flex flex-wrap items-center gap-3">
              <Code2 className="h-3 w-3 text-cyan-300" aria-hidden="true" />
              <span>{CONFIGS[active].path}</span>
              {"pathWin" in CONFIGS[active] && (
                <>
                  <span className="text-neutral-700">·</span>
                  <span className="text-neutral-500">
                    {
                      (CONFIGS[active] as (typeof CONFIGS)["claude-desktop"])
                        .pathWin
                    }{" "}
                    (Windows)
                  </span>
                </>
              )}
            </div>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
              aria-label="Copy MCP config snippet"
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
                    Copy
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-relaxed text-cyan-100">
            {CONFIGS[active].snippet}
          </pre>
        </section>

        {/* Tools list */}
        <section className="mb-12">
          <h2 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            <Sparkles className="h-3 w-3 text-cyan-300" aria-hidden="true" />
            Tools exposed
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {TOOLS.map((t) => (
              <article
                key={t.name}
                className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-xl"
              >
                <code className="mb-2 inline-block font-mono text-[12px] font-semibold text-cyan-200">
                  {t.name}
                </code>
                <p className="text-xs leading-relaxed text-neutral-400">
                  {t.pitch}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Try-it */}
        <section className="mb-10 overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.05] to-transparent p-6 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <Shield
              className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300"
              aria-hidden="true"
            />
            <div className="flex-1">
              <h2 className="mb-2 text-sm font-semibold text-white">
                Hit the endpoint directly
              </h2>
              <p className="mb-3 text-sm leading-relaxed text-neutral-300">
                The server speaks JSON-RPC 2.0 over HTTP — installable clients
                are the easy path, but curl works too:
              </p>
              <pre className="overflow-x-auto rounded-lg border border-white/[0.04] bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-cyan-100">
                {`curl -X POST ${CANONICAL_URL} \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`}
              </pre>
              <p className="mt-3 text-xs text-neutral-500">
                Or visit{" "}
                <Link
                  href="/api/mcp/verifier"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  /api/mcp/verifier
                </Link>{" "}
                in a browser for the GET self-description.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/spec"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
          >
            VAOS 1.0 spec
          </Link>
          <Link
            href="/explorer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
          >
            Live explorer
            <ArrowRight className="h-3 w-3" />
          </Link>
          <a
            href="https://modelcontextprotocol.io/specification"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-white/[0.12] hover:text-white"
          >
            MCP protocol spec
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
