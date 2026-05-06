"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Eye,
  PenSquare,
  Send,
} from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { parseLetterBody } from "@/lib/letters";

/**
 * /admin/letters/new — operator-only Friday Letter writer.
 *
 * Replaces the "edit src/lib/letters.ts + commit + Vercel deploy"
 * publish path with a real form that POSTs to
 * /api/_admin/publish-letter and shows up at /letters/[slug] within
 * 5 seconds (the path-revalidate window).
 *
 * Writer ergonomics:
 *   - Slug auto-derives from title until manually overridden
 *   - Date defaults to the next Friday
 *   - Preview renders the body live so the operator sees what
 *     readers will see — stops the "I forgot a `## ` heading" miss
 *   - Save Draft and Publish are separate actions; only the Publish
 *     path triggers the §06 Friday-only check on the server
 */

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; slug: string }
  | { kind: "error"; message: string };

function nextFridayISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  const daysToFri = (5 - dow + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysToFri);
  return d.toISOString().slice(0, 10);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export default function NewLetterPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [date, setDate] = useState(nextFridayISO());
  const [preview, setPreview] = useState("");
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const effectiveSlug = slugTouched ? slug : slugify(title);

  async function submit(status: "draft" | "published") {
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/_admin/publish-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: effectiveSlug,
          date,
          title,
          preview,
          body,
          status,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { slug: string };
        setState({ kind: "success", slug: data.slug });
        return;
      }
      if (res.status === 401) {
        setState({ kind: "error", message: "Sign in is required." });
        return;
      }
      if (res.status === 404) {
        setState({
          kind: "error",
          message: "Not authorised. Add your Clerk user id to ADMIN_USER_IDS.",
        });
        return;
      }
      if (res.status === 409) {
        setState({
          kind: "error",
          message: `Slug "${effectiveSlug}" already exists. Pick a different one.`,
        });
        return;
      }
      if (res.status === 422 || res.status === 503) {
        const data = (await res.json()) as {
          error?: string;
          issues?: { path: string[]; message: string }[];
        };
        setState({
          kind: "error",
          message:
            data.error ??
            (data.issues?.[0]
              ? `${data.issues[0].path.join(".")}: ${data.issues[0].message}`
              : "Validation failed"),
        });
        return;
      }
      setState({
        kind: "error",
        message: `Unexpected response: ${res.status}`,
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  if (!isLoaded) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      </Shell>
    );
  }

  if (!isSignedIn) {
    return (
      <Shell>
        <div className="py-32 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-6 text-2xl font-bold">Sign in required</h1>
          <Link
            href="/sign-in?redirect_url=/admin/letters/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Shell>
    );
  }

  if (state.kind === "success") {
    return (
      <Shell>
        <div className="py-20 max-w-xl">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-8">
            <Check className="h-6 w-6 text-emerald-400" />
            <h1 className="mt-5 text-2xl font-bold text-white">Letter saved</h1>
            <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
              Live at{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
                /letters/{state.slug}
              </code>
              . The /letters index has been re-validated; new readers see it
              within 5 seconds.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/letters/${state.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400 transition"
              >
                Open the letter &rarr;
              </Link>
              <Link
                href="/letters"
                className="rounded-full border border-white/10 px-5 py-2 text-sm text-neutral-300 hover:border-white/20 hover:text-white transition"
              >
                See archive
              </Link>
              <button
                type="button"
                onClick={() => {
                  setTitle("");
                  setSlug("");
                  setSlugTouched(false);
                  setPreview("");
                  setBody("");
                  setTab("write");
                  setState({ kind: "idle" });
                }}
                className="text-sm text-neutral-500 hover:text-neutral-300 ml-auto"
              >
                Write another
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="flex items-baseline justify-between gap-6 mb-8 flex-wrap">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-500/60">
            Admin · Friday Letter
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Write the next letter
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Four sections. Never longer than a page. Publish before 5pm Friday.
          </p>
        </div>
        <Link
          href="/letters"
          className="text-xs text-neutral-400 hover:text-neutral-100 transition"
        >
          See archive &rarr;
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* ── Left: write/preview pane ── */}
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="flex border-b border-white/5">
            <TabButton
              active={tab === "write"}
              onClick={() => setTab("write")}
              icon={PenSquare}
              label="Write"
            />
            <TabButton
              active={tab === "preview"}
              onClick={() => setTab("preview")}
              icon={Eye}
              label="Preview"
            />
          </div>
          <div className="p-6 min-h-[480px]">
            {tab === "write" ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={22}
                placeholder={`Body of the letter.\n\nSeparate paragraphs with blank lines.\n\n## What shipped this week\nUse \`## \` at the start of a line for headings.\n\n## What didn't ship\n\n## A customer story\n\n## What I learned\n\n— [Your sign-off]`}
                className="w-full h-full bg-transparent text-neutral-200 placeholder-neutral-600 outline-none font-mono text-sm leading-[1.7] resize-none"
              />
            ) : (
              <BodyPreview body={body} />
            )}
          </div>
          <div className="border-t border-white/5 px-6 py-3 flex items-center justify-between text-xs text-neutral-500">
            <span>
              {body.length.toLocaleString()} chars &middot;{" "}
              {body.split(/\s+/).filter(Boolean).length.toLocaleString()} words
            </span>
            <span>## headings: {(body.match(/^##\s/gm) ?? []).length}</span>
          </div>
        </div>

        {/* ── Right: metadata + publish ── */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 space-y-5">
            <Field label="Title">
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Letter #N — A short evocative title"
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-emerald-500/60"
              />
            </Field>

            <Field
              label="Slug"
              hint="URL path. Auto-derived from the title; click to override."
            >
              <input
                type="text"
                required
                value={effectiveSlug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                onFocus={() => {
                  if (!slugTouched) setSlug(slugify(title));
                  setSlugTouched(true);
                }}
                placeholder="letter-002-some-slug"
                pattern="[a-z0-9-]+"
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm font-mono text-neutral-200 outline-none focus:border-emerald-500/60"
              />
            </Field>

            <Field
              label="Date"
              hint="Must be a Friday for published letters (STANDARDS.md §06)."
            >
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-emerald-500/60"
              />
            </Field>

            <Field
              label="Preview"
              hint="2–3 sentences shown on the index list."
            >
              <textarea
                required
                maxLength={500}
                rows={3}
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
                placeholder="The hook — what's this letter about, in 2 sentences?"
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-emerald-500/60 resize-none"
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-4">
              Publish
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={
                  state.kind === "submitting" ||
                  !title ||
                  !preview ||
                  body.length < 50
                }
                onClick={() => submit("published")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 transition"
              >
                {state.kind === "submitting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publish letter
              </button>
              <button
                type="button"
                disabled={
                  state.kind === "submitting" || !title || body.length < 50
                }
                onClick={() => submit("draft")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm text-neutral-300 hover:border-white/20 hover:text-white disabled:opacity-50 transition"
              >
                Save as draft
              </button>
            </div>
            <p className="mt-3 text-[11px] text-neutral-600 leading-relaxed">
              Published letters appear at{" "}
              <code className="text-neutral-500">/letters</code> within 5
              seconds. Drafts stay invisible to readers.
            </p>
          </div>

          <AnimatePresence>
            {state.kind === "error" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4 flex items-start gap-3"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">{state.message}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Shell>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <div className="flex items-center gap-5 text-xs">
            <Link
              href="/admin/customers"
              className="text-neutral-400 hover:text-neutral-100"
            >
              Customers
            </Link>
            <Link
              href="/admin/onboard"
              className="text-neutral-400 hover:text-neutral-100"
            >
              Onboard
            </Link>
            <span className="text-neutral-500">New letter</span>
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-6 py-12">{children}</div>
    </main>
  );
}

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
    <label className="block">
      <span className="text-sm font-medium text-neutral-200">{label}</span>
      {hint && (
        <span className="block mt-0.5 text-[11px] text-neutral-500 leading-relaxed">
          {hint}
        </span>
      )}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof PenSquare;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 text-xs font-medium border-b-2 transition ${
        active
          ? "border-emerald-400 text-white bg-emerald-500/[0.04]"
          : "border-transparent text-neutral-500 hover:text-neutral-300"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function BodyPreview({ body }: { body: string }) {
  if (!body.trim()) {
    return (
      <p className="text-sm text-neutral-600 italic">
        Body is empty. Switch to Write to start.
      </p>
    );
  }
  const blocks = parseLetterBody(body);
  return (
    <div className="space-y-4 text-[15px] leading-[1.75] text-neutral-300 max-w-prose">
      {blocks.map((block, i) =>
        block.kind === "heading" ? (
          <h2 key={i} className="mt-8 text-base font-semibold text-white">
            {block.text}
          </h2>
        ) : (
          <p key={i}>{block.text}</p>
        ),
      )}
    </div>
  );
}
