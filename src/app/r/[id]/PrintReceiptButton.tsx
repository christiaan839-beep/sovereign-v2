"use client";

import { Printer } from "lucide-react";

/**
 * Triggers the browser's native print dialog. Combined with the
 * `@media print` rules in page.tsx, this saves the receipt as a clean
 * monochrome PDF with all signature evidence preserved — no server-side
 * PDF lib needed.
 */
export default function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
    >
      <Printer className="h-3.5 w-3.5" />
      Save as PDF
    </button>
  );
}
