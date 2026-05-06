import Link from "next/link";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

/**
 * /standards — the public-facing version of STANDARDS.md.
 *
 * Why this page exists. Every B2B SaaS landing page has a "values"
 * block that nobody reads. STANDARDS.md is different: it's the
 * internal contract, with measurement, ownership, and a customer
 * remedy spelled out for each bar. Surfacing it publicly turns
 * those bars into something a prospect can hold us to before
 * signing — and something a future hire can decide whether they
 * want to join.
 *
 * Implementation: read STANDARDS.md from disk at request time,
 * parse the section headings into nav anchors, render plain Markdown
 * with our brand styling. Cached 5 minutes via Next.js ISR — the
 * file changes only when the founder edits it, and a Vercel deploy
 * busts the cache anyway.
 *
 * Privacy: no per-customer data on this page. Pure marketing /
 * trust artifact. Indexed by search engines (no robots block).
 */

export const revalidate = 300;

export const metadata = {
  title: "Standards · Sovereign Matrix",
  description:
    "The bars Sovereign Matrix holds itself to — measurable, owned, " +
    "with a customer remedy when we miss. Not marketing claims.",
  openGraph: {
    title: "Sovereign Matrix — Standards",
    description: "Every commitment with a remedy, an owner, and a measurement.",
    images: [
      {
        url: "/api/og?title=Standards&subtitle=The+bars+we+hold+ourselves+to",
        width: 1200,
        height: 630,
      },
    ],
  },
};

interface ParsedSection {
  /** "01 — Every lead is hand-reviewed before it ships" */
  heading: string;
  /** Slug for in-page nav. */
  slug: string;
  /** Raw Markdown body of the section, excluding the heading line. */
  body: string;
}

interface ParsedStandards {
  preamble: string;
  sections: ParsedSection[];
  postamble: string | null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Parse STANDARDS.md into a preamble + numbered sections + optional
 * postamble. Sections are detected by `## NN — title` headings; we
 * deliberately don't run a full Markdown parser because our authoring
 * style is constrained and a 30-line splitter is more debuggable than
 * a 30 KB dependency.
 */
function parseStandards(raw: string): ParsedStandards {
  const lines = raw.split("\n");
  const sectionRegex = /^## (\d+) — (.+)$/;
  const sections: ParsedSection[] = [];
  let preambleLines: string[] = [];
  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  function flush() {
    if (currentHeading) {
      sections.push({
        heading: currentHeading,
        slug: slugify(currentHeading),
        body: currentBody.join("\n").trim(),
      });
    }
  }

  for (const line of lines) {
    const m = line.match(sectionRegex);
    if (m) {
      flush();
      currentHeading = `${m[1]} — ${m[2]}`;
      currentBody = [];
    } else if (currentHeading === null) {
      preambleLines.push(line);
    } else {
      currentBody.push(line);
    }
  }
  flush();

  // Treat anything after the last numbered section as postamble (the
  // "When does a standard retire" closer in the source file).
  let postamble: string | null = null;
  if (sections.length > 0) {
    const lastBody = sections[sections.length - 1].body;
    const splitOnRule = lastBody.split(/\n---+\s*\n/);
    if (splitOnRule.length > 1) {
      sections[sections.length - 1].body = splitOnRule[0].trim();
      postamble = splitOnRule.slice(1).join("\n---\n").trim();
    }
  }

  // Strip the duplicate "## When does a standard retire" preamble
  // separator that's used purely for visual breaks.
  preambleLines = preambleLines.filter((l) => l.trim() !== "---");

  return {
    preamble: preambleLines.join("\n").trim(),
    sections,
    postamble,
  };
}

/**
 * Tiny inline-Markdown renderer covering the primitives STANDARDS.md
 * actually uses: **bold**, paragraphs, and bullet lists. Anything
 * fancier than this we can adopt `react-markdown` for — but the
 * source file is constrained-format on purpose.
 */
function renderInlineMd(text: string): React.ReactNode {
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = boldRegex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    parts.push(
      <strong key={`b-${m.index}`} className="font-semibold text-white">
        {m[1]}
      </strong>,
    );
    lastIndex = boldRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  // Split on blank lines into paragraph-or-list blocks. Each block
  // is rendered as a paragraph or a bulleted list depending on its
  // first character.
  const blocks = markdown.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isList) {
          return (
            <ul key={i} className="space-y-2 pl-4">
              {lines.map((l, j) => (
                <li key={j} className="text-neutral-300 leading-relaxed">
                  <span className="text-emerald-400 mr-2">•</span>
                  {renderInlineMd(l.replace(/^\s*[-*]\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-neutral-300 leading-relaxed">
            {renderInlineMd(block)}
          </p>
        );
      })}
    </div>
  );
}

async function loadStandards(): Promise<ParsedStandards | null> {
  try {
    // process.cwd() is the repo root in both `next dev` and the
    // standalone Vercel build. STANDARDS.md is bundled because it's
    // a tracked file in the repo.
    const filePath = path.join(process.cwd(), "STANDARDS.md");
    const raw = await fs.readFile(filePath, "utf8");
    return parseStandards(raw);
  } catch {
    return null;
  }
}

export default async function StandardsPage() {
  const parsed = await loadStandards();

  if (!parsed) {
    return (
      <main className="min-h-screen bg-[#030303] text-neutral-100 flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">Standards</h1>
          <p className="mt-3 text-sm text-neutral-400 max-w-md">
            STANDARDS.md couldn&rsquo;t be loaded. The file lives at the repo
            root — check the deployment.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <Link
            href="/letters"
            className="text-sm text-neutral-400 hover:text-emerald-400 transition"
          >
            Friday Letters &rarr;
          </Link>
        </div>
      </nav>

      <header className="mx-auto max-w-3xl px-6 pt-20 pb-12">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-400">
          Standards
        </p>
        <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
          The bars we hold ourselves to.
        </h1>
        <p className="mt-6 text-lg text-neutral-400 leading-relaxed">
          {renderInlineMd(parsed.preamble.split("\n").slice(0, 5).join(" "))}
        </p>
      </header>

      {/* In-page nav */}
      <nav aria-label="Standards" className="mx-auto max-w-3xl px-6 pb-12">
        <ol className="grid gap-2 md:grid-cols-2 text-sm">
          {parsed.sections.map((s) => (
            <li key={s.slug}>
              <a
                href={`#${s.slug}`}
                className="block rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-neutral-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.05] hover:text-white"
              >
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Sections */}
      <div className="mx-auto max-w-3xl px-6 space-y-16 pb-24">
        {parsed.sections.map((s) => (
          <section id={s.slug} key={s.slug} className="scroll-mt-24">
            <h2 className="text-2xl font-semibold text-white">{s.heading}</h2>
            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <MarkdownBlock markdown={s.body} />
            </div>
          </section>
        ))}

        {parsed.postamble && (
          <section className="border-t border-white/5 pt-12">
            <h2 className="text-xl font-semibold text-white">
              When does a standard retire?
            </h2>
            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <MarkdownBlock markdown={parsed.postamble} />
            </div>
          </section>
        )}

        <div className="mt-16 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-8 text-center">
          <p className="text-sm text-neutral-400">
            Want to hold us to one of these? Email{" "}
            <a
              href="mailto:standards@sovereignmatrix.agency"
              className="text-emerald-400 hover:underline"
            >
              standards@sovereignmatrix.agency
            </a>
            . If we&rsquo;ve missed a bar with you, every remedy on this page is
            unprompted — no support ticket required.
          </p>
        </div>
      </div>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-neutral-600">
          Sovereign Matrix &middot; Standards &middot; Updated when{" "}
          <code className="font-mono text-neutral-500">STANDARDS.md</code> is
          edited
        </div>
      </footer>
    </main>
  );
}
