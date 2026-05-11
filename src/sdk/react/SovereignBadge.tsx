"use client";

/**
 * <SovereignBadge id="..." /> — drop-in React component for the
 * Sovereign Verified badge.
 *
 * The companion to /embed/verify.js (the script-tag version) for
 * customers who use Next.js / React / Remix / Vite. Same visual
 * contract, same network calls, but importable as a typed React
 * component:
 *
 *   import { SovereignBadge } from "@sovereign-matrix/agent-sdk/react";
 *   <SovereignBadge id={receiptId} theme="dark" />
 *
 * Why ship both? The script tag is for static-site / WordPress / docs
 * usage (no build step); the React component is for product apps that
 * want type-safe, hook-aware, server-render-friendly integration.
 *
 * Behaviour matches /embed/verify.js exactly:
 *   - "loading" while fetching the receipt
 *   - "verified" when /api/verify returns valid: true
 *   - "tampered" / "unverified" otherwise (HTTP error, 404, sig mismatch)
 *
 * SSR-safe: the initial render shows the loading state with no fetch.
 * The fetch chain runs in a useEffect, so server rendering never
 * touches the network.
 *
 * Accessibility: links to the public receipt by default, role="status"
 * during the loading phase so screen readers announce the change.
 */

import { useEffect, useState, useMemo } from "react";

export type SovereignBadgeTheme = "dark" | "light";

export interface SovereignBadgeProps {
  /** Receipt id to verify. Required. */
  id: string;
  /** Origin of the Sovereign deployment. Defaults to https://sovereignmatrix.agency. */
  baseUrl?: string;
  /** Visual theme. Defaults to "dark". */
  theme?: SovereignBadgeTheme;
  /** When false, renders without the click-through link to /r/[id]. Default true. */
  showLink?: boolean;
  /** Optional className passed to the outer span. */
  className?: string;
}

interface SovereignReceiptShape {
  agentName?: string;
  canonical?: string;
  signature?: string;
}

interface SovereignVerifyShape {
  valid?: boolean;
}

type Verdict =
  | { state: "loading" }
  | { state: "verified"; agentName: string }
  | { state: "tampered"; reason: string };

const DEFAULT_BASE_URL = "https://sovereignmatrix.agency";

const THEMES: Record<
  SovereignBadgeTheme,
  {
    bg: string;
    border: string;
    text: string;
    sub: string;
    ok: string;
    bad: string;
    neutral: string;
  }
> = {
  dark: {
    bg: "#030303",
    border: "rgba(34,211,238,0.30)",
    text: "#e5e5e5",
    sub: "#a3a3a3",
    ok: "#34d399",
    bad: "#f87171",
    neutral: "rgba(34,211,238,0.85)",
  },
  light: {
    bg: "#ffffff",
    border: "rgba(8,145,178,0.30)",
    text: "#0a0a0a",
    sub: "#525252",
    ok: "#059669",
    bad: "#dc2626",
    neutral: "rgba(8,145,178,0.85)",
  },
};

export function SovereignBadge({
  id,
  baseUrl = DEFAULT_BASE_URL,
  theme = "dark",
  showLink = true,
  className,
}: SovereignBadgeProps) {
  const [verdict, setVerdict] = useState<Verdict>({ state: "loading" });

  const origin = useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);

  useEffect(() => {
    if (!id || !/^[0-9a-f-]{32,40}$/i.test(id)) {
      setVerdict({ state: "tampered", reason: "invalid id" });
      return;
    }

    let cancelled = false;
    setVerdict({ state: "loading" });

    (async () => {
      try {
        const receiptRes = await fetch(
          `${origin}/api/agent-runs/${encodeURIComponent(id)}`,
          { credentials: "omit", headers: { Accept: "application/json" } },
        );
        if (!receiptRes.ok) {
          throw new Error(`receipt-fetch-${receiptRes.status}`);
        }
        const receipt = (await receiptRes.json()) as SovereignReceiptShape;
        if (!receipt.canonical || !receipt.signature) {
          throw new Error("receipt-missing-fields");
        }

        const verifyRes = await fetch(`${origin}/api/verify`, {
          method: "POST",
          credentials: "omit",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            canonical: receipt.canonical,
            signature: receipt.signature,
          }),
        });
        if (!verifyRes.ok) throw new Error(`verify-${verifyRes.status}`);
        const verdict = (await verifyRes.json()) as SovereignVerifyShape;

        if (cancelled) return;
        if (verdict.valid) {
          setVerdict({
            state: "verified",
            agentName: receipt.agentName ?? "agent",
          });
        } else {
          setVerdict({ state: "tampered", reason: "signature mismatch" });
        }
      } catch (err) {
        if (cancelled) return;
        setVerdict({
          state: "tampered",
          reason:
            err instanceof Error ? err.message.slice(0, 32) : "unverified",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, origin]);

  const palette = THEMES[theme];

  const dotColor =
    verdict.state === "verified"
      ? palette.ok
      : verdict.state === "tampered"
        ? palette.bad
        : palette.neutral;

  const label =
    verdict.state === "verified"
      ? "Verified by Sovereign"
      : verdict.state === "tampered"
        ? "Unverified"
        : "Verifying…";

  const sub =
    verdict.state === "verified"
      ? `· ${verdict.agentName}`
      : verdict.state === "tampered"
        ? `· ${verdict.reason}`
        : "";

  const inner = (
    <>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: 9999,
          background: dotColor,
          boxShadow: `0 0 6px ${dotColor}`,
        }}
      />
      <span style={{ fontWeight: 600, letterSpacing: "0.02em" }}>{label}</span>
      {sub && (
        <span style={{ color: palette.sub, fontWeight: 400 }}>{sub}</span>
      )}
    </>
  );

  const wrapperStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 9999,
    border: `1px solid ${palette.border}`,
    background: palette.bg,
    color: palette.text,
    font: "500 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif",
    verticalAlign: "middle",
    textDecoration: "none",
  };

  const role =
    verdict.state === "loading"
      ? { role: "status" as const, "aria-live": "polite" as const }
      : {};

  if (showLink && verdict.state !== "loading") {
    return (
      <a
        href={`${origin}/r/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open verifiable receipt"
        className={className}
        style={wrapperStyle}
        data-sovereign-verify={id}
      >
        {inner}
      </a>
    );
  }

  return (
    <span
      className={className}
      style={wrapperStyle}
      data-sovereign-verify={id}
      {...role}
    >
      {inner}
    </span>
  );
}

export default SovereignBadge;
