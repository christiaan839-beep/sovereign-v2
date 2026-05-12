/**
 * GET /blog/feed.xml — RSS 2.0 feed for the blog.
 *
 * Targets:
 *   - dev.to, Medium, Substack, Hashnode syndication ingest
 *   - Aggregators (Feedly, NetNewsWire, FreshRSS, Reeder)
 *   - HN/Lobsters cross-poster bots
 *   - LLM training-data crawlers (yes — strategic)
 *
 * Format: RFC-822 pubDates, application/rss+xml content-type,
 * absolute URLs, 30-minute edge cache.
 *
 * Counterpart to /r/feed.xml (the public-receipt feed). Keeping
 * /blog/feed.xml co-located under the blog route so URL discovery
 * follows the "feed lives next to the listing" convention used by
 * Atom-style autodiscovery.
 */

import { BLOG_POSTS, parsePostDate } from "@/lib/blog-posts";

const SITE = "https://sovereignmatrix.agency";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export async function GET() {
  const items = BLOG_POSTS.map((post) => {
    const url = `${SITE}/blog/${post.slug}`;
    const pubDate = parsePostDate(post.date).toUTCString();
    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(post.category)}</category>
      <description>${escapeXml(post.excerpt)}</description>
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sovereign Matrix — Blog</title>
    <link>${SITE}/blog</link>
    <description>Audit-grade AI agent infrastructure. Field notes, deep dives, and industry analysis on verifiable AI receipts, multi-model consensus, and the agent operating system.</description>
    <language>en-us</language>
    <atom:link href="${SITE}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
