"use client";

/**
 * ManifestTools — small client island inside the otherwise
 * server-rendered SamAgentDetail page. Provides two actions that
 * genuinely need JavaScript:
 *
 *   • copy manifest JSON to the clipboard
 *   • download the manifest as a .sam.json file
 *
 * Everything else on the page is SSR — this component stays small so
 * the client-bundle cost for a marketplace detail view is minimal.
 */

import { useState } from "react";

interface Props {
  manifestJson: string;
  slug: string;
}

export function ManifestTools({ manifestJson, slug }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(manifestJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API may be unavailable (iframe, HTTP in dev, etc.).
      // Silently ignore — the download path below is the fallback.
    }
  }

  function handleDownload() {
    const blob = new Blob([manifestJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.sam.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-baseline gap-5">
      <button
        type="button"
        onClick={handleCopy}
        className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
        aria-live="polite"
      >
        {copied ? "✓ Copied" : "Copy JSON"}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
      >
        Download .sam.json
      </button>
    </div>
  );
}
