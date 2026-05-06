/**
 * The Friday Letter — one page, every Friday at 5pm.
 *
 * Each Friday, one short letter goes out to every active customer
 * AND lives publicly at /letters/[slug]. The format is fixed so
 * the practice is sustainable: 4 sections, ~600 words, no
 * fluff, no marketing.
 *
 *   1. What shipped this week (concrete)
 *   2. What didn't (honest)
 *   3. One customer's story (with permission, anonymised if needed)
 *   4. One lesson learned
 *
 * Storage: published letters live in the `friday_letters` Postgres
 * table (migration 0022) so the operator can publish from anywhere
 * without a Vercel deploy. The static SEED_LETTERS array below is
 * the historical fallback — it renders even when migrations
 * haven't applied yet, and any letter slug is uniquely either in
 * the DB or in the seed (never both).
 *
 * Adding a new letter (preferred path): use /admin/letters/new in
 * the operator UI. The form posts to /api/_admin/publish-letter
 * which inserts into `friday_letters` with status="published".
 *
 * Adding a new letter (legacy path): append to SEED_LETTERS below
 * and ship a deploy. Used only when the DB is unavailable or for
 * the founding archive entries that pre-date migration 0022.
 */

import { db } from "@/db";
import { fridayLetters } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("letters");

export interface Letter {
  /** URL slug — keep short, kebab-case, never change after publish. */
  slug: string;
  /** ISO date this letter was sent (YYYY-MM-DD). */
  date: string;
  /** One-line title, will appear on the index + the letter page. */
  title: string;
  /** 2-3 sentence preview shown in the index list. */
  preview: string;
  /** Full body. Paragraphs separated by `\n\n`. Lines starting with `## ` become headings. */
  body: string;
}

export const SEED_LETTERS: readonly Letter[] = [
  {
    slug: "letter-001-the-monday-kind",
    date: "2026-05-08",
    title: "Letter #1 — The Monday kind",
    preview:
      "First Friday letter. What shipped, what didn't, one early customer story, one lesson — and why we're going to keep doing this every Friday from now on.",
    body: `
This is the first letter, so a quick note on what these are.

Every Friday at 5pm I'm going to write you one of these. Four sections, never longer than a page, never marketing. What shipped this week. What didn't. One customer story. One thing I learned.

If they're useful, you'll keep reading. If not, the unsubscribe link is real and I won't be hurt — but I think the discipline of writing one a week is going to make me a better person to work with regardless.

## What shipped this week

We anonymised the comparison table on our homepage. It used to list eight competitor names with their prices. It doesn't anymore. The math is still there — eight jobs, $815/mo across them, $199/mo on Sovereign — but the names are gone. We don't run our positioning by naming who else is in the room. That's a small change in code, a bigger change in how we think.

Two new pages: a customer-only welcome page that shows you a 60-second Loom from me the moment your setup payment lands, and this letters archive at /letters. Both are at the URL today.

The migration file MIGRATIONS-RUNME.sql got a new section for the welcome columns. If you're an operator running the platform yourself, paste it into Neon when you have a quiet moment.

## What didn't ship

The public delivery dashboard at /customers/[slug] — the place where, with permission, your wins become receipts other founders can see. I designed it on Tuesday and got cold feet about whether to push it without three customers willing to opt in. I'd rather wait than ship a page with three blank slots that look like wishful thinking.

I'm holding it for next week. If you'd consider being one of the first three customers to opt in, reply to this letter and we'll talk about which numbers you'd want public.

## A customer story

Customer #1 last week — anonymised, will name them when they say it's okay — sent the very first batch of 50 leads I delivered for them on Monday. By Friday they'd replied to twelve, booked three meetings, and forwarded the spreadsheet to their cofounder with the message "this is the version of lead-gen I always wanted."

Three meetings off one batch isn't normal. They had a strong product and a clean ICP. The leads weren't magic. But the experience was — for the first time in a year, leads showed up Monday morning without them having to think.

That's the standard.

## What I learned

The hardest thing about this whole pivot wasn't the code. It's that the moment you stop ranking yourself against others, your standards have to come from inside, and inside is uncomfortable. "We're 23% faster than X" is a low bar that hides as a high one. "Sarah forgets we exist because we're never the slow part of her day" is harder, because it doesn't come with a benchmark to clap for.

I'd rather work to that second bar.

Talk Friday.

— C.
`.trim(),
  },
];

/**
 * Pulled from DB on every server-render. The /letters and
 * /letters/[slug] pages set `revalidate = 300` so this is at most
 * one query per 5 minutes per page; cheap.
 */
async function loadDbLetters(): Promise<Letter[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await db
      .select({
        slug: fridayLetters.slug,
        date: fridayLetters.date,
        title: fridayLetters.title,
        preview: fridayLetters.preview,
        body: fridayLetters.body,
      })
      .from(fridayLetters)
      .where(eq(fridayLetters.status, "published"))
      .orderBy(desc(fridayLetters.date));
    return rows;
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01" || pgCode === "42703") return []; // migration not applied
    log.warn("Friday letters DB load failed — using seed only", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Merge DB-published letters with the historical seed. DB wins on
 * slug collision so an operator-edited letter overrides its seed.
 */
function merge(dbLetters: Letter[]): Letter[] {
  const seenSlugs = new Set(dbLetters.map((l) => l.slug));
  const seedRest = SEED_LETTERS.filter((l) => !seenSlugs.has(l.slug));
  return [...dbLetters, ...seedRest].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getLettersNewestFirst(): Promise<Letter[]> {
  const dbLetters = await loadDbLetters();
  return merge(dbLetters);
}

export async function getLetterBySlug(slug: string): Promise<Letter | null> {
  const all = await getLettersNewestFirst();
  return all.find((l) => l.slug === slug) ?? null;
}

/**
 * Synchronous variant — seed-only. Used by `generateStaticParams`
 * at build time when the DB is not reachable. The DB-published
 * letters render via the async path on first request and ISR cache.
 */
export function getSeedLettersSync(): Letter[] {
  return [...SEED_LETTERS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Render a letter body as a list of (kind, text) blocks. Caller
 * decides how to render each kind — kept here so JSX lives in
 * page files and parsing logic lives in lib.
 */
export type LetterBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string };

export function parseLetterBody(body: string): LetterBlock[] {
  const blocks: LetterBlock[] = [];
  const paragraphs = body.split(/\n\s*\n/);
  for (const raw of paragraphs) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) {
      blocks.push({ kind: "heading", text: trimmed.slice(3).trim() });
    } else {
      blocks.push({ kind: "paragraph", text: trimmed });
    }
  }
  return blocks;
}
