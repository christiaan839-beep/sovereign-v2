import { ImageResponse } from "next/og";

/**
 * /api/og?title=...&subtitle=...
 *
 * Dynamic OG image generator. Used in `<meta property="og:image">`
 * across pages so that any link share — Twitter, LinkedIn, Slack,
 * Discord — surfaces a Sovereign-branded image instead of the
 * generic "no preview" card.
 *
 * Defaults match the brand: `#030303` background, emerald accent,
 * Sovereign wordmark in the top-left, 2-line title in the centre,
 * subtitle at the bottom. No Tailwind — `next/og` doesn't run
 * Tailwind; uses inline style objects with Edge-runtime-safe
 * primitives only.
 *
 * Examples:
 *   /api/og
 *   /api/og?title=Sovereign+Lead+Engine&subtitle=50+leads+in+30+days
 *   /api/og?title=Letter+%231&subtitle=The+Monday+kind
 */

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 } as const;

const DEFAULT_TITLE = "Sovereign Matrix";
const DEFAULT_SUBTITLE = "The trust + memory + outcome layer for autonomous AI";

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? DEFAULT_TITLE).slice(0, 120);
  const subtitle = (searchParams.get("subtitle") ?? DEFAULT_SUBTITLE).slice(
    0,
    220,
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#030303",
        padding: "60px 72px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative",
      }}
    >
      {/* Subtle copper radial top-right */}
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -200,
          width: 700,
          height: 700,
          background:
            "radial-gradient(circle at center, rgba(181,83,44,0.18), transparent 60%)",
          display: "flex",
        }}
      />

      {/* Brand wordmark */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            background: "#10b981",
            boxShadow: "0 0 18px rgba(16,185,129,0.6)",
            display: "flex",
          }}
        />
        <span
          style={{
            color: "#10b981",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          Sovereign Matrix
        </span>
      </div>

      {/* Centre title */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingTop: 12,
        }}
      >
        <h1
          style={{
            color: "#ffffff",
            fontSize: 80,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            margin: 0,
            maxWidth: 1000,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            color: "#a3a3a3",
            fontSize: 30,
            lineHeight: 1.3,
            margin: 0,
            marginTop: 28,
            maxWidth: 980,
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* Bottom strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#525252",
          fontSize: 18,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          letterSpacing: 1,
        }}
      >
        <span>sovereignmatrix.agency</span>
        <span style={{ color: "#10b981" }}>● live</span>
      </div>
    </div>,
    {
      ...SIZE,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
