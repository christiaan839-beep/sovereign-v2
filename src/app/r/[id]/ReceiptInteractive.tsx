"use client";

/**
 * Client-side interactivity layer for /r/[id] — auto-verify on mount,
 * share widget, local-verify code panel.
 *
 * The page itself is server-rendered (SEO + zero-JS readability). This
 * component layers in three behaviors that only make sense on the
 * client:
 *
 *   1. <VerifyBadge /> — fetches /api/verify on mount and animates the
 *      result. The visitor sees the signature being checked in front
 *      of them. Same endpoint a compliance auditor would hit; same
 *      response shape. No simulation.
 *
 *   2. <ShareWidget /> — one-click copy of the permanent URL plus a
 *      pre-filled Twitter share intent. The receipt URL is the moat;
 *      we want it shared.
 *
 *   3. <LocalVerifyPanel /> — drops a copy-pasteable JavaScript snippet
 *      a visitor can paste into their devtools to verify the signature
 *      against /api/verify without trusting this page. Demonstrates
 *      the open-CORS contract.
 *
 * All three components are progressive enhancements: the server-
 * rendered receipt is fully readable + printable without JS. These
 * just sharpen the audit narrative when JS is available.
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Twitter,
  Code2,
  Share2,
  ExternalLink,
} from "lucide-react";

interface Props {
  receiptId: string;
  publicUrl: string;
  canonical: string;
  signature: string;
  agentName: string;
}

type VerifyState = "pending" | "verifying" | "valid" | "invalid" | "error";

export function ReceiptInteractive({
  receiptId,
  publicUrl,
  canonical,
  signature,
  agentName,
}: Props) {
  return (
    <>
      <VerifyBadge canonical={canonical} signature={signature} />
      <ShareWidget
        publicUrl={publicUrl}
        agentName={agentName}
        receiptId={receiptId}
      />
      <LocalVerifyPanel publicUrl={publicUrl} receiptId={receiptId} />
    </>
  );
}

/* ─── VerifyBadge ────────────────────────────────────────────────── */

function VerifyBadge({
  canonical,
  signature,
}: {
  canonical: string;
  signature: string;
}) {
  const [state, setState] = useState<VerifyState>("pending");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const runVerify = useCallback(async () => {
    setState("verifying");
    setElapsedMs(null);
    const start = performance.now();
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical, signature }),
      });
      const data = (await res.json()) as { valid?: boolean };
      const end = performance.now();
      setElapsedMs(Math.round(end - start));
      setState(data?.valid ? "valid" : "invalid");
    } catch {
      setState("error");
      setElapsedMs(Math.round(performance.now() - start));
    }
  }, [canonical, signature]);

  // Auto-verify once on mount. A short stagger lets the page paint
  // before the network call kicks in so the visitor sees the badge
  // transition from "pending" → "verifying" → result.
  useEffect(() => {
    const t = setTimeout(runVerify, 350);
    return () => clearTimeout(t);
  }, [runVerify]);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.05] to-transparent p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-4">
        <BadgeIcon state={state} />
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-sm font-semibold text-white">
            {state === "pending" && "Preparing verification…"}
            {state === "verifying" && "Verifying signature live"}
            {state === "valid" && "Signature verified"}
            {state === "invalid" && "Signature does NOT match"}
            {state === "error" && "Verifier unreachable"}
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-neutral-400">
            POST /api/verify {elapsedMs !== null && `· ${elapsedMs}ms`}
            {state === "valid" && " · HMAC-SHA256 over canonical projection"}
          </p>
        </div>
        <button
          onClick={runVerify}
          disabled={state === "verifying"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state === "verifying" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          Verify again
        </button>
      </div>

      <AnimatePresence>
        {state === "invalid" && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.08] p-3 text-xs text-rose-200"
          >
            The HMAC over the canonical projection does not match the signature
            on this page. Possible causes: the receipt was edited after it was
            issued, the signing secret has rotated, or this URL is being served
            by an impostor.
          </motion.p>
        )}
        {state === "error" && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs text-amber-200"
          >
            Network call to /api/verify failed. Click &quot;Verify again&quot;
            or paste the canonical + signature into the JavaScript snippet below
            to verify in your own browser.
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

function BadgeIcon({ state }: { state: VerifyState }) {
  if (state === "verifying" || state === "pending") {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10"
        aria-label="Verifying"
      >
        <Loader2 className="h-4 w-4 animate-spin text-cyan-200" />
      </span>
    );
  }
  if (state === "valid") {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/15 shadow-[0_0_22px_rgba(16,185,129,0.25)]"
        aria-label="Verified"
      >
        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
      </span>
    );
  }
  if (state === "invalid") {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-500/50 bg-rose-500/15"
        aria-label="Invalid"
      >
        <XCircle className="h-5 w-5 text-rose-300" />
      </span>
    );
  }
  // error
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10"
      aria-label="Verifier unreachable"
    >
      <XCircle className="h-5 w-5 text-amber-300" />
    </span>
  );
}

/* ─── ShareWidget ────────────────────────────────────────────────── */

function ShareWidget({
  publicUrl,
  agentName,
  receiptId,
}: {
  publicUrl: string;
  agentName: string;
  receiptId: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Some browsers reject clipboard outside user gesture in iframes —
      // fall through silently; the URL is visible on screen anyway.
    }
  }, [publicUrl]);

  const tweetText = encodeURIComponent(
    `Verifiable agent receipt for ${agentName} — cryptographically signed, anyone can verify against the public /api/verify endpoint.\n\n${publicUrl}`,
  );

  return (
    <section className="no-print mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-xl">
      <Share2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
      <span className="text-xs text-neutral-400">
        Share this proof
        <span className="hidden sm:inline">
          {" "}
          · receipt #{receiptId.slice(0, 8)}
        </span>
      </span>
      <div className="flex-1" />
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
        aria-label="Copy receipt URL"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-300" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${tweetText}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
      >
        <Twitter className="h-3 w-3" />
        Tweet
      </a>
    </section>
  );
}

/* ─── LocalVerifyPanel ───────────────────────────────────────────── */

function LocalVerifyPanel({
  publicUrl,
  receiptId,
}: {
  publicUrl: string;
  receiptId: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pull the host off the public URL so the snippet works whether the
  // page is served from sovereignmatrix.agency, a preview deploy, or a
  // white-label domain. Falls back to the absolute path if URL parsing
  // ever throws.
  let origin = "";
  try {
    origin = new URL(publicUrl).origin;
  } catch {
    origin = "";
  }

  const snippet =
    `// Paste this into devtools on any page.\n` +
    `// Verifies the receipt against ${origin || "the issuer"}'s public /api/verify\n` +
    `const r = await fetch("${origin}/api/agent-runs/${receiptId}").then(r => r.json());\n` +
    `const v = await fetch("${origin}/api/verify", {\n` +
    `  method: "POST",\n` +
    `  headers: { "Content-Type": "application/json" },\n` +
    `  body: JSON.stringify({ canonical: r.canonical, signature: r.signature })\n` +
    `}).then(r => r.json());\n` +
    `console.log(v.valid ? "✓ verified" : "✗ INVALID");`;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent */
    }
  }, [snippet]);

  return (
    <section className="no-print mb-6 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[0.02]"
        aria-expanded={open}
      >
        <Code2 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
        <span className="text-sm font-medium text-white">
          Verify this in your own browser
        </span>
        <span className="text-xs text-neutral-500">
          7-line JavaScript snippet · no signup
        </span>
        <div className="flex-1" />
        <span
          className={`text-xs text-neutral-500 transition ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          ▸
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.04] p-5">
              <p className="mb-3 text-xs text-neutral-400">
                Open devtools (
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-neutral-200">
                  Cmd
                </kbd>{" "}
                +{" "}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-neutral-200">
                  Opt
                </kbd>{" "}
                +{" "}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-neutral-200">
                  J
                </kbd>
                ), paste, hit enter. The browser fetches the receipt, POSTs the
                canonical + signature back to /api/verify, and logs the boolean.
                You&apos;re trusting your own browser — not this page.
              </p>
              <div className="relative">
                <pre className="overflow-x-auto rounded-xl border border-white/[0.04] bg-black/50 p-4 font-mono text-[12px] leading-relaxed text-cyan-100">
                  {snippet}
                </pre>
                <button
                  onClick={copy}
                  className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
                  aria-label="Copy verification snippet"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-300" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-3 text-[11px] text-neutral-500">
                Or use the{" "}
                <code className="text-neutral-400">vaos-verifier</code> npm
                package for a typed Node/Bun verifier with no runtime deps. See{" "}
                <a
                  href="/spec"
                  className="text-cyan-300 underline-offset-2 hover:underline"
                >
                  /spec
                </a>{" "}
                <ExternalLink className="inline h-2.5 w-2.5" />.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
