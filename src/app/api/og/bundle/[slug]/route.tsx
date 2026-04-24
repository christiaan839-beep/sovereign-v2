/**
 * GET /api/og/bundle/[slug] — dynamic OG image per bundle.
 *
 * A bundle is a curated set of agents. The card shows up to 5 member
 * sigils stacked on the left + bundle name + member count on the right,
 * so the card's composition tells you at a glance "this is a multi-agent
 * recipe, not a single agent". Distinct from the single-sigil agent OG.
 *
 * Runs at the edge. 31536000s cache (immutable) — bundle composition
 * changes infrequently; if it does change, slug changes with it.
 */

import { ImageResponse } from "next/og";
import { getBundleBySlug } from "@/lib/agent-bundles";
import { agentSigilDataUrl, sigilPalette } from "@/lib/agent-sigil";

export const runtime = "nodejs";
// Bundle lookup hits Postgres; keep on nodejs runtime for DB driver
// compatibility (edge would work with neon/serverless but bundle
// metadata is cheap + pod-side cache is fine here).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const bundle = await getBundleBySlug(slug);

  // Fallback when slug is unknown (deleted or private): still render a
  // valid card so scrapers don't hit 500. Generic copy + brand palette.
  const name = bundle?.name ?? slug;
  const description =
    bundle?.description ?? `A Sovereign Matrix agent bundle`;
  const members = bundle?.members ?? [];
  const palette = sigilPalette("Meta");

  // Render up to 5 member sigils in a stack. If we have fewer, show a
  // placeholder sigil keyed on the bundle slug.
  const shown = members.slice(0, 5);
  const remaining = Math.max(0, members.length - shown.length);
  const sigilUrls =
    shown.length > 0
      ? shown.map((m) =>
          agentSigilDataUrl(m.agentSlug ?? m.agentId, { size: 140 }),
        )
      : [agentSigilDataUrl(slug, { category: "Meta", size: 140 })];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(135deg, #010101 0%, #0A0807 70%, " + palette.bg + " 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: "56px 72px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -180,
            left: -180,
            width: 520,
            height: 520,
            borderRadius: 260,
            background: palette.fg,
            opacity: 0.1,
            display: "flex",
          }}
        />

        {/* Left: stacked sigils */}
        <div
          style={{
            display: "flex",
            width: 360,
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {sigilUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              width={160}
              height={160}
              alt=""
              style={{
                position: "absolute",
                left: i * 36,
                top: (i - (sigilUrls.length - 1) / 2) * 24,
                borderRadius: 16,
                boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
                display: "flex",
              }}
            />
          ))}
          {remaining > 0 && (
            <div
              style={{
                position: "absolute",
                left: sigilUrls.length * 36 + 20,
                width: 64,
                height: 64,
                borderRadius: 32,
                background: "rgba(181,83,44,0.2)",
                border: "2px solid rgba(181,83,44,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "monospace",
                fontSize: 22,
                color: palette.fg,
              }}
            >
              +{remaining}
            </div>
          )}
        </div>

        {/* Right: text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            marginLeft: 40,
            gap: 16,
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontFamily: "monospace",
              color: palette.fg,
              letterSpacing: 3,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            Bundle · {members.length || 1} agents
          </span>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              color: "white",
              display: "flex",
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 22,
              lineHeight: 1.4,
              color: "#B8B0A6",
              maxWidth: 600,
              display: "flex",
            }}
          >
            {description}
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
            sovereignmatrix.agency/marketplace/bundles/{slug}
          </div>
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
