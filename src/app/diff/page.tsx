import type { Metadata } from "next";
import Link from "next/link";
import { GitCompare, ShieldCheck } from "lucide-react";
import { DiffWidget } from "./DiffWidget";

export const metadata: Metadata = {
  title: "Receipt Diff — Sovereign Matrix",
  description:
    "Compare two AI agent receipts field by field. Use for model-version regression detection, vendor-vs-vendor output comparison, or before-and-after audit checkpoints.",
  openGraph: {
    title: "Sovereign Matrix — Receipt diff",
    description:
      "Paste two receipt ids. Get a field-by-field comparison. The procurement-grade regression-detection tool.",
  },
};

// 60s ISR — chrome is static; widget is fully client-side.
export const revalidate = 60;

/**
 * /diff — receipt comparison surface.
 *
 * Two text inputs (baseline + candidate receipt ids), one button, a
 * field-by-field diff rendered as four buckets: changed, only-in-A,
 * only-in-B, unchanged. Signatures shown side-by-side so the viewer
 * knows the diff is genuine and not just receipt-id noise.
 *
 * Use cases:
 *   1. Model-version regression — same agent, same input, two model
 *      versions; see what shifted in the output.
 *   2. Vendor comparison — same workflow run against two AI vendors,
 *      diff the outputs.
 *   3. Audit checkpoint — before/after a Guardian rule pack rollout,
 *      diff the same workflow's receipts.
 */
export default function DiffPage() {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          DIFF · TWO RECEIPTS · FIELD-BY-FIELD
        </p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
          What changed,
          <br />
          <span className="text-[#B5532C]">between runs.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          Paste two receipt ids from the same agent (or different vendors
          running the same workflow) and see a field-by-field diff. Built for
          procurement teams who need model-version regression detection, and for
          compliance reviewers comparing pre- and post-Guardian-rollout outputs.
        </p>

        <section className="mb-12">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-4">
            <GitCompare className="w-3 h-3" /> COMPARE
          </p>
          <DiffWidget />
        </section>

        <section className="mb-12 p-4 border border-white/[0.06] bg-white/[0.015] rounded-[3px]">
          <p className="font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mb-2">
            How the diff is computed
          </p>
          <ol className="text-[13px] text-neutral-400 leading-[1.7] space-y-1.5 list-decimal list-inside">
            <li>Fetch both receipts from /api/agent-runs/&lt;id&gt;.</li>
            <li>
              Flatten each object to dotted keys (e.g.{" "}
              <code className="text-neutral-300">
                output.safetyResult.score
              </code>
              ).
            </li>
            <li>
              Bucket every key: <span className="text-rose-300">changed</span>
              {" / "}
              <span className="text-cyan-300">only in A</span>
              {" / "}
              <span className="text-[#E08558]">only in B</span>
              {" / "}
              <span className="text-neutral-300">unchanged</span>.
            </li>
            <li>
              Signatures shown separately — they ALWAYS differ across distinct
              receipts. The diff intentionally excludes them from the field
              count so the viewer can focus on payload changes.
            </li>
          </ol>
          <p className="text-[11px] text-neutral-500 leading-[1.65] mt-3">
            This widget does NOT verify signatures —{" "}
            <Link
              href="/transparency/verify"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /transparency/verify
            </Link>{" "}
            does that. The diff trusts the platform to return the receipts as
            stored; for end-to-end verification chain a verify call after the
            diff.
          </p>
        </section>

        <section className="mb-12 p-4 border border-cyan-500/20 bg-cyan-500/[0.03] rounded-[3px]">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.2em] uppercase mb-2">
            <ShieldCheck className="w-3 h-3" /> Procurement use cases
          </p>
          <ul className="text-[13px] text-neutral-300 leading-[1.7] space-y-1.5 list-disc list-inside">
            <li>
              Model-version regression: same agent, same input, two model
              versions. See what shifted.
            </li>
            <li>
              Vendor-vs-vendor: run the same workflow against two AI vendors,
              diff their signed outputs.
            </li>
            <li>
              Guardian-rollout audit: before/after a new rule pack landing, diff
              the same workflow&apos;s receipts to confirm the rule didn&apos;t
              break anything orthogonal.
            </li>
          </ul>
        </section>

        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            See also{" "}
            <Link
              href="/transparency/verify"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /transparency/verify
            </Link>{" "}
            (verify a single receipt),{" "}
            <Link
              href="/auditor/replay"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /auditor/replay
            </Link>{" "}
            (forensic single-receipt walkthrough),{" "}
            <Link
              href="/transparency"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /transparency
            </Link>{" "}
            (STH + witnesses).
          </p>
        </div>
      </div>
    </main>
  );
}
