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
        Sovereign Matrix · Live Cryptographic Demo
      </div>

      <div
        style={{
          fontSize: 68,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          fontWeight: 900,
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          maxWidth: 1040,
        }}
      >
        <span>Three real receipts.</span>
        <span style={{ color: "#06B6D4" }}>Verify them yourself.</span>
      </div>

      <div
        style={{
          padding: 20,
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(6,182,212,0.2)",
          borderRadius: 12,
          fontFamily: "monospace",
          fontSize: 14,
          color: "#7dd3fc",
          wordBreak: "break-all",
          maxWidth: 1040,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span style={{ color: "#6b7280" }}># HMAC-SHA256 signature</span>
        <span>
          f29c5b8a3d9e1a4c7b6e2f5a8d1c4b7e9f2a5d8b1c4e7f0a3d6c9b2e5f8a1d4c
        </span>
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
        <div style={{ fontSize: 20, color: "#94a3b8" }}>
          Real signed receipts. Recompute the hex on your machine.
        </div>
        <div
          style={{
            fontSize: 16,
            color: "#6b7280",
            fontFamily: "monospace",
          }}
        >
          /demo/verify-receipt
        </div>
      </div>
    </div>,
    { ...size },
  );
}
