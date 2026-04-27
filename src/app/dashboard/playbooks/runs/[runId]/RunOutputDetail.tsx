"use client";

/**
 * <RunOutputDetail> — collapsible per-node output viewer for the
 * forensic detail page.
 *
 * Used inside a server component (the run detail page), so this is a
 * small client island just for the disclosure interaction. Renders a
 * truncation banner when the store clipped the output above 32KB on
 * insert.
 */

import { useState } from "react";

interface RunOutputDetailProps {
  output: unknown;
  /** True when the store wrapped the output as { __truncated, __preview, __originalBytes }. */
  truncated: boolean;
}

export function RunOutputDetail({ output, truncated }: RunOutputDetailProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-neutral-500 hover:text-neutral-300"
        aria-expanded={open}
      >
        {open ? "▼ Hide output" : "▶ View output"}
      </button>

      {open && (
        <div className="mt-2">
          {truncated && (
            <div className="mb-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
              <strong>Output truncated.</strong> The store clips per-node outputs
              over 32KB to keep run history rows manageable. The preview below is
              the first 4KB of the original payload (
              {(output as { __originalBytes?: number }).__originalBytes?.toLocaleString() ??
                "?"}{" "}
              bytes).
            </div>
          )}
          <pre className="overflow-auto rounded bg-black/40 p-2 text-[11px] text-neutral-300 max-h-64">
            {JSON.stringify(output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
