import type { Metadata } from "next";
import Link from "next/link";
import { listActiveTokens } from "@/lib/agent-tokens";
import { ShieldCheck, KeyRound, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Identity — Sovereign Matrix",
  description:
    "Live ledger of agent identity tokens currently in flight. Every agent run holds a short-lived, scoped, revocable JWT — and you can see them issued in real time.",
  openGraph: {
    title: "Sovereign Matrix — Agent identity, live",
    description:
      "92% of CISOs cannot see their AI agents. Watch ours work in the open.",
  },
};

// ISR: 10s so visitors see a near-live feed without the DB scan per hit.
export const revalidate = 10;

/**
 * /identity — Public live feed of currently-active agent JIT tokens.
 *
 * Sales-pitch surface for the "Authorization Gap" question every
 * regulated buyer asks: "if your AI does something wrong, can you
 * point me at WHICH agent did it?" Yes — and we'll show you the
 * issued tokens, expiry windows, and scopes in real time.
 *
 * Privacy: tokenIds shown are short-lived (≤1h). User ids and tenant
 * ids are NOT echoed — visitors see agent slug + scope + lifecycle
 * only. The endpoint behind this page (/api/agent-tokens) returns the
 * same shape so an external auditor can poll it directly.
 */
export default async function IdentityPage() {
  const tokens = await listActiveTokens({ limit: 50 });
  // Compute once at request time — passed down to TokenCard so the card's
  // render function stays pure (react-hooks/purity).
  //
  // react-compiler doesn't yet model the server-component vs client-component
  // distinction. This is an async server component running at request time,
  // where Date.now() is the canonical way to capture "now" — same status as
  // listActiveTokens() above (which is also impure but allowed).
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          IDENTITY · LIVE AGENT TOKENS · {tokens.length} ACTIVE
        </p>
        <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-[-0.02em] text-white mb-5">
          You can see
          <br />
          <span className="text-[#B5532C]">every agent we run.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-10">
          92% of CISOs say they lack visibility into AI agent identities.
          Sovereign agents hold short-lived JWT tokens (≤1 hour, signed with the
          same Ed25519 / HMAC key every receipt uses). Below is every token
          currently in flight across the platform. Poll{" "}
          <code className="text-cyan-300">/api/agent-tokens</code> for the
          machine-readable feed.
        </p>

        <div className="mb-10 px-5 py-4 border border-cyan-500/20 bg-cyan-500/[0.04] rounded-[3px]">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.2em] uppercase mb-2">
            <KeyRound className="w-3 h-3" /> Token lifecycle invariants
          </p>
          <ul className="text-[13px] text-neutral-400 leading-[1.7] space-y-1">
            <li>
              · Default TTL:{" "}
              <strong className="text-cyan-200">15 minutes</strong>. Hard cap 1
              hour. No token outlives the run that issued it.
            </li>
            <li>
              · Every token cites a single agent slug and a closed scope set
              (e.g. <code>tool:fetch</code>, <code>receipt:issue</code>).
            </li>
            <li>
              · Revocation flips the row instantly. Verifiers that hit{" "}
              <code className="text-cyan-300">
                /api/agent-tokens/&lt;id&gt;/status
              </code>{" "}
              get the new state with no cache.
            </li>
            <li>
              · Every issue + revoke event lands on the hash-chained audit log,
              anchored to Bitcoin daily (Wave 9).
            </li>
          </ul>
        </div>

        {tokens.length === 0 ? (
          <div className="px-5 py-12 border border-white/[0.06] rounded-[3px] bg-white/[0.015] text-center">
            <p className="font-mono text-[12px] text-neutral-500 tracking-[0.15em] uppercase">
              No agents currently running
            </p>
            <p className="text-[13px] text-neutral-600 mt-3 leading-[1.6] max-w-md mx-auto">
              The feed populates when an agent starts. Refresh once an agent
              invocation is in flight and you&apos;ll see its token issued,
              scoped, and counted down.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tokens.map((t) => (
              <TokenCard key={t.id} t={t} nowMs={nowMs} />
            ))}
          </div>
        )}

        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            Verify any token by id at{" "}
            <code className="text-neutral-300">
              /api/agent-tokens/&lt;id&gt;/status
            </code>
            . Per-receipt forensics →{" "}
            <Link
              href="/auditor/replay"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /auditor/replay
            </Link>
            . Bitcoin-anchored audit chain →{" "}
            <Link
              href="/api/auditor/anchor"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /api/auditor/anchor
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

interface TokenView {
  id: string;
  agentSlug: string;
  tenantId: string | null;
  userId: string | null;
  scopes: string[];
  scheme: string;
  issuedAt: string;
  expiresAt: string;
}

function TokenCard({ t, nowMs }: { t: TokenView; nowMs: number }) {
  // nowMs is computed once by the parent server component at request time
  // (rather than during this card's render) so the function is pure.
  const issuedMs = new Date(t.issuedAt).getTime();
  const expiresMs = new Date(t.expiresAt).getTime();
  const ttlMs = expiresMs - issuedMs;
  const elapsedMs = Math.max(0, Math.min(ttlMs, nowMs - issuedMs));
  const pct = ttlMs > 0 ? Math.round((elapsedMs / ttlMs) * 100) : 0;
  const remainingMin = Math.max(0, Math.round((expiresMs - nowMs) / 60_000));

  return (
    <article className="border border-white/[0.06] rounded-[3px] p-5 bg-white/[0.015]">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-[10px] text-[#E08558] tracking-[0.15em] uppercase">
            {t.agentSlug}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-[2px] border border-cyan-500/25 bg-cyan-500/[0.04] text-cyan-300">
            {t.scheme === "v2" ? "ed25519" : "hmac-sha256"}
          </span>
          {t.scopes.map((s) => (
            <span
              key={s}
              className="font-mono text-[9px] text-neutral-500 tracking-[0.1em]"
            >
              {s}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-500">
          <Clock className="w-3 h-3" />
          <span>{remainingMin}m left</span>
        </div>
      </div>
      <code className="block font-mono text-[11px] text-neutral-400 break-all leading-[1.5] mb-3">
        {t.id}
      </code>
      <div className="h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-500/60"
          style={{ width: `${pct}%` }}
          aria-label={`${pct}% of token TTL elapsed`}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-neutral-600 tracking-[0.1em] uppercase">
        <span>issued {new Date(t.issuedAt).toISOString().slice(11, 19)}Z</span>
        <Link
          href={`/api/agent-tokens/${t.id}/status`}
          className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
        >
          <ShieldCheck className="w-3 h-3" />
          status
        </Link>
      </div>
    </article>
  );
}
