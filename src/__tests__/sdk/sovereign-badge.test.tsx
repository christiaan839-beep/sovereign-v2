/**
 * Tests for <SovereignBadge> — initial server-render contract.
 *
 * The badge does its real work in a useEffect (fetch receipt → POST verify
 * → set state). Effects don't run during server rendering, so server-render
 * tests cover the initial loading state, prop wiring, and SSR safety.
 *
 * The full network state machine is covered by:
 *   - /api/agent-runs/[id] tests (receipt fetch path)
 *   - /api/verify tests (HMAC validation path)
 *   - the script-tag /embed/verify.js tests (same network flow)
 *
 * Adding @testing-library/react would let us simulate effects but pulls
 * in jsdom + ~5MB of dev deps just for one component. Server-render
 * coverage is sufficient given the layered tests above.
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { SovereignBadge } from "@/sdk/react/SovereignBadge";

const VALID_ID = "00000000-0000-0000-0000-000000000001";

describe("<SovereignBadge> — server render", () => {
  it("renders the loading state on initial paint", () => {
    const html = renderToString(<SovereignBadge id={VALID_ID} />);
    expect(html).toContain("Verifying");
  });

  it("includes role=status on the loading state for accessibility", () => {
    const html = renderToString(<SovereignBadge id={VALID_ID} />);
    // role=status announces dynamic content changes to screen readers
    expect(html).toMatch(/role="status"/);
  });

  it("data-sovereign-verify carries the receipt id for selection", () => {
    const html = renderToString(<SovereignBadge id={VALID_ID} />);
    expect(html).toContain(`data-sovereign-verify="${VALID_ID}"`);
  });

  it("dark theme uses a black background", () => {
    const html = renderToString(<SovereignBadge id={VALID_ID} theme="dark" />);
    expect(html).toMatch(/background:#030303|background: ?#030303/);
  });

  it("light theme uses a white background", () => {
    const html = renderToString(<SovereignBadge id={VALID_ID} theme="light" />);
    expect(html).toMatch(/background:#ffffff|background: ?#ffffff/i);
  });

  it("renders a span (no anchor) during loading regardless of showLink", () => {
    // The link only appears AFTER verification completes — initial render
    // is always a span so screen readers don't read "verifying" as a link.
    const html = renderToString(
      <SovereignBadge id={VALID_ID} showLink={true} />,
    );
    expect(html).toMatch(/^<span/);
    expect(html).not.toMatch(/<a /);
  });

  it("custom className is forwarded to the wrapper", () => {
    const html = renderToString(
      <SovereignBadge id={VALID_ID} className="my-badge" />,
    );
    expect(html).toContain('class="my-badge"');
  });

  it("invalid id still renders (effect-time validation, never throws on render)", () => {
    expect(() =>
      renderToString(<SovereignBadge id="not-a-uuid" />),
    ).not.toThrow();
  });
});
