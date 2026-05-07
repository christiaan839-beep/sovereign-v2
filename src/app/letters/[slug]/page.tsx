import Link from "next/link";
import { notFound } from "next/navigation";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import {
  getLetterBySlug,
  getLettersNewestFirst,
  getSeedLettersSync,
  parseLetterBody,
} from "@/lib/letters";
import { ArrowLeft } from "lucide-react";

export const revalidate = 300;
// Allow on-demand rendering for slugs that are added to the DB after
// the build (operator publishes a new letter via /admin/letters/new).
export const dynamicParams = true;

export async function generateStaticParams() {
  // Build-time pre-render: seed-only (DB isn't reachable during build).
  // DB-published letters render on first request and ISR-cache.
  return getSeedLettersSync().map((l) => ({ slug: l.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const letter = await getLetterBySlug(slug);
  if (!letter) return { title: "Letter not found" };
  return {
    title: `${letter.title} — Sovereign Matrix`,
    description: letter.preview,
  };
}

export default async function LetterPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const letter = await getLetterBySlug(slug);
  if (!letter) notFound();

  const blocks = parseLetterBody(letter.body);
  const all = await getLettersNewestFirst();
  const idx = all.findIndex((l) => l.slug === slug);
  const prev = idx > -1 ? all[idx + 1] : null;
  const next = idx > 0 ? all[idx - 1] : null;

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <Link
            href="/letters"
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-100 transition"
          >
            <ArrowLeft className="h-3 w-3" />
            All letters
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-2xl px-6 py-20">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-500/60">
            The Friday Letter
          </p>
          <time className="mt-4 block font-mono text-xs text-neutral-500">
            {formatDate(letter.date)}
          </time>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
            {letter.title}
          </h1>
        </header>

        <div className="mt-12 space-y-6 text-[16px] leading-[1.75] text-neutral-300">
          {blocks.map((block, i) => {
            if (block.kind === "heading") {
              return (
                <h2 key={i} className="mt-12 text-lg font-semibold text-white">
                  {block.text}
                </h2>
              );
            }
            return <p key={i}>{block.text}</p>;
          })}
        </div>

        {/* Sign-off card */}
        <div className="mt-20 rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-sm text-neutral-400">
          <p className="leading-relaxed">
            If you&rsquo;re not a customer yet and you&rsquo;d like the next one
            in your inbox, the easiest path is to become one.
          </p>
          <Link
            href="/lead-engine"
            className="mt-4 inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition"
          >
            See the Lead Engine &rarr;
          </Link>
        </div>

        {/* Prev / next */}
        <nav className="mt-12 flex items-center justify-between gap-4 border-t border-white/5 pt-8">
          {prev ? (
            <Link
              href={`/letters/${prev.slug}`}
              className="group flex flex-col items-start text-left"
            >
              <span className="text-xs uppercase tracking-wider text-neutral-600">
                Previous
              </span>
              <span className="mt-1 text-sm text-neutral-300 group-hover:text-emerald-300 transition">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/letters/${next.slug}`}
              className="group flex flex-col items-end text-right"
            >
              <span className="text-xs uppercase tracking-wider text-neutral-600">
                Next
              </span>
              <span className="mt-1 text-sm text-neutral-300 group-hover:text-emerald-300 transition">
                {next.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>

      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="mx-auto max-w-3xl px-6 text-center text-xs text-neutral-600">
          Sovereign Matrix &middot;{" "}
          <Link href="/letters" className="hover:text-neutral-400">
            Letters archive
          </Link>
        </div>
      </footer>
    </main>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
