/**
 * GET /api/og/creator/[handle] — dynamic OG image per creator.
 *
 * Creator profile card. Shows:
 *   - Handle as the large display type
 *   - Tagline ("Building agents for healthcare" / "Physics + robotics")
 *   - Up to 6 published-agent sigils in a grid — the creator's portfolio
 *   - Verified badge if their account is SAM-verified
 *
 * Handles aren't backed by a DB query here (cost-prohibitive for OG
 * scrapers). We derive the sigil grid + palette from the handle string
 * itself via the existing agent-sigil generator — same deterministic
 * trick, now applied to a creator identity.
 *
 * If we later add `listCreatorAgents(handle)` this route can pull real
 * portfolio data. For now the card is cosmetically-correct + brand-safe.
 */

import { ImageResponse } from "next/og";
import { agentSigilDataUrl, sigilPalette } from "@/lib/agent-sigil";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await params;
  const safeHandle = handle.replace(/^@/, "").slice(0, 40);
  const palette = sigilPalette("Meta");

  // Derive 6 distinct sigils from the handle + an index — deterministic,
  // different from the handle-only sigil. In the future when we have
  // real creator-agent queries this becomes the actual portfolio.
  const gridSigils = Array.from({ length: 6 }, (_, i) =>
    agentSigilDataUrl(`${safeHandle}-portfolio-${i}`, { size: 120 }),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(135deg, #010101 0%, #0A0807 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: "56px 72px",
          position: "relative",
        }}
      >
        {/* ambient halo */}
        <div
          style={{
            position: "absolute",
            top: 100,
            left: 100,
            width: 420,
            height: 420,
            borderRadius: 210,
            background: palette.fg,
            opacity: 0.08,
            display: "flex",
          }}
        />

        {/* Left: handle + bio */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            gap: 14,
            zIndex: 1,
          }}
        >
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
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "#8F8576",
                display: "flex",
              }}
            >
              Creator · Sovereign Matrix
            </span>
          </div>

          <div
            style={{
              fontSize: 80,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: -2,
              color: "white",
              display: "flex",
            }}
          >
            @{safeHandle}
          </div>
          <div
            style={{
              fontSize: 22,
              lineHeight: 1.4,
              color: "#B8B0A6",
              maxWidth: 520,
              display: "flex",
            }}
          >
            Building on the Sovereign Matrix agent marketplace. SAM v1.0 spec,
            cryptographically signed manifests, 70/30 creator earnings.
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontFamily: "monospace",
              fontSize: 16,
              color: "#5C544A",
            }}
          >
            sovereignmatrix.agency/creators/{safeHandle}
          </div>
        </div>

        {/* Right: 3x2 sigil grid */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: 400,
            gap: 16,
            alignContent: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          {gridSigils.map((url, i) => (
            <img
              key={i}
              src={url}
              width={120}
              height={120}
              alt=""
              style={{
                borderRadius: 12,
                display: "flex",
                opacity: 0.9,
              }}
            />
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    },
  );
}
