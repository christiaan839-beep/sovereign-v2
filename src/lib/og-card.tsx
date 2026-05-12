/**
 * Shared Open Graph card generator.
 *
 * Every vertical landing surface (compliance, vendor-risk, insurance,
 * industries hub, trust, spec, quickstart) renders a designed 1200×630
 * preview when shared on Twitter/LinkedIn/Slack/iMessage.
 *
 * Design system:
 *   - Dark base (#030303) with a tinted radial glow per accent
 *   - Brand pill top-left ("• Sovereign Matrix")
 *   - Accent-colored uppercase eyebrow
 *   - Big serif-y headline (system-ui doesn't ship a serif at the edge,
 *     but a tight letter-spaced sans gets us close)
 *   - Sub-line + status footer
 *
 * Brand color rule (docs/design-system/brand-colors.md):
 *   - cyan #22d3ee  → audit / infrastructure surfaces (compliance,
 *                     vendor-risk, insurance, industries, trust, spec,
 *                     quickstart, explorer)
 *   - copper #B5532C → marketing / agency surfaces
 *
 * Only call this from edge-runtime route segments
 * (`opengraph-image.tsx` files); the Next.js compiler is strict about
 * what crosses the runtime boundary.
 */

import { ImageResponse } from "next/og";

type Accent = "cyan" | "copper";

interface OgCardOptions {
  /** Top eyebrow text. Uppercase, accent-colored. ~18-32 chars max. */
  eyebrow: string;
  /** Main headline. 1-2 lines, ~44 chars per line max. */
  title: string;
  /** Sub-line. ~70 chars max. Neutral color. */
  subtitle: string;
  /** Optional bottom-right status pill (e.g., "Vanta-for-AI"). */
  footer?: string;
  /** Brand accent. Default cyan. */
  accent?: Accent;
}

const ACCENT_RGB: Record<Accent, string> = {
  cyan: "34, 211, 238",
  copper: "181, 83, 44",
};

const ACCENT_HEX: Record<Accent, string> = {
  cyan: "#22d3ee",
  copper: "#B5532C",
};

export function ogSize() {
  return { width: 1200, height: 630 } as const;
}

export function ogCard(opts: OgCardOptions): ImageResponse {
  const accent = opts.accent ?? "cyan";
  const rgb = ACCENT_RGB[accent];
  const hex = ACCENT_HEX[accent];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#030303",
        color: "#e5e5e5",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: 72,
        position: "relative",
      }}
    >
      {/* Ambient accent glow */}
      <div
        style={{
          position: "absolute",
          top: -180,
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, rgba(${rgb}, 0.18) 0%, transparent 70%)`,
          filter: "blur(64px)",
        }}
      />

      {/* Top row — brand pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: -0.3,
          color: "#fff",
        }}
      >
        <span
          style={{
            display: "block",
            width: 12,
            height: 12,
            borderRadius: 999,
            background: hex,
            boxShadow: `0 0 24px ${hex}`,
          }}
        />
        Sovereign Matrix
      </div>

      {/* Headline block */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          marginTop: 16,
          gap: 18,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 2.5,
            textTransform: "uppercase",
            color: hex,
            display: "flex",
          }}
        >
          {opts.eyebrow}
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -2.5,
            lineHeight: 1.05,
            color: "#fff",
            maxWidth: 1056,
            display: "flex",
          }}
        >
          {opts.title}
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#a3a3a3",
            fontWeight: 400,
            letterSpacing: -0.2,
            lineHeight: 1.35,
            maxWidth: 980,
            marginTop: 8,
            display: "flex",
          }}
        >
          {opts.subtitle}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: 18,
          color: "#737373",
          fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
        }}
      >
        <span style={{ display: "flex", letterSpacing: 0.4 }}>
          sovereignmatrix.agency
        </span>
        {opts.footer && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 14px",
              fontSize: 15,
              color: hex,
              border: `1px solid rgba(${rgb}, 0.4)`,
              background: `rgba(${rgb}, 0.08)`,
              borderRadius: 999,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              fontFamily:
                "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            {opts.footer}
          </span>
        )}
      </div>
    </div>,
    ogSize(),
  );
}
