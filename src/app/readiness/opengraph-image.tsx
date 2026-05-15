import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#010101",
        color: "#e5e7eb",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 14,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "#10b981",
          fontFamily: "monospace",
        }}
      >
        Sovereign Matrix · Platform Readiness
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
        }}
      >
        <span
          style={{
            fontSize: 220,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 0.9,
            letterSpacing: "-0.04em",
          }}
        >
          100
        </span>
        <span
          style={{
            fontSize: 110,
            color: "#10b981",
            fontWeight: 900,
            lineHeight: 0.9,
          }}
        >
          /100
        </span>
      </div>
      <div
        style={{
          fontSize: 30,
          color: "#94a3b8",
          fontWeight: 500,
          letterSpacing: "-0.01em",
        }}
      >
        across 8 verticals · CSRD, Banking, Clinical, PV, NERC CIP, Insurance,
        FedRAMP, Tax
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ fontSize: 18, color: "#94a3b8", maxWidth: 720 }}>
          Programmatic score from the open codebase. Auditors trust the number
          because it&apos;s verifiable.
        </div>
        <div
          style={{
            fontSize: 16,
            color: "#6b7280",
            fontFamily: "monospace",
          }}
        >
          /readiness
        </div>
      </div>
    </div>,
    { ...size },
  );
}
