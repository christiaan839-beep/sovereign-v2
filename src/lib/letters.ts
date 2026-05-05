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
 * The letter has three goals:
 *   - Customers feel they hired a person, not a vendor.
 *   - The platform builds a public voice over time.
 *   - The founder is forced to actually look back at the week.
 *
 * Adding a new letter: append a new entry below. The slug is the
 * URL path. Date format is ISO. The body is a single string with
 * `\n\n` between paragraphs — rendered as <p> blocks. Headings
 * use lines that start with `## `. No markdown parser; if you need
 * heavier formatting later, swap in `marked` or `remark`.
 */

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

export const LETTERS: readonly Letter[] = [
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

export function getLetterBySlug(slug: string): Letter | null {
  return LETTERS.find((l) => l.slug === slug) ?? null;
}

export function getLettersNewestFirst(): Letter[] {
  return [...LETTERS].sort((a, b) => (a.date < b.date ? 1 : -1));
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
