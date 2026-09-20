"use client";

import { FileText } from "lucide-react";

/**
 * Small client-side button that triggers the browser's native
 * "Save as PDF" flow via window.print(). Used on legal/doc pages
 * which are otherwise server-rendered for SEO.
 *
 * The printed output is styled by the @media print block in
 * globals.css (hides nav/buttons, forces light colors, adds link refs).
 */
export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label={`${label} — triggers browser print dialog`}
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-neutral-300 hover:bg-white/[0.06] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <FileText className="w-4 h-4" />
      {label}
    </button>
  );
}
