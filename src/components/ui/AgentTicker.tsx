"use client";

/**
 * Live Agent Activity Ticker — Infinite-scrolling marquee showing
 * simulated real-time agent activity. Creates the visceral feeling
 * that autonomous agents are working RIGHT NOW.
 */

const ACTIVITIES = [
  { agent: "Lead Agent", action: "found 12 prospects in Austin, TX", time: "3s ago", color: "#10B981" },
  { agent: "Content Writer", action: "deployed blog post (1,487 words)", time: "8s ago", color: "#3B82F6" },
  { agent: "SEO Dominator", action: "identified 47 keyword gaps", time: "12s ago", color: "#F59E0B" },
  { agent: "Voice Agent", action: "completed 3 qualifying calls", time: "18s ago", color: "#EF4444" },
  { agent: "God Brain", action: "synthesized multi-agent strategy", time: "24s ago", color: "#8B5CF6" },
  { agent: "Competitor Radar", action: "detected pricing change at rival.io", time: "31s ago", color: "#06B6D4" },
  { agent: "Ghost Fleet", action: "sent 48 outbound emails (92% delivered)", time: "38s ago", color: "#10B981" },
  { agent: "Page Builder", action: "deployed landing page variant B", time: "45s ago", color: "#F97316" },
  { agent: "NemoClaw", action: "scraped 200 company profiles", time: "52s ago", color: "#76B900" },
  { agent: "Morpheus Shield", action: "blocked 2 jailbreak attempts", time: "58s ago", color: "#EF4444" },
  { agent: "Smart Router", action: "routed 1,247 tasks across 8 models", time: "1m ago", color: "#00B7FF" },
  { agent: "PII Guard", action: "redacted 14 sensitive fields", time: "1m ago", color: "#A855F7" },
];

function TickerItem({ agent, action, time, color }: typeof ACTIVITIES[number]) {
  return (
    <div className="flex items-center gap-3 px-5 py-2 shrink-0">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute h-full w-full rounded-full opacity-50" style={{ backgroundColor: color }} />
        <span className="relative rounded-full h-1.5 w-1.5" style={{ backgroundColor: color }} />
      </span>
      <span className="text-[11px] whitespace-nowrap">
        <span className="font-semibold text-white">{agent}</span>
        <span className="text-neutral-500 mx-1.5">{action}</span>
        <span className="text-neutral-600 font-mono text-[10px]">{time}</span>
      </span>
    </div>
  );
}

export function AgentTicker() {
  return (
    <div className="relative w-full overflow-hidden border-y border-white/[0.04] bg-[#030303]/80 backdrop-blur-xl">
      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#010101] to-transparent z-10 pointer-events-none" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#010101] to-transparent z-10 pointer-events-none" />

      <div className="flex animate-[ticker_60s_linear_infinite]">
        {/* Double the items for seamless loop */}
        {[...ACTIVITIES, ...ACTIVITIES].map((item, i) => (
          <TickerItem key={i} {...item} />
        ))}
      </div>
    </div>
  );
}
