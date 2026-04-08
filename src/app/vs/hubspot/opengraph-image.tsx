import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sovereign Matrix vs HubSpot — Honest Comparison";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #010101 0%, #030303 50%, #050505 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 20px", borderRadius: "9999px", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", marginBottom: "24px" }}>
          <span style={{ color: "#10b981", fontSize: "14px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const }}>Honest Comparison</span>
        </div>
        <h1 style={{ color: "white", fontSize: "56px", fontWeight: 900, textAlign: "center" as const, lineHeight: 1.1, margin: 0 }}>
          Sovereign Matrix
        </h1>
        <p style={{ color: "#525252", fontSize: "56px", fontWeight: 900, margin: "8px 0 0 0" }}>vs HubSpot</p>
        <div style={{ display: "flex", gap: "48px", marginTop: "48px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ color: "#737373", fontSize: "16px" }}>HubSpot</span>
            <span style={{ color: "#ef4444", fontSize: "40px", fontWeight: 900 }}>$890/mo</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ color: "#737373", fontSize: "16px" }}>Sovereign</span>
            <span style={{ color: "#10b981", fontSize: "40px", fontWeight: 900 }}>$199/mo</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
