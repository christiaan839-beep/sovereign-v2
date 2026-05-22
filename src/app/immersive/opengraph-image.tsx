/**
 * SOVEREIGN MATRIX — /immersive Open Graph image (Wave 122).
 *
 * Server-rendered social card via `next/og`. When the immersive URL
 * is shared (Slack / Twitter / WhatsApp / iMessage), the preview
 * shows the brand chrome instead of a blank Next.js default.
 *
 * Design rules:
 *   - 1200×630 (OpenGraph + Twitter Cards spec)
 *   - Dark substrate (#020202) matching the live page
 *   - Cyan accent + faint receipt-paper grid
 *   - Sans-serif system stack — no remote font load; `next/og` would
 *     have to fetch a font file at edge runtime if we use serif here.
 *
 * Cached aggressively by Vercel's edge — re-rendered only when this
 * file changes. No runtime data dependency.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sovereign Matrix — A Verifiable Interface";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#020202",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        fontFamily:
          "ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* Faint receipt-paper grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.05,
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Cyan radial glow on the right where the "orb" sits */}
      <div
        style={{
          position: "absolute",
          right: -120,
          top: 80,
          width: 640,
          height: 640,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, rgba(34,211,238,0.28) 0%, rgba(34,211,238,0.05) 45%, transparent 70%)",
        }}
      />

      {/* Wireframe-style "orb" — two concentric ellipses */}
      <div
        style={{
          position: "absolute",
          right: 100,
          top: 140,
          width: 380,
          height: 380,
          border: "2px solid rgba(34,211,238,0.55)",
          borderRadius: "50%",
          transform: "rotate(-12deg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 280,
            height: 280,
            border: "1px solid rgba(34,211,238,0.35)",
            borderRadius: "50%",
            transform: "rotate(24deg) scaleY(0.65)",
          }}
        />
      </div>

      {/* Corner brackets (top-left, top-right, bottom-left, bottom-right) */}
      {[
        { top: 36, left: 36, borders: "border-t border-l" },
        { top: 36, right: 36, borders: "border-t border-r" },
        { bottom: 36, left: 36, borders: "border-b border-l" },
        { bottom: 36, right: 36, borders: "border-b border-r" },
      ].map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 26,
            height: 26,
            borderColor: "rgba(34,211,238,0.5)",
            borderStyle: "solid",
            borderTopWidth: c.borders.includes("border-t") ? 1.5 : 0,
            borderLeftWidth: c.borders.includes("border-l") ? 1.5 : 0,
            borderRightWidth: c.borders.includes("border-r") ? 1.5 : 0,
            borderBottomWidth: c.borders.includes("border-b") ? 1.5 : 0,
            ...c,
          }}
        />
      ))}

      {/* SYS·LINK marker top-left */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 80,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 14,
          letterSpacing: "0.22em",
          color: "rgba(34,211,238,0.8)",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#22d3ee",
            boxShadow: "0 0 12px rgba(34,211,238,0.8)",
          }}
        />
        SYS·LINK ESTABLISHED
      </div>

      {/* Frame marker top-right */}
      <div
        style={{
          position: "absolute",
          top: 36,
          right: 80,
          fontSize: 14,
          letterSpacing: "0.22em",
          color: "rgba(163,163,163,0.7)",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      >
        01 / 03
      </div>

      {/* Main headline + sub */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 220,
          maxWidth: 580,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 14,
            letterSpacing: "0.22em",
            color: "rgba(34,211,238,0.85)",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          ◆ VAOS RECEIPT FABRIC
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 0.98,
            letterSpacing: "-0.03em",
            color: "white",
          }}
        >
          A Verifiable Interface.
        </div>
        <div
          style={{
            fontSize: 22,
            lineHeight: 1.4,
            color: "rgba(163,163,163,0.95)",
            maxWidth: 540,
          }}
        >
          Every agent output ships with a signed receipt. ML-DSA-65,
          post-quantum, on every run.
        </div>
      </div>

      {/* Bottom-left tag */}
      <div
        style={{
          position: "absolute",
          bottom: 36,
          left: 80,
          fontSize: 13,
          letterSpacing: "0.22em",
          color: "rgba(163,163,163,0.5)",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      >
        FRAME LOCKED · sovereignmatrix.agency
      </div>

      {/* Bottom-right build label */}
      <div
        style={{
          position: "absolute",
          bottom: 36,
          right: 80,
          fontSize: 13,
          letterSpacing: "0.22em",
          color: "rgba(163,163,163,0.5)",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      >
        VAOS · v2.1
      </div>
    </div>,
    { ...size },
  );
}
