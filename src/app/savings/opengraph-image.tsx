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
        Sovereign Matrix · Audit-Prep ROI Calculator
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
        <span>How much will</span>
        <span style={{ color: "#06B6D4" }}>audit-prep automation</span>
        <span>save you per year?</span>
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
        <div style={{ fontSize: 20, color: "#94a3b8", maxWidth: 720 }}>
          Built for the Chief Compliance Officer, Chief Model Risk Officer, and
          Head of Internal Audit. $250/hr internal · $450/hr Big-4.
        </div>
        <div
          style={{
            fontSize: 16,
            color: "#6b7280",
            fontFamily: "monospace",
          }}
        >
          /savings
        </div>
      </div>
    </div>,
    { ...size },
  );
}
