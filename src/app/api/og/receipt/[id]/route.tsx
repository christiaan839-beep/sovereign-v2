/**
 * GET /api/og/receipt/[id] — dynamic Open Graph card for receipt URLs.
 *
 * Sharing /r/[id] on Twitter / LinkedIn / Slack now renders a real
 * card preview instead of a generic link snippet. The card shows:
 *   - agent name (big, top)
 *   - "Verified by Sovereign Matrix" status with cyan dot
 *   - model name + timestamp
 *   - signature prefix (proves the card came from us, not a screenshot)
 *
 * Uses Next.js native `ImageResponse` from `next/og` — no playwright,
 * no headless chrome, no external dep. Renders as JSX → PNG on demand.
 * Edge-runtime for fast first-byte.
 */

import { ImageResponse } from "next/og";
import { getRun } from "@/lib/agent-runs";

export const runtime = "nodejs";
// 1200x630 is the Open Graph / Twitter card standard.
const SIZE = { width: 1200, height: 630 } as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id || !/^[0-9a-f-]{32,40}$/i.test(id)) {
    return new ImageResponse(<FallbackCard reason="invalid id" />, SIZE);
  }

  const run = await getRun(id).catch(() => null);

  if (!run || run.visibility === "private") {
    return new ImageResponse(
      <FallbackCard reason={run ? "private" : "not found"} />,
      SIZE,
    );
  }

  const created =
    run.createdAt instanceof Date
      ? run.createdAt
      : new Date(run.createdAt as unknown as string);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(ellipse at top left, #0a2540 0%, #030303 65%)",
        color: "#e5e5e5",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        padding: 64,
      }}
    >
      {/* Top row: brand + status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: -0.4,
            color: "#fff",
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              background: "#22d3ee",
              borderRadius: 999,
              boxShadow: "0 0 24px #22d3ee",
              display: "block",
            }}
          />
          Sovereign Matrix
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 18,
            color: "#22d3ee",
            border: "1px solid rgba(34,211,238,0.4)",
            background: "rgba(34,211,238,0.08)",
            borderRadius: 999,
            padding: "6px 16px",
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Verifiable Receipt
        </div>
      </div>

      {/* Headline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          marginTop: 32,
          gap: 20,
        }}
      >
        <div
          style={{
            fontSize: 36,
            color: "#a3a3a3",
            fontWeight: 500,
            letterSpacing: -0.4,
          }}
        >
          Agent run
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.05,
            color: "#fff",
            maxWidth: 1100,
            display: "flex",
          }}
        >
          {truncate(run.agentName, 48)}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            fontSize: 24,
            color: "#a3a3a3",
            marginTop: 12,
            fontWeight: 500,
          }}
        >
          <span style={{ display: "flex" }}>{run.modelUsed}</span>
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: 999,
              background: "#525252",
            }}
          />
          <span style={{ display: "flex" }}>{run.durationMs} ms</span>
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: 999,
              background: "#525252",
            }}
          />
          <span style={{ display: "flex" }}>
            {created.toISOString().slice(0, 10)}
          </span>
        </div>
      </div>

      {/* Signature footer */}
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
        <span style={{ display: "flex", letterSpacing: -0.3 }}>
          HMAC-SHA256 · {run.signature.slice(0, 24)}…
        </span>
        <span
          style={{
            display: "flex",
            color: "#a3a3a3",
            letterSpacing: -0.3,
          }}
        >
          /r/{run.id.slice(0, 8)}
        </span>
      </div>
    </div>,
    SIZE,
  );
}

function FallbackCard({ reason }: { reason: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#030303",
        color: "#e5e5e5",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 28,
          color: "#737373",
          letterSpacing: 0.4,
          textTransform: "uppercase",
          marginBottom: 16,
          display: "flex",
        }}
      >
        Sovereign Matrix
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: -2,
          color: "#fff",
          display: "flex",
        }}
      >
        Receipt {reason}
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
