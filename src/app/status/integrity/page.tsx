import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  TreePine,
  Anchor,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Integrity Status — Sovereign Matrix",
  description:
    "Live crypto-integrity health: receipt scheme enablement, transparency-log size + STH freshness, last Bitcoin anchor, witness cosignature count. Procurement-grade signal in one URL.",
  openGraph: {
    title: "Sovereign Matrix — Integrity status",
    description:
      "One URL for procurement automation. Receipt schemes, transparency-log STH, Bitcoin anchor freshness, witness count.",
  },
};

// 60s ISR — STH advances on append; anchor on cron schedule; both
// happily tolerate a minute of cache.
export const revalidate = 60;

/**
 * /status/integrity — receipt + transparency + anchor health.
 *
 * Sister page to /status (synthetic-probe endpoint health). This
 * one focuses on the cryptographic integrity layer that's unique
 * to this platform.
 *
 * Three independent endpoints aggregated server-side:
 *   1. /api/security/posture — schemes active, last anchor, stale flag
 *   2. /api/transparency/sth — current STH (size, root, timestamp)
 *   3. /api/transparency/witness — cosignature count on current STH
 *
 * Renders a HEALTH VERDICT at the top — green/amber/red based on
 * objective rules: any scheme active = green, no schemes = red,
 * anchor stale = amber, witnesses=0 = amber.
 */

interface IntegrityState {
  schemes: { v1: boolean; v2: boolean; v3: boolean };
  treeSize: number | null;
  rootHash: string | null;
  sthTimestamp: string | null;
  sthAgeSeconds: number | null;
  anchorTimestamp: string | null;
  anchorStale: boolean;
  witnessCount: number;
  verdict: "ok" | "degraded" | "fail";
  reasons: string[];
}

async function loadIntegrity(): Promise<IntegrityState> {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const base = `${proto}://${host}`;

  const state: IntegrityState = {
    schemes: { v1: false, v2: false, v3: false },
    treeSize: null,
    rootHash: null,
    sthTimestamp: null,
    sthAgeSeconds: null,
    anchorTimestamp: null,
    anchorStale: false,
    witnessCount: 0,
    verdict: "ok",
    reasons: [],
  };

  // Posture
  try {
    const postureRes = await fetch(`${base}/api/security/posture`, {
      next: { revalidate: 60 },
    });
    if (postureRes.ok) {
      const body = (await postureRes.json()) as {
        receipts: {
          schemes: {
            v1_hmac_sha256: { enabled: boolean };
            v2_ed25519: { enabled: boolean };
            v3_ed25519_mldsa65: { enabled: boolean };
          };
        };
        chainOfCustody: { lastAnchoredAt: string | null; stale?: boolean };
      };
      state.schemes = {
        v1: body.receipts.schemes.v1_hmac_sha256.enabled,
        v2: body.receipts.schemes.v2_ed25519.enabled,
        v3: body.receipts.schemes.v3_ed25519_mldsa65.enabled,
      };
      state.anchorTimestamp = body.chainOfCustody.lastAnchoredAt;
      state.anchorStale = body.chainOfCustody.stale === true;
    }
  } catch {
    state.reasons.push("posture endpoint unreachable");
  }

  // STH
  try {
    const sthRes = await fetch(`${base}/api/transparency/sth`, {
      next: { revalidate: 60 },
    });
    if (sthRes.ok) {
      const sth = (await sthRes.json()) as {
        treeSize: number;
        rootHash: string;
        timestamp: string;
        canonical: string;
      };
      state.treeSize = sth.treeSize;
      state.rootHash = sth.rootHash;
      state.sthTimestamp = sth.timestamp;
      state.sthAgeSeconds = Math.floor(
        (Date.now() - new Date(sth.timestamp).getTime()) / 1000,
      );

      // Witnesses on this STH
      try {
        const witRes = await fetch(
          `${base}/api/transparency/witness?sth=${encodeURIComponent(sth.canonical)}`,
          { next: { revalidate: 60 } },
        );
        if (witRes.ok) {
          const wit = (await witRes.json()) as { witnessCount: number };
          state.witnessCount = wit.witnessCount;
        }
      } catch {
        /* non-blocking */
      }
    }
  } catch {
    state.reasons.push("transparency STH endpoint unreachable");
  }

  // Verdict logic
  const anyScheme = state.schemes.v1 || state.schemes.v2 || state.schemes.v3;
  if (!anyScheme) {
    state.verdict = "fail";
    state.reasons.push("no signing scheme configured — receipts unsignable");
  } else if (state.anchorStale) {
    state.verdict = "degraded";
    state.reasons.push("Bitcoin anchor cron > 6h behind");
  } else if (state.witnessCount === 0 && state.treeSize && state.treeSize > 0) {
    state.verdict = state.verdict === "fail" ? "fail" : "degraded";
    state.reasons.push("zero witness cosignatures on current STH");
  }

  return state;
}

export default async function IntegrityStatusPage() {
  let state: IntegrityState | null = null;
  let error: string | null = null;
  try {
    state = await loadIntegrity();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          STATUS · INTEGRITY · LIVE
        </p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
          Integrity,
          <br />
          <span className="text-[#B5532C]">in one number.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          Procurement reviewers and witness operators ping this URL to check the
          crypto-integrity layer in one round trip — receipt scheme enablement,
          transparency-log STH freshness, Bitcoin anchor age, witness
          cosignature count.{" "}
          <Link
            href="/status"
            className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
          >
            /status
          </Link>{" "}
          covers synthetic-probe endpoint health.
        </p>

        {error && (
          <div className="mb-10 p-5 border border-rose-500/30 bg-rose-500/[0.04] rounded-[3px]">
            <p className="flex items-center gap-2 font-mono text-[10px] text-rose-300 tracking-[0.2em] uppercase mb-2">
              <XCircle className="w-3 h-3" /> Status fetch failed
            </p>
            <p className="text-[13px] text-neutral-300 leading-[1.6]">
              {error}
            </p>
          </div>
        )}

        {state && (
          <>
            <VerdictBanner verdict={state.verdict} reasons={state.reasons} />

            <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Tile
                icon={<ShieldCheck className="w-3 h-3" />}
                label="Receipt schemes active"
                value={
                  <div className="flex flex-wrap gap-1.5">
                    {(["v1", "v2", "v3"] as const).map((k) => (
                      <span
                        key={k}
                        className={`px-2 py-0.5 rounded-[3px] font-mono text-[11px] ${
                          state.schemes[k]
                            ? "text-cyan-300 border border-cyan-500/30 bg-cyan-500/[0.06]"
                            : "text-neutral-600 border border-white/[0.05] bg-white/[0.02]"
                        }`}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                }
              />
              <Tile
                icon={<TreePine className="w-3 h-3" />}
                label="Transparency log size"
                value={
                  state.treeSize !== null ? (
                    <span className="font-mono text-[13px] text-neutral-200">
                      {state.treeSize.toLocaleString()} leaves
                    </span>
                  ) : (
                    <span className="text-[12px] text-neutral-500">
                      unavailable
                    </span>
                  )
                }
              />
              <Tile
                icon={<TreePine className="w-3 h-3" />}
                label="Latest STH age"
                value={
                  state.sthAgeSeconds !== null ? (
                    <span
                      className={`text-[12px] ${
                        state.sthAgeSeconds < 3600
                          ? "text-cyan-300"
                          : state.sthAgeSeconds < 24 * 3600
                            ? "text-neutral-300"
                            : "text-amber-300"
                      }`}
                    >
                      {formatAge(state.sthAgeSeconds)}
                    </span>
                  ) : (
                    <span className="text-[12px] text-neutral-500">—</span>
                  )
                }
              />
              <Tile
                icon={<Anchor className="w-3 h-3" />}
                label="Last Bitcoin anchor"
                value={
                  state.anchorTimestamp ? (
                    <span
                      className={`text-[12px] ${state.anchorStale ? "text-amber-300" : "text-neutral-300"}`}
                    >
                      {state.anchorTimestamp}
                      {state.anchorStale && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em]">
                          stale
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[12px] text-neutral-500">—</span>
                  )
                }
              />
              <Tile
                icon={<Users className="w-3 h-3" />}
                label="Witnesses on current STH"
                value={
                  <span
                    className={`text-[13px] font-mono ${
                      state.witnessCount > 2
                        ? "text-cyan-300"
                        : state.witnessCount > 0
                          ? "text-neutral-200"
                          : "text-amber-300"
                    }`}
                  >
                    {state.witnessCount}
                  </span>
                }
              />
              <Tile
                icon={<ShieldCheck className="w-3 h-3" />}
                label="Root hash"
                value={
                  state.rootHash ? (
                    <code className="font-mono text-[11px] text-neutral-300 break-all">
                      {state.rootHash.slice(0, 20)}…
                    </code>
                  ) : (
                    <span className="text-[12px] text-neutral-500">—</span>
                  )
                }
              />
            </section>

            <div className="mt-10 p-4 border border-white/[0.06] bg-white/[0.015] rounded-[3px]">
              <p className="font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mb-2">
                Source endpoints (open CORS)
              </p>
              <ul className="text-[12px] font-mono text-neutral-400 leading-[1.7] space-y-1">
                <li>
                  <Link
                    href="/api/security/posture"
                    className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
                  >
                    /api/security/posture
                  </Link>{" "}
                  · receipt schemes + Bitcoin anchor metadata
                </li>
                <li>
                  <Link
                    href="/api/transparency/sth"
                    className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
                  >
                    /api/transparency/sth
                  </Link>{" "}
                  · current Signed Tree Head
                </li>
                <li>
                  <Link
                    href="/api/transparency/witness?sth=&lt;canonical&gt;"
                    className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
                  >
                    /api/transparency/witness
                  </Link>{" "}
                  · cosignature lookup by STH
                </li>
              </ul>
            </div>
          </>
        )}

        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            See also{" "}
            <Link
              href="/status"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /status
            </Link>{" "}
            (synthetic probes),{" "}
            <Link
              href="/security/live"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /security/live
            </Link>{" "}
            (full posture),{" "}
            <Link
              href="/transparency"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /transparency
            </Link>{" "}
            (live STH + witnesses).
          </p>
        </div>
      </div>
    </main>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 24 * 3600) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / (24 * 3600))}d ago`;
}

function VerdictBanner({
  verdict,
  reasons,
}: {
  verdict: "ok" | "degraded" | "fail";
  reasons: string[];
}) {
  const config = {
    ok: {
      bg: "bg-cyan-500/[0.05]",
      border: "border-cyan-500/30",
      text: "text-cyan-300",
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: "All integrity signals nominal",
    },
    degraded: {
      bg: "bg-amber-500/[0.04]",
      border: "border-amber-500/30",
      text: "text-amber-300",
      icon: <AlertTriangle className="w-4 h-4" />,
      label: "Degraded — operator action recommended",
    },
    fail: {
      bg: "bg-rose-500/[0.05]",
      border: "border-rose-500/30",
      text: "text-rose-300",
      icon: <XCircle className="w-4 h-4" />,
      label: "Failing — receipts cannot sign or verify",
    },
  }[verdict];
  return (
    <div className={`p-5 border rounded-[3px] ${config.border} ${config.bg}`}>
      <p
        className={`flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase mb-2 ${config.text}`}
      >
        {config.icon}
        {config.label}
      </p>
      {reasons.length > 0 && (
        <ul className="text-[13px] text-neutral-300 leading-[1.65] list-disc list-inside">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-[3px] border border-white/[0.06] bg-white/[0.015]">
      <p className="flex items-center gap-1.5 font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase mb-1.5">
        {icon}
        {label}
      </p>
      <div>{value}</div>
    </div>
  );
}
