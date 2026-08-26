/**
 * /docs/specs — index of the specification texts.
 *
 * Enumerated from docs/specs/*.md rather than hand-listed, so the index
 * cannot drift from what is actually served. Adding a spec file publishes
 * it; deleting one removes it from here. There is no second list to keep
 * in sync.
 *
 * Brand: cyan — audit / infrastructure surface.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Specifications | Sovereign Matrix",
  description:
    "The VAOS receipt specifications, transparency-log design, and IETF drafts — rendered verbatim from the repository.",
};

const SPECS_DIR = join(process.cwd(), "docs", "specs");

interface SpecEntry {
  slug: string;
  title: string;
  summary: string;
  lines: number;
}

function loadIndex(): SpecEntry[] {
  return readdirSync(SPECS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const slug = file.replace(/\.md$/, "");
      const raw = readFileSync(join(SPECS_DIR, file), "utf8");
      const body = raw.startsWith("---")
        ? raw.replace(/^---\n[\s\S]*?\n---\n/, "")
        : raw;
      const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? slug;
      // First real paragraph after the title, trimmed to a line.
      const summary =
        body
          .split("\n")
          .slice(1)
          .find((l) => l.trim().length > 40 && !l.startsWith("#") && !l.startsWith(">"))
          ?.trim()
          .replace(/[*_`[\]]/g, "")
          .slice(0, 150) ?? "";
      return { slug, title, summary, lines: body.split("\n").length };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export default function SpecsIndexPage() {
  const specs = loadIndex();
  const totalLines = specs.reduce((n, s) => n + s.lines, 0);

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Specifications</h1>
        <p className="mt-4 leading-relaxed text-neutral-400">
          The receipt wire formats, the transparency-log design and threat model, and the
          IETF drafts. Each page renders the markdown file from the repository verbatim —
          the file is the specification, and the page adds nothing to it.
        </p>
        <p className="mt-3 font-mono text-xs text-neutral-600">
          {specs.length} documents · {totalLines.toLocaleString()} lines · docs/specs/
        </p>

        <ul className="mt-10 space-y-3">
          {specs.map((spec) => (
            <li key={spec.slug}>
              <Link
                href={`/docs/specs/${spec.slug}`}
                className="group block rounded-lg border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-cyan-500/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3">
                  <FileText
                    className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/70 transition-colors group-hover:text-cyan-400"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h2 className="font-medium text-neutral-100 group-hover:text-white">
                      {spec.title}
                    </h2>
                    {spec.summary && (
                      <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                        {spec.summary}
                      </p>
                    )}
                    <p className="mt-2 font-mono text-[11px] text-neutral-600">
                      {spec.slug}.md · {spec.lines} lines
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
