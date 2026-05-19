import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Get started — 3 lines around your AI call · Sovereign Matrix",
  description:
    "Add cryptographic receipts to your AI calls in 3 lines. Works with OpenAI, Anthropic, Google Gemini, and Vercel AI SDK. Apache 2.0.",
};

const PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    npm: "@sovereign-matrix/openai-receipts",
    install:
      "npm install @sovereign-matrix/openai-receipts @sovereign-matrix/verifiable-receipts openai",
    code: `import OpenAI from "openai";
import { mintCompletionReceipt } from "@sovereign-matrix/openai-receipts";
import { sign as ed25519Sign } from "node:crypto";

const client = new OpenAI();

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Summarize this contract..." }],
});

// ← The only added line:
const receipt = await mintCompletionReceipt(completion, {
  sign: (canonical) =>
    "v2=" +
    ed25519Sign(null, Buffer.from(canonical), privateKey).toString("base64"),
  agentSlug: "contract-summarizer",
  runId: crypto.randomUUID(),
});

console.log(receipt.signature);  // v2=<base64> — verifiable forever
console.log(receipt.overall);    // "pass"`,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    npm: "@sovereign-matrix/anthropic-receipts",
    install:
      "npm install @sovereign-matrix/anthropic-receipts @sovereign-matrix/verifiable-receipts @anthropic-ai/sdk",
    code: `import Anthropic from "@anthropic-ai/sdk";
import { mintMessageReceipt } from "@sovereign-matrix/anthropic-receipts";
import { sign as ed25519Sign } from "node:crypto";

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Summarize this contract..." }],
});

// ← The only added line:
const receipt = await mintMessageReceipt(message, {
  sign: (canonical) =>
    "v2=" +
    ed25519Sign(null, Buffer.from(canonical), privateKey).toString("base64"),
  agentSlug: "contract-summarizer",
  runId: crypto.randomUUID(),
});`,
  },
  {
    id: "google",
    label: "Google Gemini",
    npm: "@sovereign-matrix/google-receipts",
    install:
      "npm install @sovereign-matrix/google-receipts @sovereign-matrix/verifiable-receipts @google/generative-ai",
    code: `import { GoogleGenerativeAI } from "@google/generative-ai";
import { mintGenerationReceipt } from "@sovereign-matrix/google-receipts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

const result = await model.generateContent("Summarize this contract...");

// ← The only added line:
const receipt = await mintGenerationReceipt(result, {
  sign,
  agentSlug: "contract-summarizer",
  runId: crypto.randomUUID(),
});`,
  },
  {
    id: "ai-sdk",
    label: "Vercel AI SDK (universal)",
    npm: "@sovereign-matrix/ai-sdk-receipts",
    install:
      "npm install @sovereign-matrix/ai-sdk-receipts @sovereign-matrix/verifiable-receipts ai",
    code: `import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { mintTextReceipt } from "@sovereign-matrix/ai-sdk-receipts";

const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Summarize this contract...",
});

// ← The only added line:
const receipt = await mintTextReceipt(result, {
  sign,
  agentSlug: "contract-summarizer",
  runId: crypto.randomUUID(),
});`,
  },
];

export default function StartPage() {
  return (
    <div className="relative min-h-dvh bg-[#030303] text-white antialiased">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-30"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 0%, rgba(181,83,44,0.18) 0%, transparent 70%)",
        }}
      />

      <main className="relative max-w-5xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <div className="mb-12">
          <Link
            href="/"
            className="text-[12px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors tracking-tight"
          >
            ← Sovereign Matrix
          </Link>
        </div>

        <div className="max-w-3xl">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-5">
            Get started · Apache 2.0
          </p>
          <h1 className="font-serif text-5xl md:text-6xl leading-[1.04] tracking-[-0.02em] mb-6">
            Three lines around
            <br />
            <em className="not-italic text-[#B5532C]">your AI call.</em>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] mb-3">
            Add cryptographically-signed VAOS receipts to every model call you
            ship. Works with OpenAI, Anthropic, Google Gemini, and any provider
            plugged into the Vercel AI SDK.
          </p>
          <p className="text-[14px] text-neutral-500 leading-relaxed">
            Zero infrastructure to deploy. Zero account to sign up for. The
            receipt travels with the call.
          </p>
        </div>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            1. Generate a signing key
          </h2>
          <p className="text-[14px] text-neutral-500 leading-relaxed mb-6 max-w-2xl">
            Ed25519 keys are 32 bytes. Generate one with Node&apos;s built-in
            crypto module — no external CA needed.
          </p>
          <div className="rounded-[6px] border border-cyan-500/20 bg-black/40 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.05]">
              <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                generate-key.mjs
              </p>
            </div>
            <pre className="px-5 py-4 overflow-x-auto font-mono text-[12px] leading-[1.6] text-cyan-300/95">
              {`import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");

writeFileSync("privkey.pem", privateKey.export({ type: "pkcs8", format: "pem" }));
writeFileSync("pubkey.pem", publicKey.export({ type: "spki", format: "pem" }));

console.log("Keys saved. Keep privkey.pem secret. Publish pubkey.pem.");`}
            </pre>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            2. Pick your provider
          </h2>
          <p className="text-[14px] text-neutral-500 leading-relaxed mb-6 max-w-2xl">
            Four packages, one shape. Pick the one matching your AI provider.
          </p>

          <div className="space-y-12">
            {PROVIDERS.map((p) => (
              <div key={p.id}>
                <div className="flex items-baseline gap-3 mb-3 flex-wrap">
                  <h3 className="font-serif text-[26px] tracking-tight">
                    {p.label}
                  </h3>
                  <code className="text-[11px] font-mono text-cyan-300/80">
                    {p.npm}
                  </code>
                </div>
                <div className="rounded-[6px] border border-white/[0.06] bg-black/40 overflow-hidden mb-3">
                  <div className="px-5 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                      Install
                    </p>
                  </div>
                  <pre className="px-5 py-3 overflow-x-auto font-mono text-[12px] leading-[1.6] text-cyan-300/80">
                    {p.install}
                  </pre>
                </div>
                <div className="rounded-[6px] border border-white/[0.06] bg-black/40 overflow-hidden">
                  <div className="px-5 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                      Use
                    </p>
                  </div>
                  <pre className="px-5 py-4 overflow-x-auto font-mono text-[11px] leading-[1.55] text-neutral-300 whitespace-pre">
                    {p.code}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            3. Generate a regulatory report
          </h2>
          <p className="text-[14px] text-neutral-500 leading-relaxed mb-6 max-w-2xl">
            Collect 90 days of receipts. Feed them into any of the six framework
            exporters.
          </p>
          <div className="rounded-[6px] border border-white/[0.06] bg-black/40 overflow-hidden">
            <div className="px-5 py-2.5 border-b border-white/[0.05]">
              <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                generate-annex-iv.mjs
              </p>
            </div>
            <pre className="px-5 py-4 overflow-x-auto font-mono text-[11px] leading-[1.55] text-neutral-300 whitespace-pre">
              {`import { buildAnnexIv, toMarkdown, toJSON } from "@sovereign-matrix/annex-iv";
import { readFileSync, writeFileSync } from "node:fs";

const receipts = JSON.parse(readFileSync("./receipts/q2-2026.json", "utf-8"));

const report = buildAnnexIv({
  system: {
    name: "Acme Loan Underwriting AI",
    identifier: "acme-loan-2026",
    riskCategory: "high-risk",
    provider: "Acme Financial AI Ltd",
    authorisedRepresentativeEU: "Acme EU GmbH",
    intendedPurpose: "Automated decisioning for consumer loans EUR 1k-50k.",
    annexIIIUseCase: "creditworthiness assessment",
    placedOnMarketAt: "2026-01-15T00:00:00Z",
  },
  receipts,
  sampleBlockedReceipts: 5,
  nextReportDue: "2026-08-15T00:00:00Z",
  operatorActions: ["Tightened SR 11-7 model risk gate (2026-04-12)."],
});

writeFileSync("./annex-iv-q2-2026.md", toMarkdown(report));
writeFileSync("./annex-iv-q2-2026.json", toJSON(report));

console.log("Report shipped. Byte-deterministic — your auditor can re-derive these numbers.");`}
            </pre>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            4. (Optional) Wire into Claude Code
          </h2>
          <p className="text-[14px] text-neutral-500 leading-relaxed mb-6 max-w-2xl">
            Let Claude generate compliance reports from inside your editor.
          </p>
          <div className="rounded-[6px] border border-white/[0.06] bg-black/40 overflow-hidden">
            <div className="px-5 py-2.5 border-b border-white/[0.05]">
              <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                ~/Library/Application Support/Claude/claude_desktop_config.json
              </p>
            </div>
            <pre className="px-5 py-4 overflow-x-auto font-mono text-[12px] leading-[1.6] text-cyan-300/95">
              {`{
  "mcpServers": {
    "sovereign-matrix": {
      "command": "npx",
      "args": ["-y", "@sovereign-matrix/mcp"]
    }
  }
}`}
            </pre>
          </div>
          <p className="text-[13px] text-neutral-500 mt-3 max-w-2xl">
            Restart Claude. 7 tools appear:{" "}
            <code className="text-cyan-300/80">verify_receipt</code>,{" "}
            <code className="text-cyan-300/80">build_annex_iv</code>,{" "}
            <code className="text-cyan-300/80">build_iso_42001</code>,{" "}
            <code className="text-cyan-300/80">build_nist_ai_rmf</code>,{" "}
            <code className="text-cyan-300/80">build_soc2_evidence</code>,{" "}
            <code className="text-cyan-300/80">build_gdpr_dpia</code>,{" "}
            <code className="text-cyan-300/80">build_hipaa_security</code>.
          </p>
        </section>

        <section className="mt-16 grid md:grid-cols-2 gap-5">
          <div className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400 mb-3">
              Verify a receipt later
            </p>
            <p className="text-[13px] text-neutral-400 leading-relaxed mb-4">
              The receipt is a signed envelope. Verify with the public key any
              time — six months, six years, six decades.
            </p>
            <pre className="px-3 py-2 bg-black/40 rounded-[3px] overflow-x-auto font-mono text-[11px] text-cyan-300/90">
              {`npx @sovereign-matrix/verifiable-receipts verify \\\n  --manifest ./bundle.json \\\n  --pubkey ./pubkey.pem`}
            </pre>
          </div>
          <div className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400 mb-3">
              Run an independent witness
            </p>
            <p className="text-[13px] text-neutral-400 leading-relaxed mb-4">
              Don&apos;t trust Sovereign Matrix as the only attester. Run your
              own witness on our transparency log.
            </p>
            <pre className="px-3 py-2 bg-black/40 rounded-[3px] overflow-x-auto font-mono text-[11px] text-cyan-300/90">
              {`npx @sovereign-matrix/verifiable-receipts-witness \\\n  --url https://sovereignmatrix.agency \\\n  --key ./witness.pem`}
            </pre>
          </div>
        </section>

        <section className="mt-16 mb-8 rounded-[10px] border border-[#B5532C]/20 bg-[#1a0f0a]/40 px-6 md:px-10 py-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#B5532C] mb-4">
            Already running?
          </p>
          <h3 className="font-serif text-3xl mb-4 tracking-tight max-w-3xl">
            Skip running your own pipeline.
            <br />
            <em className="not-italic text-[#B5532C]">
              Let us mint + anchor + audit for you.
            </em>
          </h3>
          <p className="text-[14px] text-neutral-400 leading-relaxed mb-6 max-w-2xl">
            Sovereign Matrix runs the receipt pipeline + anchor + monthly
            regulatory-export delivery as a managed service. Free tier: 50
            verified runs / month.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#B5532C] text-white font-semibold text-[13px] rounded-[3px] hover:bg-[#C96234] transition-colors tracking-tight"
            >
              Start free
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/compliance"
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/[0.12] text-neutral-300 font-mono text-[13px] rounded-[3px] hover:text-white hover:border-white/25 transition-colors"
            >
              See all 6 exporters
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-3 text-neutral-500 hover:text-white font-mono text-[13px] transition-colors"
            >
              Pricing →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
