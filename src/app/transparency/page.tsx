import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
  TreePine,
  ShieldCheck,
  Hash,
  Clock,
  Terminal,
  Users,
  ArrowRight,
} from "lucide-react";
import { getDemoTransparencyLog } from "@/lib/transparency-singleton";
import { canonicalizeSth } from "@sovereign-matrix/verifiable-receipts/transparency";
import { signRun } from "@/lib/agent-runs";
import { sthKey, getCosignatures } from "@/lib/witness-store";

export const metadata: Metadata = {
  title: "Transparency Log — Sovereign Matrix",
  description:
    "Public append-only Merkle log of AI agent receipts. RFC 6962-style. Current Signed Tree Head, inclusion / consistency proof endpoints, and N-witness cosignatures — all independently verifiable.",
  openGraph: {
    title: "Sovereign Matrix — AI Receipt Transparency Log",
    description:
      "RFC 6962-style append-only Merkle log. Fetch the STH, verify the math, no account.",
  },
};

// ISR — STH only advances when a leaf is appended. 60-second cache is
// plenty for the demo + matches the endpoint's own cache header.
export const revalidate = 60;

/**
 * /transparency — public monitor surface for the ART-Log.
 *
 * Audience: regulators, auditors, security researchers, the curious.
 * The page is server-rendered against the live demo TransparencyLog
 * so the bytes shown ARE the bytes the API returns at the same moment.
 * Anyone running the OSS verifier can reproduce the hash chain locally.
 */
export default async function TransparencyPage() {
  // Force the request headers context so this page is dynamic when
  // we want it to be — fine for ISR since we explicitly cache for 60s.
  void (await headers());

  const tlog = await getDemoTransparencyLog();
  const sth = tlog.currentSth();
  const canonical = canonicalizeSth(sth);
  const signature = signRun(canonical);
  const isSigned = signature !== "unsigned";
  const witnessCount = getCosignatures(canonical).length;
  const sthHash = sthKey(canonical);

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-4xl mx-auto">
        {/* Editorial header */}
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          TRANSPARENCY · RFC 6962-STYLE · APPEND-ONLY
        </p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
          The log
          <br />
          <span className="text-[#B5532C]">anyone can audit.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          Every receipt we sign is appended to a public Merkle tree. The current
          Signed Tree Head is below, signed Ed25519. Independent witnesses
          co-sign the STH on their schedule, making fork or rewrite
          mathematically detectable — even if Sovereign Matrix itself were
          compromised.
        </p>

        {/* CURRENT STH — the page's center of gravity */}
        <section className="mb-16">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-4">
            <TreePine className="w-3 h-3" /> 01 · CURRENT SIGNED TREE HEAD
          </p>
          <div className="border border-cyan-500/25 bg-cyan-500/[0.04] rounded-[3px] p-5 space-y-4">
            <StatRow label="Log id" value={sth.logId} mono />
            <StatRow
              label="Tree size"
              value={String(sth.treeSize)}
              icon={<Hash className="w-3 h-3" />}
            />
            <StatRow
              label="Root hash (SHA-256)"
              value={sth.rootHash}
              mono
              breakAll
            />
            <StatRow
              label="Generated at"
              value={sth.timestamp}
              icon={<Clock className="w-3 h-3" />}
            />
            <StatRow
              label="Signature"
              value={
                isSigned
                  ? signature
                  : "unsigned (no Ed25519 key configured on this deploy)"
              }
              mono
              breakAll
              accent={isSigned ? "cyan" : "neutral"}
            />
            <StatRow
              label="Witness cosignatures"
              value={`${witnessCount} witness${witnessCount === 1 ? "" : "es"} have co-signed this STH`}
              icon={<Users className="w-3 h-3" />}
              accent={witnessCount > 0 ? "copper" : "neutral"}
            />
          </div>
          <details className="mt-4 border border-white/[0.06] rounded-[3px] p-4 bg-white/[0.015]">
            <summary className="flex items-center gap-2 font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase cursor-pointer hover:text-neutral-300">
              <Hash className="w-3 h-3" /> Show canonical bytes (
              {canonical.length} bytes; SHA-256 = {sthHash.slice(0, 16)}…)
            </summary>
            <pre className="mt-3 text-[11px] font-mono text-neutral-400 leading-[1.55] overflow-x-auto whitespace-pre-wrap break-words">
              {canonical}
            </pre>
            <p className="text-[11px] text-neutral-500 mt-3 leading-[1.6]">
              The signature above commits to{" "}
              <em className="not-italic text-neutral-300">exactly</em> these
              bytes. A verifier hashes this string with SHA-256 and checks the
              Ed25519 signature against the public key at{" "}
              <code className="text-neutral-300">
                /.well-known/sovereign-receipts/ed25519.pem
              </code>
              .
            </p>
          </details>
        </section>

        {/* HOW TO VERIFY — the elite procurement move */}
        <section className="mb-16">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-4">
            <ShieldCheck className="w-3 h-3" /> 02 · VERIFY YOURSELF
          </p>
          <p className="text-[14px] text-neutral-400 leading-[1.65] mb-4">
            Three independent endpoints, all open-CORS, no account required:
          </p>
          <div className="space-y-3">
            <EndpointCard
              method="GET"
              path="/api/transparency/sth"
              desc="Current Signed Tree Head + canonical bytes."
            />
            <EndpointCard
              method="GET"
              path="/api/transparency/proof?kind=inclusion&index=N&size=M"
              desc="Inclusion proof for the leaf at index N within the tree of size M."
            />
            <EndpointCard
              method="GET"
              path="/api/transparency/proof?kind=consistency&old=M&new=N"
              desc="Consistency proof — confirms the log at size M is a prefix of the log at size N. Catches forks."
            />
          </div>
          <p className="font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mt-6 mb-2">
            Then verify the math locally:
          </p>
          <pre className="bg-black/40 border border-white/[0.06] rounded-[3px] p-4 overflow-x-auto text-[12px] text-cyan-300/90 font-mono leading-[1.6]">
            <Terminal className="inline w-3 h-3 text-cyan-300 mr-2 -mt-0.5" />
            <code>
              {`npm install @sovereign-matrix/verifiable-receipts`}
              {"\n\n"}
              {`import {`}
              {"\n"}
              {`  verifyInclusionProof,`}
              {"\n"}
              {`  verifyConsistencyProof,`}
              {"\n"}
              {`} from "@sovereign-matrix/verifiable-receipts/transparency";`}
            </code>
          </pre>
          <p className="text-[11px] text-neutral-500 mt-3 leading-[1.6]">
            The Apache-2.0 verifier is ~350 LoC of pure-TypeScript with one
            runtime dep (
            <code className="text-neutral-300">@noble/post-quantum</code> for
            ML-DSA-65). Your security team can audit it before running it.
          </p>
        </section>

        {/* WITNESS PROTOCOL — the trust-distribution layer */}
        <section className="mb-16">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-4">
            <Users className="w-3 h-3" /> 03 · WITNESS PROTOCOL
          </p>
          <p className="text-[14px] text-neutral-400 leading-[1.65] mb-4">
            A witness is any independent party — a regulator, a customer&apos;s
            security team, a research group — that periodically fetches the STH,
            verifies consistency since the last witnessed STH, and submits its
            own signature. Three or more independent witnesses make a vendor-
            controlled log fork mathematically infeasible.
          </p>
          <ol className="space-y-3 text-[14px] text-neutral-400 leading-[1.7]">
            <Step
              n="01"
              body="Fetch the current STH at /api/transparency/sth on your schedule (recommended ≥ hourly)."
            />
            <Step
              n="02"
              body="Verify a consistency proof from your last-witnessed STH to the current one. If it fails, the log has forked or rewritten — publish a fork notice."
            />
            <Step
              n="03"
              body="If consistency holds, sign the canonical bytes with your Ed25519 keypair and POST to /api/transparency/witness."
            />
            <Step
              n="04"
              body="Publish your witness pubkey so any verifier can independently confirm your cosignature."
            />
          </ol>
          <p className="text-[11px] text-neutral-500 mt-4 leading-[1.6]">
            POST endpoint:{" "}
            <code className="text-neutral-300">
              POST /api/transparency/witness
            </code>{" "}
            · GET endpoint:{" "}
            <code className="text-neutral-300">
              GET /api/transparency/witness?sth=&lt;canonical&gt;
            </code>
            . See{" "}
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/specs/transparency-log.md"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              docs/specs/transparency-log.md §5
            </a>{" "}
            for the full protocol.
          </p>
        </section>

        {/* Footer trust strip */}
        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            See also{" "}
            <Link
              href="/spec"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /spec
            </Link>{" "}
            (VAOS wire formats),{" "}
            <Link
              href="/pilot"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /pilot
            </Link>{" "}
            (procurement-ready pilot),{" "}
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/verifiable-receipts"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              OSS verifier (Apache-2.0)
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

function StatRow({
  label,
  value,
  mono,
  breakAll,
  icon,
  accent = "neutral",
}: {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
  icon?: React.ReactNode;
  accent?: "neutral" | "cyan" | "copper";
}) {
  const accentClass =
    accent === "cyan"
      ? "text-cyan-300"
      : accent === "copper"
        ? "text-[#E08558]"
        : "text-neutral-200";
  return (
    <div>
      <p className="flex items-center gap-1.5 font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mb-1">
        {icon}
        {label}
      </p>
      <p
        className={`text-[13px] leading-[1.55] ${mono ? "font-mono" : ""} ${breakAll ? "break-all" : ""} ${accentClass}`}
      >
        {value}
      </p>
    </div>
  );
}

function EndpointCard({
  method,
  path,
  desc,
}: {
  method: string;
  path: string;
  desc: string;
}) {
  return (
    <a
      href={path}
      className="block p-3 rounded-[3px] border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.12] transition-colors group"
    >
      <div className="flex items-baseline gap-3 mb-1">
        <span className="font-mono text-[10px] text-[#E08558] tracking-[0.15em]">
          {method}
        </span>
        <code className="font-mono text-[12px] text-cyan-300 break-all flex-1">
          {path}
        </code>
        <ArrowRight className="w-3 h-3 text-neutral-600 group-hover:text-cyan-300 transition-colors shrink-0" />
      </div>
      <p className="text-[12px] text-neutral-500 leading-[1.55]">{desc}</p>
    </a>
  );
}

function Step({ n, body }: { n: string; body: string }) {
  return (
    <li>
      <span className="font-mono text-[#E08558] mr-3">{n}</span>
      <span>{body}</span>
    </li>
  );
}
