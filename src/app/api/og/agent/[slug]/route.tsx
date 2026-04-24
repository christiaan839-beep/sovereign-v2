/**
 * GET /api/og/agent/[slug] — dynamic Open Graph image per agent.
 *
 * Every time someone shares an agent link on Twitter / LinkedIn / Slack /
 * iMessage, the social card embeds an image. Most apps ship the same OG
 * image for every page — missed opportunity. This route generates a
 * branded 1200×630 PNG per-slug, featuring:
 *
 *   - The agent's deterministic sigil (reused from src/lib/agent-sigil)
 *   - Display name + tagline
 *   - Category badge
 *   - Brand footer
 *
 * Runs at the edge (fast cold-start, globally cached). ImageResponse from
 * `next/og` handles the JSX → PNG render via @vercel/og under the hood.
 *
 * Usage: set as `openGraph.images` on /agents/[slug] generateMetadata.
 */

import { ImageResponse } from "next/og";
import { getAgentPublic } from "@/lib/agent-catalog";
import { agentSigilDataUrl, sigilPalette } from "@/lib/agent-sigil";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const agent = await getAgentPublic(slug);

  // For unknown slugs we still emit a valid-but-generic OG image.
  const displayName = agent?.displayName ?? slug;
  const tagline =
    agent?.tagline ??
    agent?.description?.slice(0, 140) ??
    `A Sovereign Matrix first-party agent`;
  const category = agent?.category ?? "General";
  const palette = sigilPalette(category);
  const sigilUrl = agentSigilDataUrl(slug, { category, size: 320 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #010101 0%, #0A0807 70%, " + palette.bg + " 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          padding: "56px 72px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Accent glow — copper radial in top-right */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: 300,
            background: palette.fg,
            opacity: 0.12,
            display: "flex",
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: palette.fg,
              display: "flex",
            }}
          />
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 16,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#8F8576",
              display: "flex",
            }}
          >
            Sovereign Matrix · Agent
          </span>
        </div>

        {/* Main row: sigil + text */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            gap: 56,
            marginTop: 32,
          }}
        >
          {/* Sigil — rendered from the data URL. next/og can load data: URLs. */}
          <img
            src={sigilUrl}
            width={280}
            height={280}
            alt=""
            style={{ borderRadius: 24, display: "flex" }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 18,
                  fontFamily: "monospace",
                  color: palette.fg,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  display: "flex",
                }}
              >
                {category}
              </span>
            </div>
            <div
              style={{
                fontSize: 74,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: -1.5,
                color: "white",
                display: "flex",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 26,
                lineHeight: 1.4,
                color: "#B8B0A6",
                maxWidth: 540,
                display: "flex",
              }}
            >
              {tagline}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 28,
            fontFamily: "monospace",
            fontSize: 18,
            color: "#5C544A",
          }}
        >
          <span style={{ display: "flex" }}>sovereignmatrix.agency/agents/{slug}</span>
          <span style={{ display: "flex", color: palette.fg }}>
            218 agents · 16 providers · 126+ models
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Cache hard — per-slug OGs are deterministic.
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    },
  );
}
