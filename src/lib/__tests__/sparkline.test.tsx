/**
 * Sparkline — tests via React's renderToString.
 *
 * The component is pure SVG with no hooks/effects, so we can render
 * it server-side, parse the output string, and assert on attributes
 * without spinning up a DOM.
 *
 * What we verify:
 *   - Empty / single-point input → "needs ≥2 runs" placeholder
 *   - Multi-point input → SVG with one circle per point + a polyline
 *   - Status drives dot color (semantic info — must be wired right)
 *   - Median dashed reference line is present
 *   - aria-label is set for screen readers
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  Sparkline,
  type SparklinePoint,
} from "@/components/playbook/Sparkline";

const COMPLETED_DOT_FILL = '#34d399';
const FAILED_DOT_FILL = '#fb7185';
const RUNNING_DOT_FILL = '#fbbf24';

function pts(...specs: Array<[number, "completed" | "failed" | "running"]>): SparklinePoint[] {
  return specs.map(([value, status]) => ({ value, status }));
}

describe("<Sparkline>", () => {
  it("renders the placeholder text when there are 0 or 1 points", () => {
    const empty = renderToString(<Sparkline points={[]} />);
    expect(empty).toContain("needs ≥2 runs");

    const single = renderToString(<Sparkline points={pts([100, "completed"])} />);
    expect(single).toContain("needs ≥2 runs");
  });

  it("renders an SVG with one circle per point on multi-point input", () => {
    const html = renderToString(
      <Sparkline
        points={pts([100, "completed"], [200, "completed"], [150, "failed"])}
      />,
    );
    // 3 circles for 3 points.
    const circleCount = (html.match(/<circle /g) ?? []).length;
    expect(circleCount).toBe(3);
    // Polyline connects them.
    expect(html).toContain("<polyline");
  });

  it("colors dots by status (semantic — must be wired correctly)", () => {
    const html = renderToString(
      <Sparkline
        points={pts(
          [100, "completed"],
          [200, "failed"],
          [150, "running"],
        )}
      />,
    );
    expect(html).toContain(`fill="${COMPLETED_DOT_FILL}"`);
    expect(html).toContain(`fill="${FAILED_DOT_FILL}"`);
    expect(html).toContain(`fill="${RUNNING_DOT_FILL}"`);
  });

  it("includes a median reference line as a dashed stroke", () => {
    const html = renderToString(
      <Sparkline points={pts([100, "completed"], [200, "completed"])} />,
    );
    expect(html).toContain('stroke-dasharray="2 3"');
  });

  it("sets the aria-label on the SVG root for screen readers", () => {
    const html = renderToString(
      <Sparkline
        points={pts([100, "completed"], [200, "completed"])}
        ariaLabel="My run trend"
      />,
    );
    expect(html).toContain('aria-label="My run trend"');
  });

  it("falls back to a default aria-label when none provided", () => {
    const html = renderToString(
      <Sparkline points={pts([100, "completed"], [200, "completed"])} />,
    );
    expect(html).toContain('aria-label="trend chart"');
  });

  it("never throws on degenerate input (all same value)", () => {
    // When max === min, the y-axis math is undefined unless we
    // explicitly handle it. The component should center the line at
    // height/2 rather than NaN-ing.
    expect(() =>
      renderToString(
        <Sparkline
          points={pts(
            [100, "completed"],
            [100, "completed"],
            [100, "completed"],
          )}
        />,
      ),
    ).not.toThrow();
  });

  it("respects custom width", () => {
    const html = renderToString(
      <Sparkline
        points={pts([100, "completed"], [200, "completed"])}
        width={400}
      />,
    );
    expect(html).toContain('width="400"');
  });
});
