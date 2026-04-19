import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sovereign Matrix — Agent Operating System";
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
          position: "relative",
        }}
      >
        {/* Emerald glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 20px",
            borderRadius: "9999px",
            border: "1px solid rgba(16,185,129,0.3)",
            background: "rgba(16,185,129,0.08)",
            marginBottom: "24px",
          }}
        >
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
          <span style={{ color: "#10b981", fontSize: "14px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const }}>
            Agent Operating System
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            color: "white",
            fontSize: "64px",
            fontWeight: 900,
            textAlign: "center" as const,
            lineHeight: 1.1,
            margin: 0,
            letterSpacing: "-0.03em",
          }}
        >
          Sovereign Matrix
        </h1>

        {/* Subtitle */}
        <p
          style={{
            color: "#737373",
            fontSize: "24px",
            textAlign: "center" as const,
            marginTop: "16px",
            maxWidth: "600px",
          }}
        >
          130 AI agents. 38 models. $199/mo flat.
        </p>

        {/* Bottom stats */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginTop: "40px",
            padding: "16px 32px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          {[
            { label: "Agents", value: "130" },
            { label: "Models", value: "38" },
            { label: "Safety layers", value: "5" },
            { label: "Price", value: "$199/mo" },
          ].map((stat) => (
            <div key={stat.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ color: "#10b981", fontSize: "28px", fontWeight: 900 }}>{stat.value}</span>
              <span style={{ color: "#525252", fontSize: "12px", textTransform: "uppercase" as const, letterSpacing: "0.15em" }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
