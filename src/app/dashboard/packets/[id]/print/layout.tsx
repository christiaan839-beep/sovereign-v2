/**
 * Bare layout for the print page so it can render its own <html> /
 * <head> / <body> with print-only styles, without the root layout's
 * dark chrome, Clerk provider, scripts, and analytics.
 *
 * Note: Next.js 16 allows nested layouts to render their own document
 * structure when the parent layout's <html>/<body> are bypassed. The
 * print page returns the full document; this layout just passes
 * through.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
