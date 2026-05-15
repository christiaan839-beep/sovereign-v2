import { ImageResponse } from "next/og";

/**
 * Dynamic OG image for /investors (Cook 174).
 *
 * Auto-generated via Next.js Image Response — renders the
 * Vanta-comparable hook + the platform headline numbers.
 */

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
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 14,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "#06B6D4",
            fontFamily: "monospace",
            marginBottom: 24,
          }}
        >
          Sovereign Matrix · Investor Data Room
        </div>
        <div
          style={{
            fontSize: 72,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            fontWeight: 900,
            color: "#ffffff",
            maxWidth: 1040,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>The cryptographic layer</span>
          <span style={{ color: "#06B6D4" }}>
            underneath every AI decision.
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 32,
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Stat label="Agents" value="145" />
        <Stat label="Tests" value="2,492" />
        <Stat label="Crypto moats" value="7" />
        <Stat label="Verticals" value="100/100" valueColor="#10b981" />
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontSize: 18,
            color: "#6b7280",
            alignSelf: "flex-end",
            fontFamily: "monospace",
          }}
        >
          sovereignmatrix.agency/investors
        </div>
      </div>
    </div>,
    { ...size },
  );
}

function Stat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          fontSize: 48,
          fontWeight: 900,
          color: valueColor ?? "#ffffff",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 13,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#6b7280",
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </div>
  );
}
