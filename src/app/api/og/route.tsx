import { ImageResponse } from "next/og";

/**
 * Dynamic Open Graph image generator.
 *
 *   /api/og                                 → default Sovereign Matrix card
 *   /api/og?slug=agency-content-packet      → vertical-specific card
 *   /api/og?title=...&subtitle=...          → arbitrary title/subtitle
 *
 * Renders a 1200×630 PNG via @vercel/og (vendored as next/og in Next.js
 * 16). No external font fetches — uses the built-in Geist sans bundled
 * with Next; the runtime declines gracefully to its default fallback if
 * font loading fails.
 *
 * Used by the openGraph.images metadata in each playbook layout. Static
 * pages override with their own image when needed.
 */
export const runtime = "edge";

const VERTICAL_CONFIGS: Record<
  string,
  {
    badge: string;
    title: string;
    subtitle: string;
    accent: string;
  }
> = {
  "agency-content-packet": {
    badge: "Vertical · B2B agencies",
    title: "Agency Content Packet",
    subtitle:
      "One client → SEO post + 3 emails + 3 ads + competitor teaser. Every week.",
    accent: "#B5532C",
  },
  "recruiting-sourcing-sprint": {
    badge: "Vertical · Recruiting agencies",
    title: "Recruiting Sourcing Sprint",
    subtitle:
      "One role brief → ICP + 3 booleans + outreach pack + 5 channels + 4-objection playbook.",
    accent: "#22d3ee",
  },
  "growth-pulse": {
    badge: "Vertical · African SMBs · Billed in Rands",
    title: "Growth Pulse",
    subtitle:
      "Local SEO + 4 social posts + email + WhatsApp + offer card in your currency.",
    accent: "#10b981",
  },
  "realestate-listing-pulse": {
    badge: "Vertical · Real estate",
    title: "Listing Pulse",
    subtitle:
      "One property → MLS copy + open-house posts + buyer email + comps + market update.",
    accent: "#a78bfa",
  },
  default: {
    badge: "Sovereign Matrix",
    title: "One brief → a full week of deliverables.",
    subtitle:
      "Vertical-specific AI agent platform. 4 cornerstone playbooks. Whitelabel-ready.",
    accent: "#B5532C",
  },
};

// Allowlist for ?slug=<vertical> — anything else falls through to default.
// Hardened post security-review-2026-05: bounded inputs + cache headers.
const ALLOWED_SLUGS = new Set([
  "agency-content-packet",
  "recruiting-sourcing-sprint",
  "growth-pulse",
  "realestate-listing-pulse",
  "default",
]);

const TITLE_MAX = 120;
const SUBTITLE_MAX = 240;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawSlug = url.searchParams.get("slug") || "default";
  const slug = ALLOWED_SLUGS.has(rawSlug) ? rawSlug : "default";
  // Cap overrides to bound rendering work — Satori renders text per-pixel,
  // so an unbounded title can burn edge CPU.
  const titleOverride = url.searchParams.get("title")?.slice(0, TITLE_MAX);
  const subtitleOverride = url.searchParams
    .get("subtitle")
    ?.slice(0, SUBTITLE_MAX);

  const cfg = VERTICAL_CONFIGS[slug] ?? VERTICAL_CONFIGS.default;
  const title = titleOverride || cfg.title;
  const subtitle = subtitleOverride || cfg.subtitle;
  const badge = cfg.badge;
  const accent = cfg.accent;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#030303",
        backgroundImage: `radial-gradient(circle at 25% 0%, ${accent}22 0%, transparent 55%), radial-gradient(circle at 90% 100%, #ffffff14 0%, transparent 50%)`,
        padding: "70px 80px",
        fontFamily: "sans-serif",
        color: "white",
        position: "relative",
      }}
    >
      {/* Brand strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 56,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${accent}, #ffffff20)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 800,
            color: "#030303",
          }}
        >
          Σ
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "white",
          }}
        >
          Sovereign Matrix
        </div>
      </div>

      {/* Badge */}
      <div
        style={{
          display: "inline-flex",
          padding: "8px 16px",
          borderRadius: 999,
          backgroundColor: `${accent}1F`,
          border: `1px solid ${accent}55`,
          color: accent,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          alignSelf: "flex-start",
          marginBottom: 32,
        }}
      >
        {badge}
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 76,
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          marginBottom: 28,
          color: "white",
          display: "flex",
          maxWidth: 1040,
        }}
      >
        {title}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 30,
          lineHeight: 1.35,
          color: "#a3a3a3",
          maxWidth: 1040,
          display: "flex",
        }}
      >
        {subtitle}
      </div>

      {/* Footer URL */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          right: 80,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "#737373",
          textTransform: "uppercase",
          display: "flex",
        }}
      >
        sovereignmatrix.agency
      </div>

      {/* Accent bar at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${accent} 0%, ${accent}40 100%)`,
        }}
      />
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        // Aggressive edge-caching — the same (slug, title, subtitle) tuple
        // always renders identically. 24h browser + 7d CDN.
        "Cache-Control":
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, immutable",
      },
    },
  );
}
