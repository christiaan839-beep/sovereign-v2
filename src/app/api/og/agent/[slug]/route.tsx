/**
 * GET /api/og/agent/[slug] — dynamic 1200×630 Open Graph card for
 * marketplace agent detail pages.
 *
 * Sharing /marketplace/<slug> on Twitter / LinkedIn / Slack now renders
 * a real card preview instead of a generic snippet. Pairs with the
 * receipt OG card (/api/og/receipt/<id>) for total social coverage of
 * the platform's two most-shareable URL classes.
 *
 * Pulls tier from agent-tiers so the card visually distinguishes
 * core vs experimental vs deprecated. Falls back to "experimental"
 * for unknown slugs (matches default-tier behavior).
 */

import { ImageResponse } from "next/og";
import { AGENT_SLUGS } from "@/lib/agent-slugs";
import { getAgentTier } from "@/lib/agent-tiers";

export const runtime = "nodejs";
const SIZE = { width: 1200, height: 630 } as const;
const AGENT_SLUG_SET = new Set(AGENT_SLUGS);

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => {
      const map: Record<string, string> = {
        seo: "SEO",
        pii: "PII",
        rag: "RAG",
        asr: "ASR",
        ocr: "OCR",
        abm: "ABM",
        crm: "CRM",
        ai: "AI",
        api: "API",
      };
      return map[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) {
    return new ImageResponse(<FallbackCard reason="invalid slug" />, SIZE);
  }
  if (!AGENT_SLUG_SET.has(slug)) {
    return new ImageResponse(<FallbackCard reason="not found" />, SIZE);
  }

  const name = slugToName(slug);
  const tier = getAgentTier(slug);
  const tierColor =
    tier === "core" ? "#22d3ee" : tier === "deprecated" ? "#f87171" : "#a3a3a3";
  const tierBg =
    tier === "core"
      ? "rgba(34,211,238,0.08)"
      : tier === "deprecated"
        ? "rgba(248,113,113,0.08)"
        : "rgba(163,163,163,0.06)";

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(ellipse at top left, #0a2540 0%, #030303 65%)",
        color: "#e5e5e5",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        padding: 64,
      }}
    >
      {/* Top row: brand + tier */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 22,
            fontWeight: 600,
            color: "#fff",
            letterSpacing: -0.4,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              background: "#22d3ee",
              borderRadius: 999,
              boxShadow: "0 0 24px #22d3ee",
              display: "block",
            }}
          />
          Sovereign Matrix
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 16,
            color: tierColor,
            border: `1px solid ${tierColor}55`,
            background: tierBg,
            borderRadius: 999,
            padding: "6px 16px",
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {tier} agent
        </div>
      </div>

      {/* Headline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          marginTop: 32,
          gap: 20,
        }}
      >
        <div
          style={{
            fontSize: 30,
            color: "#a3a3a3",
            fontWeight: 500,
            letterSpacing: -0.4,
          }}
        >
          Marketplace
        </div>
        <div
          style={{
            fontSize: 116,
            fontWeight: 700,
            letterSpacing: -4,
            lineHeight: 1.0,
            color: "#fff",
            maxWidth: 1100,
            display: "flex",
          }}
        >
          {name.slice(0, 28)}
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#737373",
            marginTop: 12,
            fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
            letterSpacing: -0.3,
            display: "flex",
          }}
        >
          /marketplace/{slug}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: 20,
          color: "#a3a3a3",
          fontWeight: 500,
          letterSpacing: -0.3,
        }}
      >
        <span style={{ display: "flex" }}>
          Every run produces a verifiable signed receipt
        </span>
        <span style={{ display: "flex", color: "#22d3ee" }}>
          sovereignmatrix.agency
        </span>
      </div>
    </div>,
    SIZE,
  );
}

function FallbackCard({ reason }: { reason: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#030303",
        color: "#e5e5e5",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 28,
          color: "#737373",
          letterSpacing: 0.4,
          textTransform: "uppercase",
          marginBottom: 16,
          display: "flex",
        }}
      >
        Sovereign Matrix
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: -2,
          color: "#fff",
          display: "flex",
        }}
      >
        Agent {reason}
      </div>
    </div>
  );
}
