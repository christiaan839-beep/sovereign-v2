/**
 * /r/[id] — public verifiable agent receipt page.
 *
 * The differentiator: every Sovereign agent run produces a signed,
 * shareable receipt. Anyone with the URL can see what input was sent,
 * which model handled it, which safety checks ran, and what output
 * came back — and verify the HMAC signature against the server.
 *
 * Server-rendered for SEO + zero-JS readability. Visibility gating
 * is enforced by the underlying /api/agent-runs/[id] route (404 for
 * private runs unless the requester is the owner).
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Clock,
  KeyRound,
  ArrowLeft,
} from "lucide-react";
import { getRun, canonicalizeRun } from "@/lib/agent-runs";
import { auth } from "@clerk/nextjs/server";
import PrintReceiptButton from "./PrintReceiptButton";

interface RunPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

function formatBytes(json: string): string {
  if (json.length < 1024) return `${json.length} B`;
  return `${(json.length / 1024).toFixed(1)} KB`;
}

function safetyBadge(value: unknown, label: string) {
  if (value === undefined) return null;
  const passed =
    value === "pass" ||
    value === true ||
    (typeof value === "number" && value >= 60);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        passed
          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border border-rose-500/30 bg-rose-500/10 text-rose-200"
      }`}
    >
      {passed ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <AlertTriangle className="h-3 w-3" />
      )}
      {label}
      {typeof value === "number" ? `: ${value}` : ""}
    </span>
  );
}

export default async function ReceiptPage({ params }: RunPageProps) {
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{32,40}$/i.test(id)) notFound();

  const run = await getRun(id);
  if (!run) notFound();

  // Visibility gate
  if (run.visibility === "private") {
    const { userId } = await auth();
    if (!userId || userId !== run.userId) notFound();
  }

  const canonical = canonicalizeRun({
    id: run.id,
    agentName: run.agentName,
    modelUsed: run.modelUsed,
    input: run.input,
    output: run.output,
    safetyResult: run.safetyResult,
    durationMs: run.durationMs,
    createdAt: run.createdAt,
  });

  const inputJson = JSON.stringify(run.input, null, 2);
  const outputJson = JSON.stringify(run.output, null, 2);
  const created =
    run.createdAt instanceof Date ? run.createdAt : new Date(run.createdAt);

  // Build the public verify URL so users can confirm we're serving
  // them their own receipt unchanged.
  const host =
    (await headers()).get("x-forwarded-host") ??
    (await headers()).get("host") ??
    "";
  const proto = (await headers()).get("x-forwarded-proto") ?? "https";
  const publicUrl = host ? `${proto}://${host}/r/${run.id}` : `/r/${run.id}`;

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200 receipt-page">
      {/* Print stylesheet — when the user does Cmd+P or hits the
          "Save as PDF" button, this fires and renders a clean
          monochrome document with all signature evidence intact. */}
      <style>{`
        @media print {
          .receipt-page { background: #fff !important; color: #000 !important; }
          .receipt-page * { color: #000 !important; background: transparent !important;
            border-color: #ccc !important; }
          .no-print { display: none !important; }
          .receipt-page pre { white-space: pre-wrap !important; word-break: break-all !important;
            max-height: none !important; overflow: visible !important;
            font-size: 9pt !important; }
          .receipt-page section { break-inside: avoid; page-break-inside: avoid; }
          .receipt-page a { text-decoration: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="no-print inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Sovereign Matrix
          </Link>
          <PrintReceiptButton />
        </div>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan-300" />
              <span className="text-xs font-semibold uppercase tracking-widest text-cyan-300/80">
                Verifiable Agent Receipt
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {run.agentName}
            </h1>
            <p className="mt-2 flex items-center gap-3 text-sm text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {created.toUTCString()}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                {run.modelUsed}
              </span>
              <span>·</span>
              <span>{run.durationMs} ms</span>
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              run.visibility === "private"
                ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                : run.visibility === "public"
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border border-white/10 bg-white/5 text-neutral-300"
            }`}
          >
            {run.visibility}
          </span>
        </div>

        {/* Safety strip */}
        <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Safety pipeline
          </h2>
          <div className="flex flex-wrap gap-2">
            {safetyBadge(run.safetyResult.jailbreak, "Jailbreak")}
            {safetyBadge(run.safetyResult.pii, "PII")}
            {safetyBadge(run.safetyResult.content, "Content policy")}
            {safetyBadge(run.safetyResult.quality, "Quality")}
            {safetyBadge(run.safetyResult.critic, "Critic")}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300">
              Trust: {run.trustDecision}
            </span>
          </div>
        </section>

        {/* Input */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <h2 className="text-sm font-medium text-white">Input</h2>
            <span className="text-xs text-neutral-500">
              {formatBytes(inputJson)}
            </span>
          </div>
          <pre className="max-h-96 overflow-auto p-5 font-mono text-xs leading-relaxed text-neutral-300">
            {inputJson}
          </pre>
        </section>

        {/* Output */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <h2 className="text-sm font-medium text-white">Output</h2>
            <span className="text-xs text-neutral-500">
              {formatBytes(outputJson)}
            </span>
          </div>
          <pre className="max-h-[600px] overflow-auto p-5 font-mono text-xs leading-relaxed text-neutral-300">
            {outputJson}
          </pre>
        </section>

        {/* Signature */}
        <section className="mb-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.04] to-transparent p-5 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-cyan-300" />
            <h2 className="text-sm font-medium text-white">
              HMAC-SHA256 signature
            </h2>
          </div>
          <p className="mb-3 text-xs text-neutral-400">
            This signature is computed over the canonical projection of the run,
            keyed by a secret known only to Sovereign. Anyone with this page can
            re-derive the canonical string and ask the server to confirm the
            signature — proving the receipt has not been tampered with.
          </p>
          <code className="block break-all rounded-lg bg-black/40 p-3 font-mono text-xs text-cyan-200">
            {run.signature}
          </code>
          <details className="mt-3 group">
            <summary className="cursor-pointer text-xs text-neutral-400 group-open:text-neutral-200">
              Show canonical projection (for verification)
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-neutral-300">
              {canonical}
            </pre>
          </details>
        </section>

        <p className="text-center text-xs text-neutral-600">
          Permanent URL: <code className="text-neutral-400">{publicUrl}</code>
        </p>
      </div>
    </div>
  );
}
