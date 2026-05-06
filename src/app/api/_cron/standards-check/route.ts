import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { requireCronAuth } from "@/lib/cron-auth";
import { getLettersNewestFirst } from "@/lib/letters";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("standards-check");

/**
 * GET /api/_cron/standards-check
 *
 * Weekly self-audit. Walks the public-facing source tree looking for
 * the kinds of language we explicitly committed to NOT use in
 * STANDARDS.md §07 ("no comparative framing"). Also confirms the
 * Friday Letter discipline (STANDARDS.md §06) is being kept.
 *
 * Three checks:
 *
 *   A. Competitor names. The list below contains the brands we used
 *      to mention in StackKiller (since anonymised) plus the most
 *      common AI-agent-platform rivals as of 2026. Add to it as the
 *      market evolves; remove only if a brand has demonstrably
 *      disappeared.
 *
 *   B. Comparative phrases. Words like "better than", "faster than",
 *      "unlike", "vs.", "compared to" — in any user-facing surface.
 *
 *   C. Friday Letter freshness. The newest LETTERS entry must be
 *      dated within the last 8 days (7 + 1 day grace window).
 *
 * Outputs: a JSON report and, if any check fails AND
 * SLACK_OPS_WEBHOOK_URL is set, a Slack ping with a punch list. Never
 * 500s on its own bugs — the whole point is to be a cheap nudge, not
 * a paging incident.
 *
 * Schedule: weekly via vercel.json.
 */

const COMPETITOR_NAMES = [
  // Tools we used to call out by name in marketing copy
  "Apollo.io",
  "Clay",
  "Jasper",
  "SEMrush",
  "Outreach.io",
  "Clearbit",
  // AI agent platform peers
  "Lindy",
  "Manus",
  "Sintra",
  "Relevance AI",
  "Sierra AI",
  "Decagon",
  "Cresta",
  "Glean",
  "Harvey",
  "Cursor",
];

const COMPARATIVE_PHRASES = [
  /\bbetter than\b/i,
  /\bfaster than\b/i,
  /\bunlike [A-Z]/, // "unlike" + a brand-shaped capitalised word
  /\bcompared to [A-Z]/,
  /\bvs\.\s+[A-Z]/,
  /\bbeats?\b\s+(?:the )?(?:competition|market|rest)/i,
];

const SCAN_DIRS = ["src/app", "src/components"];

const SCAN_EXTS = new Set([".tsx", ".ts", ".md", ".mdx"]);

const SKIP_PATHS = new Set([
  // Files that have legitimate reasons to mention competitor names
  // (e.g. this very file, or doc files that audit the standard).
  "src/app/api/_cron/standards-check/route.ts",
]);

/** Short relative path from the repo root for human-readable hits. */
function rel(absPath: string, repoRoot: string): string {
  return path.relative(repoRoot, absPath).split(path.sep).join("/");
}

interface Hit {
  file: string;
  line: number;
  match: string;
  /** "competitor" | "comparative" */
  kind: "competitor" | "comparative";
}

async function walk(dir: string, out: string[]): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip common heavy/irrelevant trees.
      if (
        e.name === "node_modules" ||
        e.name === ".next" ||
        e.name.startsWith(".")
      )
        continue;
      await walk(full, out);
    } else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name))) {
      out.push(full);
    }
  }
}

async function scanFile(file: string, repoRoot: string): Promise<Hit[]> {
  const relPath = rel(file, repoRoot);
  if (SKIP_PATHS.has(relPath)) return [];

  let text: string;
  try {
    text = await fs.readFile(file, "utf-8");
  } catch {
    return [];
  }

  const hits: Hit[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment-only lines (these are dev notes, not user-facing)
    const trimmed = line.trim();
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("<!--")
    ) {
      continue;
    }

    for (const name of COMPETITOR_NAMES) {
      if (line.includes(name)) {
        hits.push({
          file: relPath,
          line: i + 1,
          match: name,
          kind: "competitor",
        });
      }
    }

    for (const re of COMPARATIVE_PHRASES) {
      const m = line.match(re);
      if (m) {
        hits.push({
          file: relPath,
          line: i + 1,
          match: m[0],
          kind: "comparative",
        });
      }
    }
  }
  return hits;
}

async function checkLetterFreshness(): Promise<{
  ok: boolean;
  daysOld: number;
  newestSlug: string | null;
}> {
  const letters = await getLettersNewestFirst();
  if (letters.length === 0) {
    return { ok: false, daysOld: Infinity, newestSlug: null };
  }
  const newest = letters[0];
  const newestDate = new Date(newest.date + "T17:00:00Z");
  const daysOld = Math.floor(
    (Date.now() - newestDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return { ok: daysOld <= 8, daysOld, newestSlug: newest.slug };
}

async function notifySlack(args: {
  hits: Hit[];
  letter: { ok: boolean; daysOld: number; newestSlug: string | null };
}): Promise<void> {
  const webhook = process.env.SLACK_OPS_WEBHOOK_URL;
  if (!webhook) return;

  const lines: string[] = ["📐 *Standards check — weekly report*"];

  if (args.hits.length === 0) {
    lines.push(
      "✅ No competitor names or comparative phrases in user-facing code.",
    );
  } else {
    const competitor = args.hits.filter((h) => h.kind === "competitor");
    const comparative = args.hits.filter((h) => h.kind === "comparative");
    if (competitor.length > 0) {
      lines.push(
        `🚩 *${competitor.length} competitor name${competitor.length === 1 ? "" : "s"} found:*`,
      );
      for (const h of competitor.slice(0, 8)) {
        lines.push(`  • \`${h.file}:${h.line}\` → ${h.match}`);
      }
      if (competitor.length > 8)
        lines.push(`  …and ${competitor.length - 8} more`);
    }
    if (comparative.length > 0) {
      lines.push(
        `🚩 *${comparative.length} comparative phrase${comparative.length === 1 ? "" : "s"} found:*`,
      );
      for (const h of comparative.slice(0, 8)) {
        lines.push(`  • \`${h.file}:${h.line}\` → "${h.match}"`);
      }
      if (comparative.length > 8)
        lines.push(`  …and ${comparative.length - 8} more`);
    }
  }

  if (!args.letter.ok) {
    if (args.letter.newestSlug === null) {
      lines.push(
        "🚩 *Friday Letter:* no letters in the archive yet. Ship the first one.",
      );
    } else {
      lines.push(
        `🚩 *Friday Letter overdue:* newest letter (\`${args.letter.newestSlug}\`) is ${args.letter.daysOld} days old. STANDARDS.md §06 requires ≤7.`,
      );
    }
  } else {
    lines.push(
      `✅ Friday Letter is current (\`${args.letter.newestSlug}\`, ${args.letter.daysOld}d old).`,
    );
  }

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
  } catch {
    // Slack outages must not fail the cron.
  }
}

export async function GET(req: Request) {
  const authErr = requireCronAuth(req);
  if (authErr) return authErr;

  const repoRoot = process.cwd();
  const allFiles: string[] = [];
  for (const dir of SCAN_DIRS) {
    await walk(path.join(repoRoot, dir), allFiles);
  }

  const allHits: Hit[] = [];
  for (const file of allFiles) {
    const hits = await scanFile(file, repoRoot);
    if (hits.length > 0) allHits.push(...hits);
  }

  const letter = await checkLetterFreshness();

  // Always alert; the message itself is positive when nothing's wrong.
  void notifySlack({ hits: allHits, letter });

  const summary = {
    ok: allHits.length === 0 && letter.ok,
    scanned: {
      directories: SCAN_DIRS,
      files: allFiles.length,
    },
    competitorHits: allHits.filter((h) => h.kind === "competitor").length,
    comparativeHits: allHits.filter((h) => h.kind === "comparative").length,
    fridayLetter: letter,
    hits: allHits.slice(0, 50), // cap response payload
  };

  log.info("Standards check complete", {
    ok: summary.ok,
    competitorHits: summary.competitorHits,
    comparativeHits: summary.comparativeHits,
    letterDaysOld: letter.daysOld,
  });

  return NextResponse.json(summary);
}
