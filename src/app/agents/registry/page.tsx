"use client";

/**
 * /agents/registry — public Know-Your-Agent (KYA) registry browser.
 *
 * Lists every registered agent identity manifest. Each row links to
 * the trustless verifier endpoint so anyone can confirm authenticity
 * locally with @sovereign/inspector.
 *
 * "Sovereign is not a required trust anchor" — the math runs on
 * the user's machine, not ours.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Hash,
  Shield,
  Cpu,
  CheckCircle2,
  ExternalLink,
  Search,
} from "lucide-react";

interface RegistryAgent {
  agentId: string;
  name: string;
  version: string;
  owner: string;
  ownerPublicKey: string;
  capabilities: string[];
  purpose: string;
  chainHash: string;
  issuedAt: string;
  expiresAt: string;
}

interface RegistryDoc {
  agents: RegistryAgent[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
  total: number;
  note: string;
}

export default function AgentRegistryPage() {
  const [data, setData] = useState<RegistryDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/identity/registry?limit=50", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive) {
          setData(j);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setErr(String(e));
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered =
    data?.agents.filter((a) => {
      if (!filter) return true;
      const f = filter.toLowerCase();
      return (
        a.name.toLowerCase().includes(f) ||
        a.purpose.toLowerCase().includes(f) ||
        a.owner.toLowerCase().includes(f) ||
        a.capabilities.some((c) => c.toLowerCase().includes(f))
      );
    }) ?? [];

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-xs font-medium text-violet-300">
              <Shield className="w-3 h-3" />
              R38 — Know Your Agent (KYA)
            </div>
            <h1 className="mt-6 text-4xl md:text-6xl font-light tracking-tight text-white">
              Agent Registry,
              <br />
              <span className="bg-gradient-to-r from-violet-200 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
                cryptographically verifiable.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-neutral-400 leading-relaxed">
              Every agent below has a signed identity manifest declaring
              its owner, capabilities, model provenance, and code
              provenance. Verify any of them locally:
            </p>
            <pre className="mt-4 inline-block rounded-lg border border-white/10 bg-black/40 px-4 py-2 font-mono text-xs text-emerald-300">
              sovereign-inspect agent-identity {"<url>"} {"<agentId>"}
            </pre>
            <p className="mt-3 text-xs text-neutral-500">
              The math runs on YOUR machine, not ours. Sovereign is not
              a required trust anchor.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filter + count */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Filter by name, capability, owner, purpose..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-violet-500/40"
            />
          </div>
          {data && (
            <span className="text-xs text-neutral-500">
              {filtered.length} of {data.agents.length} agents
            </span>
          )}
        </div>

        {/* Agent list */}
        <div className="mt-8">
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-white/[0.02] animate-pulse"
                />
              ))}
            </div>
          )}

          {!loading && err && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
              <p className="text-sm text-red-300">Failed to load registry: {err}</p>
            </div>
          )}

          {!loading && !err && filtered.length === 0 && (
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-8 text-center">
              <Cpu className="w-8 h-8 text-violet-300 mx-auto" />
              <h2 className="mt-4 text-lg font-medium text-white">
                {data?.agents.length === 0
                  ? "Registry is empty"
                  : "No agents match your filter"}
              </h2>
              <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
                {data?.agents.length === 0
                  ? "No identity manifests have been registered yet. Be the first."
                  : "Try a different keyword."}
              </p>
            </div>
          )}

          {!loading && !err && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((agent, idx) => (
                <motion.div
                  key={agent.agentId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-medium text-white truncate">
                          {agent.name}
                        </h3>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-mono text-neutral-300">
                          v{agent.version}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          signed
                        </span>
                      </div>
                      {agent.purpose && (
                        <p className="mt-2 text-sm text-neutral-400">
                          {agent.purpose}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {agent.capabilities.slice(0, 8).map((cap) => (
                          <span
                            key={cap}
                            className="rounded-full border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 text-[11px] text-cyan-300"
                          >
                            {cap}
                          </span>
                        ))}
                        {agent.capabilities.length > 8 && (
                          <span className="text-[11px] text-neutral-500">
                            +{agent.capabilities.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={`/api/identity/manifests/${encodeURIComponent(agent.agentId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/[0.06] transition-colors"
                    >
                      Manifest
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-neutral-500">
                    <div>
                      <Hash className="inline w-3 h-3 mr-1" />
                      <span className="font-mono">
                        {agent.agentId.slice(0, 16)}...
                      </span>
                    </div>
                    <div>
                      owner: <span className="font-mono">{agent.owner}</span>
                    </div>
                    <div>
                      expires: {new Date(agent.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Verification CTA */}
        <div className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6">
          <h3 className="text-sm font-medium text-white">
            Verify any agent yourself
          </h3>
          <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
            The registry is a CONVENIENCE. The trust comes from the
            cryptography. Install the open-source verifier and check
            any agent on this page (or any Sovereign deployment) without
            trusting our server:
          </p>
          <pre className="mt-4 rounded-lg border border-white/10 bg-black/40 p-4 font-mono text-xs text-emerald-300 overflow-x-auto">
{`# Install the verifier (open source, MIT)
npm install -g @sovereign/inspector

# Verify any agent's identity locally
sovereign-inspect agent-identity ${typeof window !== "undefined" ? window.location.origin : "https://sovereignmatrix.agency"} <agent-id>

# Or browse the whole registry from CLI
sovereign-inspect registry ${typeof window !== "undefined" ? window.location.origin : "https://sovereignmatrix.agency"}`}
          </pre>
        </div>
      </section>
    </div>
  );
}
