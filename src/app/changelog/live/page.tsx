import type { Metadata } from "next";
import Link from "next/link";
import { execSync } from "node:child_process";

export const metadata: Metadata = {
  title: "Changelog — Live — Sovereign Matrix",
  description:
    "Auto-generated wave-by-wave shipping timeline rendered from git log at build time. Public + auditable. Procurement-velocity signal.",
  openGraph: {
    title: "Sovereign Matrix — Live changelog",
    description:
      "Every commit, every wave, rendered as a procurement-readable timeline.",
  },
};

// ISR — regenerate hourly. The git log is static between commits;
// re-rendering on every request would shell out unnecessarily.
export const revalidate = 3600;

interface CommitEntry {
  sha: string;
  shortSha: string;
  date: string;
  subject: string;
  body: string;
  wave: number | null;
  kind: "elite" | "fix" | "chore" | "feat" | "docs" | "other";
}

/**
 * Read the last N commits from git. Parses each commit's subject
 * line for a wave tag like "elite(wave 47): ..." so we can render
 * the timeline with wave numbers. Falls back gracefully when git
 * isn't available (some CI containers don't ship git).
 */
function loadCommits(limit = 60): CommitEntry[] {
  let raw: string;
  try {
    raw = execSync(
      `git log -${limit} --pretty=format:'COMMIT_DELIM%n%H%n%cI%n%s%n%b%nEND_COMMIT' --no-show-signature`,
      { encoding: "utf8", cwd: process.cwd() },
    );
  } catch {
    return [];
  }
  const out: CommitEntry[] = [];
  const blocks = raw.split("COMMIT_DELIM\n").filter((s) => s.trim());
  for (const block of blocks) {
    const cleaned = block.replace(/END_COMMIT\s*$/, "").trim();
    const lines = cleaned.split("\n");
    if (lines.length < 3) continue;
    const sha = lines[0];
    const date = lines[1];
    const subject = lines[2];
    const body = lines.slice(3).join("\n").trim();
    const waveMatch = subject.match(/wave\s+(\d+)/i);
    const wave = waveMatch ? Number(waveMatch[1]) : null;
    const kind = subject.startsWith("elite")
      ? "elite"
      : subject.startsWith("fix")
        ? "fix"
        : subject.startsWith("chore")
          ? "chore"
          : subject.startsWith("feat")
            ? "feat"
            : subject.startsWith("docs")
              ? "docs"
              : "other";
    out.push({
      sha,
      shortSha: sha.slice(0, 8),
      date,
      subject,
      body,
      wave,
      kind,
    });
  }
  return out;
}

function kindAccent(kind: CommitEntry["kind"]): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (kind) {
    case "elite":
      return {
        bg: "bg-[#B5532C]/[0.08]",
        text: "text-[#E08558]",
        border: "border-[#B5532C]/30",
        label: "ELITE",
      };
    case "fix":
      return {
        bg: "bg-rose-500/[0.06]",
        text: "text-rose-300",
        border: "border-rose-500/25",
        label: "FIX",
      };
    case "chore":
      return {
        bg: "bg-white/[0.03]",
        text: "text-neutral-400",
        border: "border-white/[0.10]",
        label: "CHORE",
      };
    case "feat":
      return {
        bg: "bg-cyan-500/[0.06]",
        text: "text-cyan-300",
        border: "border-cyan-500/25",
        label: "FEAT",
      };
    case "docs":
      return {
        bg: "bg-violet-500/[0.06]",
        text: "text-violet-300",
        border: "border-violet-500/25",
        label: "DOCS",
      };
    default:
      return {
        bg: "bg-white/[0.02]",
        text: "text-neutral-500",
        border: "border-white/[0.06]",
        label: "—",
      };
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
}

export default function LiveChangelogPage() {
  const commits = loadCommits(80);
  const waves = commits.filter((c) => c.wave !== null).length;
  const totalCommits = commits.length;

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          CHANGELOG · LIVE · LAST {totalCommits} COMMITS · {waves} TAGGED WAVES
        </p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
          Every wave,
          <br />
          <span className="text-[#B5532C]">on the record.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          Rendered from <code className="text-neutral-300">git log</code> at
          build time. Commit SHAs link to the public GitHub source; the
          wave-numbered &ldquo;elite&rdquo; tags mark shippable milestones.
          Procurement reviewers grade vendors on shipping cadence — this page is
          the cadence, rendered as UI. For the marketing-style version see{" "}
          <Link
            href="/changelog"
            className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
          >
            /changelog
          </Link>
          .
        </p>

        {commits.length === 0 && (
          <div className="p-5 border border-rose-500/25 bg-rose-500/[0.04] rounded-[3px] mb-10">
            <p className="text-[13px] text-neutral-300 leading-[1.6]">
              git log unavailable on this deploy. The changelog is ordinarily
              generated from the repository&apos;s commit history at build time.
              View the raw log on GitHub:{" "}
              <a
                href="https://github.com/christiaan839-beep/sovereign-v2/commits"
                target="_blank"
                rel="noreferrer noopener"
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
              >
                github.com/christiaan839-beep/sovereign-v2/commits
              </a>
              .
            </p>
          </div>
        )}

        <ol className="space-y-3">
          {commits.map((c) => {
            const accent = kindAccent(c.kind);
            return (
              <li
                key={c.sha}
                className={`p-4 border rounded-[3px] ${accent.border} ${accent.bg}`}
              >
                <div className="flex flex-wrap items-baseline gap-3 mb-1">
                  <span
                    className={`font-mono text-[10px] tracking-[0.2em] uppercase ${accent.text}`}
                  >
                    {accent.label}
                  </span>
                  {c.wave !== null && (
                    <span className="font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase">
                      Wave {String(c.wave).padStart(2, "0")}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-neutral-600">
                    {formatDate(c.date)}
                  </span>
                  <a
                    href={`https://github.com/christiaan839-beep/sovereign-v2/commit/${c.sha}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-mono text-[10px] text-neutral-500 hover:text-cyan-300 transition-colors ml-auto"
                  >
                    {c.shortSha} →
                  </a>
                </div>
                <p className="text-[14px] text-neutral-100 leading-[1.5]">
                  {c.subject}
                </p>
                {c.body && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase hover:text-neutral-300">
                      Show details ({c.body.split("\n").length} lines)
                    </summary>
                    <pre className="mt-2 text-[11px] font-mono text-neutral-400 leading-[1.6] overflow-x-auto whitespace-pre-wrap break-words">
                      {c.body}
                    </pre>
                  </details>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            Full history on GitHub:{" "}
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/commits"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              github.com/christiaan839-beep/sovereign-v2/commits
            </a>{" "}
            · See also{" "}
            <Link
              href="/spec"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /spec
            </Link>
            ,{" "}
            <Link
              href="/security/live"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /security/live
            </Link>
            ,{" "}
            <Link
              href="/transparency"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /transparency
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
