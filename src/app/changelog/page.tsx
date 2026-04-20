import type { Metadata } from "next";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Fragment, type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Changelog · Sovereign Matrix",
  description:
    "Every SESSION_LOG entry, every shipped feature. Engineering transparency as a moat.",
  alternates: { canonical: "https://sovereignmatrix.agency/changelog" },
};

export const revalidate = 3600;

interface ChangelogEntry {
  version: string;
  date: string;
  tagline: string;
  bullets: string[];
}

async function loadSessionLog(): Promise<ChangelogEntry | null> {
  try {
    const filePath = path.join(process.cwd(), "SESSION_LOG.md");
    const raw = await fs.readFile(filePath, "utf8");
    return parseSessionLog(raw);
  } catch {
    return null;
  }
}

function parseSessionLog(raw: string): ChangelogEntry | null {
  const h1Match = raw.match(/^#\s+Session Log\s+(v\d+)\s+[—–-]\s+([^(\n]+?)(?:\s*\([^)]*\))?\s*$/m);
  if (!h1Match) return null;
  const version = h1Match[1];
  const date = h1Match[2].trim();

  const afterH1 = raw.slice(h1Match.index! + h1Match[0].length);
  // No 's' flag (TS target pre-ES2018) — use [\s\S] to match newlines.
  const blockquoteMatch = afterH1.match(/^>\s+([\s\S]+?)(?=\n\n|\n---)/);
  const tagline = blockquoteMatch ? blockquoteMatch[1].replace(/\n>\s?/g, " ").trim() : "";

  const summaryMatch = raw.match(/##\s+[^\n]*Top-of-page summary[^\n]*\n\n([\s\S]*?)(?:\n\n##\s|\n\n---)/);
  const bullets: string[] = [];
  if (summaryMatch) {
    for (const line of summaryMatch[1].split("\n")) {
      const bulletMatch = line.match(/^-\s+(.+)$/);
      if (bulletMatch) bullets.push(bulletMatch[1].trim());
    }
  }
  return { version, date, tagline, bullets };
}

/**
 * Parse minimal markdown (bold / code / link) into React nodes.
 * No innerHTML — safe by construction.
 */
function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [full, bold, code, linkText, linkHref] = match;
    if (bold !== undefined) parts.push(<strong key={match.index}>{bold}</strong>);
    else if (code !== undefined)
      parts.push(<code key={match.index} className="font-mono text-[13px] px-1 py-0.5 bg-[#1A1712]/[0.06] rounded">{code}</code>);
    else if (linkText !== undefined && linkHref !== undefined) {
      const safe = /^(https?:\/\/|\/|#)/.test(linkHref) ? linkHref : "#";
      parts.push(
        <a key={match.index} href={safe} className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]"
          {...(safe.startsWith("http") ? { rel: "noopener", target: "_blank" } : {})}>
          {linkText}
        </a>,
      );
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 0 ? text : <Fragment>{parts}</Fragment>;
}

// Legacy hardcoded entries removed — the page now reads from
// SESSION_LOG.md at request time. Historical entries live in git
// history (link in the colophon below).


export default async function ChangelogPage() {
  const entry = await loadSessionLog();

  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      <div className="max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Changelog · Ship record
        </p>
        <h1 className="font-serif text-5xl lg:text-7xl leading-[1.05] tracking-tight mb-6">
          Every ship,
          <br />
          <em className="text-[#B5532C] not-italic">on record.</em>
        </h1>
        <p className="text-lg text-[#5C544A] leading-relaxed max-w-2xl">
          We publish our session logs. Every commit batch, every
          decision, every piece of honest debt. Most SaaS publishes
          marketing copy. We publish engineering notes because the
          notes ARE the marketing.
        </p>
      </div>

      <section className="mt-24 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        {entry ? (
          <article>
            <div className="flex items-baseline gap-6 mb-6">
              <p className="font-mono text-sm tracking-[0.2em] uppercase text-[#B5532C]">
                {entry.version}
              </p>
              <p className="text-[10px] font-mono tracking-[0.18em] uppercase text-[#8F8576]">
                {entry.date}
              </p>
            </div>

            {entry.tagline && (
              <blockquote className="border-l-2 border-[#B5532C] pl-6 mb-10 text-lg text-[#5C544A] italic leading-relaxed">
                {entry.tagline}
              </blockquote>
            )}

            {entry.bullets.length > 0 && (
              <ul className="space-y-4">
                {entry.bullets.map((b, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="text-[#B5532C] shrink-0 font-mono text-xs mt-1.5 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[15px] text-[#1A1712] leading-relaxed">
                      {renderInline(b)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ) : (
          <div className="py-12 text-center text-[#8F8576] text-sm">
            No changelog entries yet. Check back after the next ship.
          </div>
        )}
      </section>

      {entry && (
        <section className="mt-24 border-t border-[#D8CDB7] pt-12 max-w-4xl">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
            Earlier versions
          </p>
          <p className="text-[15px] text-[#5C544A] leading-relaxed max-w-2xl">
            Previous SESSION_LOG versions (v1–
            {parseInt(entry.version.slice(1)) - 1}) live in the{" "}
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/commits/main/SESSION_LOG.md"
              className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]"
            >
              git history
            </a>
            . Every commit hash is a verifiable claim.
          </p>
        </section>
      )}

      <footer className="mt-32 pt-12 border-t border-[#D8CDB7] max-w-4xl text-[11px] font-mono text-[#8F8576] leading-loose">
        <p>
          This page reads <code>SESSION_LOG.md</code> at request time and
          parses the top-of-page summary. Revalidates every hour. No CMS,
          no database — the markdown file IS the source of truth.
        </p>
      </footer>
    </main>
  );
}
