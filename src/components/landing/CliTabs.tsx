"use client";

import { useState } from "react";
import { Terminal, Copy, Check } from "lucide-react";

/**
 * Tabbed CLI command display for the hero.
 *
 * Replaces the prior 3-stacked-code-blocks pattern (verify / sign /
 * witness) with a single tabbed switcher that occupies the same
 * vertical space as one code block. Reduces hero density by ~60%
 * while keeping all three procurement-grade CLIs reachable.
 *
 * Copy-to-clipboard on each command — the friction-reducer a CISO
 * actually uses when they want to paste the verify call into Slack
 * before they email us.
 *
 * Pure client component. Zero network. Server renders the default
 * tab (verify); client hydration adds the switch + copy buttons.
 */

interface Tab {
  id: string;
  label: string;
  comment: string;
  command: string;
}

const TABS: Tab[] = [
  {
    id: "verify",
    label: "verify",
    comment: "# Verify any signed bundle",
    command:
      "npx @sovereign-matrix/verifiable-receipts verify \\\n  --manifest ./bundle.json \\\n  --pubkey ./pubkey.pem",
  },
  {
    id: "sign",
    label: "sign",
    comment: "# Mint your own VAOS receipt",
    command:
      "npx @sovereign-matrix/verifiable-receipts-sign \\\n  --input ./body.json \\\n  --key ./privkey.pem",
  },
  {
    id: "witness",
    label: "witness",
    comment: "# Run an independent witness on our log",
    command:
      'npx @sovereign-matrix/verifiable-receipts-witness \\\n  --url https://sovereignmatrix.agency \\\n  --key ./witness.pem \\\n  --witness-id "Your Name · City"',
  },
];

export function CliTabs() {
  const [active, setActive] = useState(TABS[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const current = TABS.find((t) => t.id === active) ?? TABS[0];

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(current.command);
      setCopied(active);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard blocked — silently no-op; the visible command is enough */
    }
  }

  return (
    <div>
      {/* Tab row + copy button */}
      <div className="flex items-center justify-between mb-2">
        <div
          className="flex gap-1 p-1 rounded-[3px] border border-white/[0.08] bg-black/30"
          role="tablist"
          aria-label="Choose a CLI"
        >
          {TABS.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(t.id)}
                className={`px-3 py-1 font-mono text-[10px] tracking-[0.15em] uppercase rounded-[2px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
                  isActive
                    ? "bg-cyan-500/[0.12] text-cyan-300 border border-cyan-500/30"
                    : "text-neutral-500 hover:text-neutral-300 border border-transparent"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy command"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] text-neutral-500 hover:text-cyan-300 border border-white/[0.08] hover:border-cyan-500/30 rounded-[2px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
        >
          {copied === active ? (
            <>
              <Check className="w-3 h-3 text-cyan-300" />
              <span className="text-cyan-300">copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              copy
            </>
          )}
        </button>
      </div>

      {/* Command block — fixed-height container so tab switch doesn't reflow */}
      <div className="relative bg-black/40 border border-cyan-500/20 rounded-[3px] overflow-hidden">
        <pre className="px-3 py-3 overflow-x-auto font-mono text-[11px] sm:text-[12px] leading-[1.6] whitespace-pre min-h-[120px]">
          <Terminal
            className="inline w-3 h-3 text-cyan-300 mr-2 -mt-0.5"
            aria-hidden="true"
          />
          <span className="text-neutral-500">{current.comment}</span>
          {"\n"}
          <span className="text-cyan-300/95">{current.command}</span>
        </pre>
      </div>
    </div>
  );
}
