import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sovereign Matrix Pricing — $199/mo flat, no credits";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div style={{ background: "linear-gradient(135deg, #010101 0%, #050505 100%)", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 20px", borderRadius: "9999px", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", marginBottom: "24px" }}>
          <span style={{ color: "#10b981", fontSize: "14px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const }}>Pricing</span>
        </div>
        <h1 style={{ color: "white", fontSize: "56px", fontWeight: 900, margin: 0 }}>$199/month. Flat.</h1>
        <p style={{ color: "#737373", fontSize: "24px", marginTop: "16px" }}>No credits. No per-token fees. 130 agents. 39+ models.</p>
        <div style={{ display: "flex", gap: "24px", marginTop: "40px" }}>
          {[
            { name: "Free", price: "$0" },
            { name: "Starter", price: "$19" },
            { name: "Growth", price: "$49" },
            { name: "Node", price: "$199", highlight: true },
            { name: "Enterprise", price: "$499" },
          ].map((tier) => (
            <div key={tier.name} style={{ padding: "16px 24px", borderRadius: "12px", border: tier.highlight ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.06)", background: tier.highlight ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", textAlign: "center" as const, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ color: "#737373", fontSize: "12px" }}>{tier.name}</span>
              <span style={{ color: tier.highlight ? "#10b981" : "white", fontSize: "24px", fontWeight: 900 }}>{tier.price}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
