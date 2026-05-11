/**
 * GET /api/verify/badge.svg?id=<receipt-id> — shields.io-style SVG verification badge.
 *
 * The developer-relations weapon. Anyone can drop this in a README,
 * a docs page, or a release note:
 *
 *   ![Verified by Sovereign](https://sovereignmatrix.agency/api/verify/badge.svg?id=<receipt-id>)
 *
 * The badge renders one of three states:
 *   - "verified · <agent>"     — cyan, ✓ checkmark — signature checks out
 *   - "tampered · <id-prefix>" — red, ✗ — signature mismatch or 404
 *   - "loading"                — neutral — fallback for missing/invalid params
 *
 * Pure server-side SVG. No JS, no fonts to load, no external deps.
 * Cached at the edge for 5 minutes — receipts are immutable so cache
 * invalidation is moot, but a short TTL keeps a re-keyed signing
 * secret rollover propagating quickly.
 *
 * Open CORS so README image rendering works from any host (GitHub
 * renders images server-side via camo.githubusercontent.com).
 */
import { getRun, canonicalizeRun, verifySignature } from "@/lib/agent-runs";

interface BadgeOpts {
  state: "verified" | "tampered" | "neutral";
  label: string; // "verified" / "tampered" / "loading"
  value: string; // agent name or id prefix
}

// ── Brand palette ───────────────────────────────────────────────
const COLORS = {
  verified: { fg: "#0ea5e9", labelBg: "#222226" }, // cyan
  tampered: { fg: "#dc2626", labelBg: "#222226" }, // red
  neutral: { fg: "#737373", labelBg: "#222226" }, // gray
};

// Shields.io conventional badge size. 11px char width is the typical
// guess — close enough for monospaced fonts and a few percent of slop.
const CHAR_W = 6.2;
const PAD_X = 8;
const HEIGHT = 20;

function textWidth(s: string): number {
  return Math.ceil(s.length * CHAR_W);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderBadge({ state, label, value }: BadgeOpts): string {
  const palette = COLORS[state];
  const lw = textWidth(label) + PAD_X * 2;
  const vw = textWidth(value) + PAD_X * 2 + 10; // +10 for the ✓/✗ glyph
  const totalW = lw + vw;
  const labelEscaped = escapeXml(label);
  const valueEscaped = escapeXml(value);
  const icon = state === "verified" ? "✓" : state === "tampered" ? "✗" : "•";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${HEIGHT}" role="img" aria-label="Sovereign Verified: ${valueEscaped}">
  <title>Sovereign Verified: ${valueEscaped}</title>
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
    <stop offset="1" stop-opacity=".12"/>
  </linearGradient>
  <mask id="m"><rect width="${totalW}" height="${HEIGHT}" rx="3" fill="#fff"/></mask>
  <g mask="url(#m)">
    <rect width="${lw}" height="${HEIGHT}" fill="${palette.labelBg}"/>
    <rect x="${lw}" width="${vw}" height="${HEIGHT}" fill="${palette.fg}"/>
    <rect width="${totalW}" height="${HEIGHT}" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" font-size="11" font-weight="600">
    <text x="${lw / 2}" y="14" fill="#000" fill-opacity=".3">${labelEscaped}</text>
    <text x="${lw / 2}" y="13">${labelEscaped}</text>
    <text x="${lw + vw / 2}" y="14" fill="#000" fill-opacity=".3">${icon} ${valueEscaped}</text>
    <text x="${lw + vw / 2}" y="13">${icon} ${valueEscaped}</text>
  </g>
</svg>`;
}

function svgResponse(body: string, cacheSeconds = 300): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`,
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id || !/^[0-9a-f-]{32,40}$/i.test(id)) {
    return svgResponse(
      renderBadge({ state: "neutral", label: "sovereign", value: "loading" }),
      60,
    );
  }

  let run;
  try {
    run = await getRun(id);
  } catch {
    return svgResponse(
      renderBadge({
        state: "tampered",
        label: "sovereign",
        value: id.slice(0, 6),
      }),
      60,
    );
  }

  if (!run) {
    return svgResponse(
      renderBadge({
        state: "tampered",
        label: "sovereign",
        value: "not found",
      }),
      60,
    );
  }

  // Visibility gate: badges only show for receipts the bearer of the URL
  // can already read. Private receipts return the SAME "not found" state
  // as truly-missing receipts so a cross-origin enumerator can't tell
  // a private receipt apart from a non-existent id.
  if (run.visibility === "private") {
    return svgResponse(
      renderBadge({
        state: "tampered",
        label: "sovereign",
        value: "not found",
      }),
      60,
    );
  }

  const canonical = canonicalizeRun({
    id: run.id,
    agentName: run.agentName,
    modelUsed: run.modelUsed,
    input: run.input,
    output: run.output,
    safetyResult: run.safetyResult,
    durationMs: run.durationMs,
    createdAt: run.createdAt,
  });

  const valid = verifySignature(canonical, run.signature);

  return svgResponse(
    renderBadge(
      valid
        ? {
            state: "verified",
            label: "sovereign",
            value: run.agentName.slice(0, 28),
          }
        : {
            state: "tampered",
            label: "sovereign",
            value: "tampered",
          },
    ),
    300,
  );
}
