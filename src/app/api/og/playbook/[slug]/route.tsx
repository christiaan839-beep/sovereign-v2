/**
 * GET /api/og/playbook/[slug] — dynamic OG image per playbook.
 *
 * Playbook cards emphasize the ordered-steps nature: member sigils
 * arranged horizontally with arrows between them, to communicate
 * "this is a pipeline, not just a bag of agents". Mirrors the actual
 * playbook step order.
 *
 * Edge runtime — PLAYBOOKS is a static import so no DB hit needed.
 */

import { ImageResponse } from "next/og";
import { PLAYBOOKS } from "@/lib/playbooks";
import { agentSigilDataUrl, sigilPalette } from "@/lib/agent-sigil";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const playbook = PLAYBOOKS.find((p) => p.id === slug);

  const name = playbook?.name ?? slug;
  const tagline =
    playbook?.tagline ?? playbook?.description ?? `A Sovereign Matrix playbook`;
  const steps = playbook?.steps ?? [];
  const palette = sigilPalette("Meta");

  // Take up to 5 agent slugs from the step chain. PlaybookStep.agent
  // is the agent identifier used to key each step's sigil.
  const stepSlugs: string[] = steps
    .slice(0, 5)
    .map((s) => s.agent)
    .filter((s): s is string => typeof s === "string" && s.length > 0);
  const displaySlugs = stepSlugs.length > 0 ? stepSlugs : [slug];
  const remaining = Math.max(0, steps.length - displaySlugs.length);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #010101 0%, #0A0807 50%, " + palette.bg + " 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: "56px 72px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -150,
            right: -150,
            width: 480,
            height: 480,
            borderRadius: 240,
            background: palette.fg,
            opacity: 0.1,
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
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#8F8576",
              display: "flex",
            }}
          >
            Playbook · {steps.length || 1} steps
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 60,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            color: "white",
            marginTop: 20,
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
            marginTop: 12,
            maxWidth: 800,
            display: "flex",
          }}
        >
          {tagline}
        </div>

        {/* Step pipeline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginTop: "auto",
            marginBottom: 20,
          }}
        >
          {displaySlugs.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              <img
                src={agentSigilDataUrl(s, { size: 88 })}
                width={88}
                height={88}
                alt=""
                style={{ borderRadius: 12, display: "flex" }}
              />
              {i < displaySlugs.length - 1 && (
                <span
                  style={{
                    fontSize: 28,
                    color: palette.fg,
                    display: "flex",
                  }}
                >
                  →
                </span>
              )}
            </div>
          ))}
          {remaining > 0 && (
            <>
              <span
                style={{
                  fontSize: 28,
                  color: palette.fg,
                  display: "flex",
                }}
              >
                →
              </span>
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 12,
                  background: "rgba(181,83,44,0.15)",
                  border: "2px solid rgba(181,83,44,0.4)",
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
            </>
          )}
        </div>

        {/* Footer URL */}
        <div
          style={{
            display: "flex",
            fontFamily: "monospace",
            fontSize: 16,
            color: "#5C544A",
          }}
        >
          sovereignmatrix.agency/dashboard/playbooks/{slug}
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
