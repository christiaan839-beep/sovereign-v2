// ─── Citation Engine ─────────────────────────────────────────────────────────
// Pure string-manipulation utility that converts raw URLs in text into numbered
// inline citations and produces a formatted "Sources:" footer.

export interface Citation {
  index: number;     // [1], [2], etc.
  title: string;     // page title or domain
  url: string;       // source URL
  snippet?: string;  // relevant excerpt
}

export interface CitedContent {
  text: string;           // content with inline [1][2] markers
  citations: Citation[];  // numbered source list
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;

/** Extract the bare domain from a URL (e.g. "https://docs.example.com/page" → "docs.example.com") */
function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname;
  } catch {
    // Fallback: strip protocol and grab everything before the first slash
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

// ─── Core API ────────────────────────────────────────────────────────────────

/**
 * Find all URLs in `text`, assign each unique URL a sequential number,
 * replace the URL in-text with `[n]`, and return the modified text plus
 * the ordered citation array.
 */
export function addCitations(text: string): CitedContent {
  const urlMap = new Map<string, number>(); // url → citation index
  const citations: Citation[] = [];
  let counter = 0;

  const cited = text.replace(URL_REGEX, (match) => {
    // Strip trailing punctuation that was captured but isn't part of the URL
    const cleaned = match.replace(/[.,;:!?]+$/, "");

    if (!urlMap.has(cleaned)) {
      counter++;
      urlMap.set(cleaned, counter);
      citations.push({
        index: counter,
        title: extractDomain(cleaned),
        url: cleaned,
      });
    }

    const idx = urlMap.get(cleaned)!;
    // Preserve any trailing punctuation that was stripped from the URL
    const trailingPunctuation = match.slice(cleaned.length);
    return `[${idx}]${trailingPunctuation}`;
  });

  return { text: cited, citations };
}

/**
 * Format citations as a markdown-style "Sources:" footer block.
 *
 * Example output:
 * ```
 * ---
 * Sources:
 * [1] example.com — https://example.com/page
 * [2] another.org — https://another.org/article
 * ```
 */
export function formatCitationFooter(citations: Citation[]): string {
  if (citations.length === 0) return "";

  const lines = citations.map(
    (c) => `[${c.index}] ${c.title} \u2014 ${c.url}`
  );

  return `---\nSources:\n${lines.join("\n")}`;
}
