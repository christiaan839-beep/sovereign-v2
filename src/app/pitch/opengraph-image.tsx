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
          color: "#06B6D4",
          fontFamily: "monospace",
        }}
      >
        Sovereign Matrix · 60-Second Pitch
      </div>

      <div
        style={{
          fontSize: 64,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          fontWeight: 900,
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          maxWidth: 1040,
        }}
      >
        <span>Vanta sold for $2.45B</span>
        <span>without the crypto moat.</span>
        <span style={{ color: "#06B6D4" }}>We have it.</span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          paddingTop: 32,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: "#94a3b8",
            maxWidth: 720,
            lineHeight: 1.3,
          }}
        >
          Cryptographic verification underneath every AI agent decision.
          <br />
          Read in 60 seconds. Book the call.
        </div>
        <div
          style={{
            fontSize: 16,
            color: "#6b7280",
            fontFamily: "monospace",
          }}
        >
          sovereignmatrix.agency/pitch
        </div>
      </div>
    </div>,
    { ...size },
  );
}
