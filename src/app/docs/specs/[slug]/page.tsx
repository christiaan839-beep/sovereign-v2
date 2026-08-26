/**
 * /docs/specs/[slug] — the specification texts, served.
 *
 * Why this route exists: six pages linked to /docs/specs/* and the route
 * did not exist, so every one of those links 404'd. The worst of them was
 * on /trust, directly under the sentence "Hand a procurement team the
 * links — they don't have to take our word for any of it." The links were
 * the proof, and they resolved to nothing.
 *
 * The specs themselves were never missing — all nine markdown files sit in
 * docs/specs/ and run to roughly 2,800 lines, including two IETF-style
 * drafts. Nothing was written to fix this; the texts are simply rendered
 * at the addresses that were already being advertised.
 *
 * Read at build time via generateStaticParams, so the route is fully
 * static and there is no filesystem access at request time.
 *
 * Brand: cyan — this is an audit / infrastructure surface, per
 * docs/design-system/brand-colors.md.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, FileText } from "lucide-react";

const SPECS_DIR = join(process.cwd(), "docs", "specs");

function slugs(): string[] {
  return readdirSync(SPECS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

/**
 * Read one spec. Returns null rather than throwing so an unknown slug
 * becomes a 404 instead of a 500 — a mistyped link is an expected input
 * for this route.
 */
function readSpec(slug: string): { title: string; body: string } | null {
  // Reject anything that is not a bare slug before it reaches the
  // filesystem: this path is user-controlled.
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(slug) || slug.includes("..")) return null;
  if (!slugs().includes(slug)) return null;

  let raw: string;
  try {
    raw = readFileSync(join(SPECS_DIR, `${slug}.md`), "utf8");
  } catch {
    return null;
  }
  // Strip YAML frontmatter if present — one of the drafts carries it.
  const body = raw.startsWith("---") ? raw.replace(/^---\n[\s\S]*?\n---\n/, "") : raw;
  const heading = body.match(/^#\s+(.+)$/m);
  return { title: heading?.[1]?.trim() ?? slug, body };
}

export function generateStaticParams() {
  return slugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const spec = readSpec(slug);
  if (!spec) return { title: "Spec not found — Sovereign Matrix" };
  return {
    title: `${spec.title} | Sovereign Matrix`,
    description: `${spec.title} — the specification text, in full.`,
    openGraph: { title: spec.title, type: "article" },
  };
}

export default async function SpecPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const spec = readSpec(slug);
  if (!spec) notFound();

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/docs/specs"
          className="mb-10 inline-flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-cyan-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All specifications
        </Link>

        <div className="mb-8 flex items-center gap-3 border-b border-white/10 pb-6">
          <FileText className="h-5 w-5 shrink-0 text-cyan-400" aria-hidden="true" />
          <span className="font-mono text-xs tracking-wide text-neutral-500">
            docs/specs/{slug}.md
          </span>
        </div>

        <article className="spec-prose">
          <ReactMarkdown
            components={{
              h1: (p) => (
                <h1 className="mb-6 text-3xl font-semibold tracking-tight text-white" {...p} />
              ),
              h2: (p) => (
                <h2
                  className="mt-12 mb-4 border-b border-white/10 pb-2 text-xl font-semibold text-white"
                  {...p}
                />
              ),
              h3: (p) => <h3 className="mt-8 mb-3 text-lg font-semibold text-cyan-300" {...p} />,
              p: (p) => <p className="my-4 leading-relaxed text-neutral-300" {...p} />,
              ul: (p) => <ul className="my-4 list-disc space-y-2 pl-6 text-neutral-300" {...p} />,
              ol: (p) => <ol className="my-4 list-decimal space-y-2 pl-6 text-neutral-300" {...p} />,
              a: ({ href, ...p }) => (
                <a
                  href={href}
                  className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
                  {...p}
                />
              ),
              code: (p) => (
                <code
                  className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan-300"
                  {...p}
                />
              ),
              pre: (p) => (
                // Wide blocks scroll inside their own container so the page
                // body never scrolls horizontally on a phone.
                <pre
                  className="my-6 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm"
                  {...p}
                />
              ),
              blockquote: (p) => (
                <blockquote
                  className="my-6 border-l-2 border-cyan-500/40 pl-4 text-neutral-400 italic"
                  {...p}
                />
              ),
              table: (p) => (
                <div className="my-6 overflow-x-auto">
                  <table className="w-full border-collapse text-sm" {...p} />
                </div>
              ),
              th: (p) => (
                <th
                  className="border border-white/10 bg-white/[0.03] px-3 py-2 text-left font-semibold text-neutral-200"
                  {...p}
                />
              ),
              td: (p) => (
                <td className="border border-white/10 px-3 py-2 text-neutral-300" {...p} />
              ),
              hr: () => <hr className="my-10 border-white/10" />,
            }}
          >
            {spec.body}
          </ReactMarkdown>
        </article>

        <div className="mt-16 border-t border-white/10 pt-6 text-sm text-neutral-500">
          Rendered verbatim from{" "}
          <code className="font-mono text-neutral-400">docs/specs/{slug}.md</code> in the
          repository. The file is the specification; this page adds no interpretation.
        </div>
      </div>
    </main>
  );
}
