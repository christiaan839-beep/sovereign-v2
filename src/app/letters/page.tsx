import Link from "next/link";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { getLettersNewestFirst } from "@/lib/letters";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "The Friday Letter — Sovereign Matrix",
  description:
    "One page, every Friday at 5pm. What shipped, what didn't, a customer story, a lesson. Sent to every active customer; archived publicly here.",
};

export default function LettersIndexPage() {
  const letters = getLettersNewestFirst();

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <Link
            href="/lead-engine"
            className="text-xs text-neutral-400 hover:text-neutral-100 transition"
          >
            Lead Engine &rarr;
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-20">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-500/60">
            The Friday Letter
          </p>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
            One page, every Friday at 5pm.
          </h1>
          <p className="mt-6 text-lg text-neutral-400 leading-relaxed max-w-2xl">
            Four sections. Never longer than a page. What shipped, what
            didn&rsquo;t, one customer story, one lesson learned. Sent to every
            active Sovereign customer; archived here for anyone who wants to
            read along.
          </p>
        </header>

        <ol className="mt-16 space-y-8">
          {letters.map((letter) => (
            <li key={letter.slug}>
              <Link
                href={`/letters/${letter.slug}`}
                className="group block rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.04]"
              >
                <div className="flex items-baseline justify-between gap-6">
                  <time className="font-mono text-xs text-neutral-500">
                    {formatDate(letter.date)}
                  </time>
                  <ArrowRight className="h-4 w-4 text-neutral-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
                </div>
                <h2 className="mt-3 text-xl font-semibold text-white group-hover:text-emerald-300 transition">
                  {letter.title}
                </h2>
                <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                  {letter.preview}
                </p>
              </Link>
            </li>
          ))}
        </ol>

        <div className="mt-20 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-8 text-center">
          <h3 className="text-lg font-semibold text-white">
            Want it in your inbox Friday?
          </h3>
          <p className="mt-3 text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
            Active Sovereign customers get it automatically. If you&rsquo;re not
            a customer yet, the easiest way to subscribe is to be one.
          </p>
          <Link
            href="/lead-engine"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400 transition"
          >
            See the Lead Engine
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="mx-auto max-w-4xl px-6 text-center text-xs text-neutral-600">
          Sovereign Matrix &middot;{" "}
          <Link href="/" className="hover:text-neutral-400">
            Home
          </Link>{" "}
          &middot;{" "}
          <Link href="/lead-engine" className="hover:text-neutral-400">
            Lead Engine
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
