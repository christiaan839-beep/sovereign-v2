"use client";

/**
 * /badge — public verification-badge builder.
 *
 * The distribution lever for the verifiable-receipts moat: any visitor
 * with a receipt ID can configure the embed snippet, preview it live
 * against the real /embed/verify.js script, and copy the HTML to drop
 * on their site. Every install puts a "Sovereign Verified" badge
 * (link-back optional but on by default) into the open web.
 *
 * No auth. No signup. The visitor is the one who already has a
 * receipt — typically a customer who just published a public/unlisted
 * run from the dashboard and wants the badge for their landing page.
 *
 * The preview uses the same /embed/verify.js the customer would
 * paste — so what they see here is bit-identical to what their
 * visitors will see. Re-renders the badge on every config change by
 * remounting the script with a fresh React key (the script attaches
 * its DOM at the script tag's location, so a remount = a fresh
 * render).
 *
 * Cyan accent per the dual-accent brand rule (audit/infrastructure
 * surface — not a sales page).
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Copy,
  Check,
  Sun,
  Moon,
  ExternalLink,
  Code2,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";

type Theme = "dark" | "light";
type LinkMode = "show" | "hide";

const DEMO_ID = "demo-paste-your-receipt-id-here";

// Read ?id=<receipt> off window.location once at first render — lets
// callers deep-link the builder pre-filled (the dashboard receipts
// page wires this through). Sanitized to alphanumerics + dashes so a
// malicious `?id=` can't smuggle anything into the snippet.
function readIdFromUrl(): string {
  if (typeof window === "undefined") return "";
  const raw = new URLSearchParams(window.location.search).get("id") ?? "";
  return raw.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
}

export default function BadgePage() {
  const [receiptId, setReceiptId] = useState<string>(() => readIdFromUrl());
  const [theme, setTheme] = useState<Theme>("dark");
  const [linkMode, setLinkMode] = useState<LinkMode>("show");
  const [copied, setCopied] = useState(false);

  // Origin is captured in a useState initializer so it's resolved
  // once at first render — on the server it falls back to the
  // canonical host (snippet remains shareable pre-hydration); in the
  // browser it reflects the actual location.origin (preview deploys,
  // white-label domains, localhost). No effect needed, no setState
  // ping-pong.
  const [origin] = useState(() =>
    typeof window !== "undefined"
      ? window.location.origin
      : "https://sovereignmatrix.agency",
  );

  const effectiveId = receiptId.trim() || DEMO_ID;

  const snippet =
    `<script src="${origin}/embed/verify.js"\n` +
    `        data-receipt="${effectiveId}"\n` +
    `        data-theme="${theme}"\n` +
    `        data-link="${linkMode}"\n` +
    `        async></script>`;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent — the snippet is visible on screen anyway */
    }
  }, [snippet]);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* Cyan ambient glow */}
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
        <header className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
            <Shield className="h-3 w-3" />
            BADGE BUILDER · OPEN VERIFIER
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Drop one line. Verifiable AI.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            Configure your{" "}
            <span className="text-cyan-200">Sovereign Verified</span> badge
            below, preview against the live{" "}
            <code className="font-mono text-cyan-300">/embed/verify.js</code>{" "}
            script, and copy the HTML to drop on your site. No iframe, no
            third-party JS, ~2 KB.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: config */}
          <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
            <div className="border-b border-white/[0.04] bg-black/30 px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
              Configure
            </div>
            <div className="space-y-5 p-5">
              <Field
                label="Receipt ID"
                hint="A receipt id from /r/<id> — must be public or unlisted to verify in a visitor's browser."
              >
                <input
                  type="text"
                  value={receiptId}
                  onChange={(e) => setReceiptId(e.target.value)}
                  placeholder="paste your receipt id…"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-4 py-2.5 font-mono text-sm text-cyan-100 placeholder:text-neutral-600 focus:border-cyan-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                />
              </Field>

              <Field label="Theme">
                <div className="grid grid-cols-2 gap-2">
                  <ToggleButton
                    active={theme === "dark"}
                    onClick={() => setTheme("dark")}
                    icon={Moon}
                    label="Dark"
                  />
                  <ToggleButton
                    active={theme === "light"}
                    onClick={() => setTheme("light")}
                    icon={Sun}
                    label="Light"
                  />
                </div>
              </Field>

              <Field
                label="Link back"
                hint="Show the click-through link to the full receipt page."
              >
                <div className="grid grid-cols-2 gap-2">
                  <ToggleButton
                    active={linkMode === "show"}
                    onClick={() => setLinkMode("show")}
                    icon={Eye}
                    label="Show"
                  />
                  <ToggleButton
                    active={linkMode === "hide"}
                    onClick={() => setLinkMode("hide")}
                    icon={EyeOff}
                    label="Hide"
                  />
                </div>
              </Field>
            </div>
          </section>

          {/* Right: snippet + preview */}
          <section className="space-y-6">
            {/* Snippet */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/[0.04] bg-black/30 px-5 py-3">
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                  <Code2 className="h-3 w-3 text-cyan-300" />
                  Snippet
                </span>
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
                  aria-label="Copy snippet"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-300" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-relaxed text-cyan-100">
                {snippet}
              </pre>
            </div>

            {/* Preview */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
              <div className="border-b border-white/[0.04] bg-black/30 px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                Live preview
              </div>
              <div
                className={`flex items-center justify-center p-8 ${theme === "light" ? "bg-neutral-100" : "bg-black/30"}`}
              >
                {receiptId.trim() ? (
                  <BadgePreview
                    key={`${effectiveId}-${theme}-${linkMode}`}
                    receiptId={effectiveId}
                    theme={theme}
                    linkMode={linkMode}
                    origin={origin}
                  />
                ) : (
                  <div className="text-center text-xs text-neutral-500">
                    Paste a receipt id above to render a live preview here.
                    <br />
                    Or{" "}
                    <Link
                      href="/explorer"
                      className="text-cyan-300 underline-offset-2 hover:underline"
                    >
                      browse the public explorer
                    </Link>{" "}
                    to copy one.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl text-xs text-neutral-400 leading-relaxed">
          <p>
            <span className="font-mono text-cyan-300">/embed/verify.js</span>{" "}
            fetches{" "}
            <span className="font-mono text-neutral-300">
              /api/agent-runs/&lt;id&gt;
            </span>{" "}
            (open CORS for public/unlisted) and POSTs the canonical projection
            +&nbsp;signature back to{" "}
            <span className="font-mono text-neutral-300">/api/verify</span>.
            Verification runs in the visitor&apos;s browser — your site never
            holds our secret. On failure the badge renders in a{" "}
            <em>verification failed</em> state, never broken.
          </p>
          <p className="mt-3">
            <Link
              href="/spec"
              className="inline-flex items-center gap-1 text-cyan-300 underline-offset-2 hover:underline"
            >
              VAOS 1.0 specification
              <ExternalLink className="h-3 w-3" />
            </Link>{" "}
            ·{" "}
            <Link
              href="/explorer"
              className="inline-flex items-center gap-1 text-cyan-300 underline-offset-2 hover:underline"
            >
              Live receipt explorer
              <ArrowRight className="h-3 w-3" />
            </Link>{" "}
            ·{" "}
            <Link
              href="/verified"
              className="inline-flex items-center gap-1 text-cyan-300 underline-offset-2 hover:underline"
            >
              Why verifiable receipts matter
              <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-neutral-500">{hint}</p>}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Shield;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition ${
        active
          ? "border-cyan-500/40 bg-cyan-500/[0.08] text-cyan-200"
          : "border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:border-white/[0.12] hover:text-white"
      }`}
      aria-pressed={active}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function BadgePreview({
  receiptId,
  theme,
  linkMode,
  origin,
}: {
  receiptId: string;
  theme: Theme;
  linkMode: LinkMode;
  origin: string;
}) {
  // The verify.js script reads its own data-* attributes and injects
  // the badge inline. We mount a single <script> tag with the current
  // config; the parent uses a `key` keyed on the config so any change
  // remounts the tree (fresh script load = fresh badge render).
  //
  // dangerouslySetInnerHTML is safe here because the values flowing
  // into it are constrained: receiptId is sanitized to alphanumeric +
  // dashes inline below, theme/linkMode are typed unions, origin is
  // our own origin or the canonical host.
  const safeId = receiptId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeOrigin = origin.replace(/["'<>]/g, "");
  const script = `<script src="${safeOrigin}/embed/verify.js" data-receipt="${safeId}" data-theme="${theme}" data-link="${linkMode}" async></script>`;
  return (
    <div
      className="min-h-[60px] min-w-[200px] flex items-center justify-center"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
