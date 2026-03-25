"use client";

import { Globe2 } from "lucide-react";

// ⚡ SOVEREIGN MATRIX // OMNIPRESENCE COMMAND NODE ⚡
// This physically replaces an entire multi-disciplinary marketing firm
// (SEO Agency + Ad Agency + Social Media Agency) into a single Swarm interface.

export default function OmnipresenceNode() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 lg:p-8 bg-[#050505] min-h-screen">
      {/* Header */}
      <header className="border-b border-[#00B7FF]/20 pb-8 flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#00B7FF]/10 border border-[#00B7FF]/30 flex items-center justify-center">
            <Globe2 className="w-6 h-6 text-[#00B7FF]" />
          </div>
          <div>
             <h1 className="text-3xl font-serif font-bold text-white">Omnipresence Matrix</h1>
             <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest mt-1">Multi-Vector Ad & Media Domination</p>
          </div>
        </div>
      </header>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center text-center py-24 bg-white/[0.02] border border-white/5 rounded-3xl">
        <Globe2 className="w-16 h-16 text-neutral-600 mb-6" />
        <h2 className="text-xl font-bold text-white mb-3">No marketing channels connected yet</h2>
        <p className="text-sm text-neutral-500 max-w-lg mx-auto leading-relaxed">
          Connect your ad platforms to see real-time performance. Once integrated, this dashboard will display
          live metrics across Google Ads, LinkedIn, X, and programmatic SEO channels.
        </p>
      </div>
    </div>
  );
}
