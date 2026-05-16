import type { Metadata } from "next";
import Link from "next/link";
import { Terminal, KeyRound, ShieldCheck, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Quickstart — Sovereign Matrix",
  description:
    "Five minutes from `npm install` to a cryptographically-signed agent run. Copy, paste, run.",
  openGraph: {
    title: "Sovereign Matrix — 5-minute quickstart",
    description:
      "Install the SDK, run an agent, verify the receipt — under 5 minutes.",
  },
};

// ISR — docs surface, regenerate hourly.
export const revalidate = 3600;

/**
 * /docs/quickstart — Wave 34.
 *
 * Five-step copy-paste devloop. The goal: a developer landing here
 * fresh from the marketing site is running a signed agent + verifying
 * the receipt inside 5 minutes. Every block is real, copy-pasteable,
 * and reproducible.
 *
 * Brand-strict cyan / copper. Pure server component, zero JS.
 */
export default function QuickstartPage() {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        {/* Editorial header */}
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          QUICKSTART · 5 MINUTES · COPY → PASTE → RUN
        </p>
        <h1 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-[-0.02em] text-white mb-5">
          Your first signed
          <br />
          <span className="text-[#B5532C]">agent run.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          Five steps. No demo accounts. No sandbox. Every step uses the
          production SDK against the production verifier. The receipt you
          produce on step 4 is verifiable by anyone, anywhere, including your
          own auditor.
        </p>

        {/* Step 01 */}
        <Step n="01" title="Install the SDK">
          <p className="text-[14px] text-neutral-400 leading-[1.6] mb-3">
            Apache-2.0 licensed. Zero runtime dependencies inside the client
            (Node 18+ built-in fetch is the only requirement).
          </p>
          <CodeBlock>
            <span className="text-neutral-500"># pick your manager</span>
            {"\n"}npm install @sovereign-matrix/agent-sdk{"\n"}
            <span className="text-neutral-500"># or</span>
            {"\n"}pnpm add @sovereign-matrix/agent-sdk
          </CodeBlock>
        </Step>

        {/* Step 02 */}
        <Step n="02" title="Get an API key">
          <p className="text-[14px] text-neutral-400 leading-[1.6] mb-3">
            Free tier is 50 verified runs per month — no credit card. Keys land
            at{" "}
            <Link
              href="/dashboard/api-keys"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /dashboard/api-keys
            </Link>{" "}
            on first sign-in. Set it as <code>SOVEREIGN_API_KEY</code> in your
            environment.
          </p>
          <CodeBlock>
            export SOVEREIGN_API_KEY=&quot;sk_live_...&quot;
          </CodeBlock>
        </Step>

        {/* Step 03 */}
        <Step n="03" title="Run an agent">
          <p className="text-[14px] text-neutral-400 leading-[1.6] mb-3">
            The lead-blitz agent generates an outbound research packet from a
            single ICP description. Pick any of the 140 agents at{" "}
            <Link
              href="/marketplace"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /marketplace
            </Link>
            ; the call shape is identical.
          </p>
          <CodeBlock>
            {`import { SovereignClient } from "@sovereign-matrix/agent-sdk";

const sov = new SovereignClient({
  apiKey: process.env.SOVEREIGN_API_KEY!,
});

const result = await sov.runAgent("lead-blitz", {
  icp: "Cape Town SaaS founders, 5-50 employees",
});

console.log(result.output);
console.log("Receipt id:", result.receipt.receiptId);
console.log("Verified:  ", result.receipt.verified);`}
          </CodeBlock>
        </Step>

        {/* Step 04 */}
        <Step n="04" title="Verify the receipt">
          <p className="text-[14px] text-neutral-400 leading-[1.6] mb-3">
            The SDK verifies the signature locally before returning (that&apos;s
            the <code>result.receipt.verified</code> field). For independent
            verification, hand the receipt id to anyone — no API key required.
          </p>
          <CodeBlock>
            {`import { verifyReceipt } from "@sovereign-matrix/agent-sdk";

// Standalone — no SovereignClient needed.
const r = await verifyReceipt(result.receipt.receiptId);

console.log("Verified:", r.verified); // true
console.log("Scheme:  ", r.scheme);    // "ed25519" | "hmac-sha256"`}
          </CodeBlock>
          <p className="text-[13px] text-neutral-500 leading-[1.6] mt-3">
            For visual forensics, paste the receipt id into{" "}
            <Link
              href="/auditor/replay"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /auditor/replay
            </Link>{" "}
            and see the canonical projection + signature recomputed against
            storage.
          </p>
        </Step>

        {/* Step 05 */}
        <Step n="05" title="Stream live events (optional)">
          <p className="text-[14px] text-neutral-400 leading-[1.6] mb-3">
            For long-running agents, use <code>streamAgent()</code> instead of{" "}
            <code>runAgent()</code>. Returns an async iterator; the final event
            carries the sealed receipt.
          </p>
          <CodeBlock>
            {`for await (const ev of sov.streamAgent("deep-research", { topic })) {
  if (ev.type === "delta") process.stdout.write(String(ev.data));
  if (ev.type === "complete") {
    console.log("\\n" + ev.receipt?.receiptId);
  }
}`}
          </CodeBlock>
        </Step>

        {/* What you just did — credibility seal */}
        <section className="my-16 px-6 py-5 border border-cyan-500/20 bg-cyan-500/[0.04] rounded-[3px]">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-3">
            <ShieldCheck className="w-3 h-3" /> What you just did
          </p>
          <ul className="text-[14px] text-neutral-400 leading-[1.7] space-y-1.5">
            <li>
              <span className="text-cyan-300">·</span> Invoked one of 140
              production agents through a typed SDK.
            </li>
            <li>
              <span className="text-cyan-300">·</span> Received a
              cryptographically-signed receipt (Ed25519 or HMAC-SHA256 depending
              on the platform deployment).
            </li>
            <li>
              <span className="text-cyan-300">·</span> Verified the signature
              locally with zero secrets — the SDK fetched the public Ed25519 key
              at <code>/.well-known/sovereign-receipts/ed25519.pem</code>.
            </li>
            <li>
              <span className="text-cyan-300">·</span> Produced an audit trail
              your regulator can re-derive from the bytes you hold.
            </li>
          </ul>
        </section>

        {/* Next steps */}
        <section className="mb-16">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-6">
            NEXT STEPS
          </h2>
          <div className="space-y-3">
            <NextLink
              href="/marketplace"
              title="Browse the 140 production agents"
              detail="Filter by industry, tier, output type. Every agent has the same SDK call shape."
            />
            <NextLink
              href="/docs"
              title="Full API reference"
              detail="Every endpoint, every type, every error case. Auto-generated from the OpenAPI 3.1 spec."
            />
            <NextLink
              href="/auditor/replay"
              title="Hand a receipt to your auditor"
              detail="Paste any receipt id, see the forensic reconstruction in 60 seconds."
            />
            <NextLink
              href="/sales"
              title="Talk to the founder"
              detail="Enterprise SSO, BYOK, 99.99% SLA, dedicated region — for buyers who need contract terms."
            />
          </div>
        </section>

        {/* Trouble */}
        <section className="border-t border-white/[0.06] pt-10">
          <h2 className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-4">
            TROUBLESHOOTING
          </h2>
          <ul className="text-[13px] text-neutral-400 leading-[1.7] space-y-2">
            <li>
              <span className="text-white">401 from runAgent:</span> the SDK
              couldn&apos;t resolve <code>SOVEREIGN_API_KEY</code>. Confirm the
              env var is set in the same shell session, or pass it explicitly
              via <code>new SovereignClient({"{ apiKey: '...' }"})</code>.
            </li>
            <li>
              <span className="text-white">verified: false:</span> the
              receipt&apos;s canonical projection doesn&apos;t match its stored
              signature. This is a hard-fail — never accept the output. Open an
              issue at <code>github.com/christiaan839-beep/sovereign-v2</code>.
            </li>
            <li>
              <span className="text-white">Stream stalls:</span> SSE streams
              idle-timeout at 5min on Vercel serverless. The SDK
              auto-reconnects; if you need longer-than-5min runs, use{" "}
              <code>runAgent()</code> (it blocks for up to 60s by default —
              override via{" "}
              <code>{"new SovereignClient({ timeoutMs: 300_000 })"}</code>).
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="font-mono text-[10px] text-[#E08558] tracking-[0.2em]">
          STEP {n}
        </span>
        <h2 className="font-serif text-2xl text-white tracking-[-0.01em]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-black/40 border border-white/[0.06] rounded-[3px] p-4 overflow-x-auto text-[12px] text-neutral-200 font-mono leading-[1.6]">
      <Terminal className="inline w-3 h-3 text-cyan-300 mr-2 -mt-0.5" />
      <code>{children}</code>
    </pre>
  );
}

function NextLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-4 p-4 border border-white/[0.06] rounded-[3px] bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/[0.12] transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-white mb-0.5 flex items-center gap-2">
          <KeyRound className="w-3 h-3 text-cyan-300" />
          {title}
        </p>
        <p className="text-[12px] text-neutral-500 leading-[1.55]">{detail}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-cyan-300 transition-colors mt-1 shrink-0" />
    </Link>
  );
}
