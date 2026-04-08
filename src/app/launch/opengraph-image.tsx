import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sovereign Matrix — The Agent Operating System is Live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div style={{ background: "linear-gradient(135deg, #010101 0%, #050505 100%)", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "400px", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(16,185,129,0.1) 0%, transparent 70%)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 24px", borderRadius: "9999px", border: "1px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.1)", marginBottom: "24px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
          <span style={{ color: "#10b981", fontSize: "16px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" as const }}>Now Live</span>
        </div>
        <h1 style={{ color: "white", fontSize: "60px", fontWeight: 900, textAlign: "center" as const, lineHeight: 1.1, margin: 0 }}>The Agent</h1>
        <h1 style={{ color: "#10b981", fontSize: "60px", fontWeight: 900, textAlign: "center" as const, lineHeight: 1.1, margin: 0 }}>Operating System.</h1>
        <p style={{ color: "#737373", fontSize: "22px", marginTop: "20px" }}>130 agents. 39+ models. $199/mo flat.</p>
      </div>
    ),
    { ...size }
  );
}
