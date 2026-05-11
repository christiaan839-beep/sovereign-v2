import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  Users,
  Globe,
  Home,
  AlertTriangle,
} from "lucide-react";
import {
  getPacketsForUser,
  type PacketKind,
  type PacketRow,
} from "@/lib/packet-store";

/**
 * /dashboard/packets — saved packet history.
 *
 * Server-rendered. Lists the caller's most recent 25 packet runs across
 * all four verticals, newest first. Each row links to the detail page.
 */

const KIND_META: Record<
  PacketKind,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
  }
> = {
  "agency-content-packet": {
    label: "Agency content packet",
    icon: Briefcase,
    tone: "text-amber-300",
  },
  "recruiting-sourcing-sprint": {
    label: "Recruiting sourcing sprint",
    icon: Users,
    tone: "text-cyan-300",
  },
  "growth-pulse": {
    label: "Growth pulse",
    icon: Globe,
    tone: "text-emerald-300",
  },
  "listing-pulse": {
    label: "Listing pulse",
    icon: Home,
    tone: "text-violet-300",
  },
};

const KIND_HREF: Record<PacketKind, string> = {
  "agency-content-packet": "/playbooks/agency-content-packet",
  "recruiting-sourcing-sprint": "/playbooks/recruiting-sourcing-sprint",
  "growth-pulse": "/playbooks/growth-pulse",
  "listing-pulse": "/playbooks/realestate-listing-pulse",
};

function clientNameFromInput(p: PacketRow): string {
  const i = p.input as Record<string, unknown>;
  return (
    (i.clientName as string | undefined) ||
    (i.businessName as string | undefined) ||
    (i.companyName as string | undefined) ||
    (i.propertyAddress as string | undefined) ||
    "Untitled run"
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86_400)}d ago`;
}

export default async function PacketsListPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login?redirect=/dashboard/packets");
  }

  const packets = await getPacketsForUser(userId, { limit: 25 });

  return (
    <main className="min-h-screen bg-[#030303] text-white">
      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-12 pb-20">
        <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-3">
              Saved runs · {packets.length}
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
              Your packet history
            </h1>
            <p className="text-[14px] text-neutral-400 mt-2 max-w-xl">
              Every packet you&apos;ve generated. Click any row to re-open the
              full deliverables — output is stored verbatim, no LLM re-charge.
            </p>
          </div>
          <Link
            href="/playbooks"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B5532C] text-black font-semibold text-[13px] hover:bg-[#cd6234] transition-colors whitespace-nowrap self-start md:self-end"
          >
            New packet
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </header>

        {packets.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {packets.map((p) => {
              const meta = KIND_META[p.kind];
              const Icon = meta.icon;
              const name = clientNameFromInput(p);
              const seconds = (p.durationMs / 1000).toFixed(1);
              return (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/packets/${p.id}`}
                    className="flex items-center gap-4 px-5 py-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04] transition-colors"
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${meta.tone}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">
                        {name}
                      </p>
                      <p className="text-[12px] text-neutral-500 truncate">
                        {meta.label} · {seconds}s · {relativeTime(p.createdAt)}
                      </p>
                    </div>
                    {p.errorCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                        <AlertTriangle className="w-3 h-3" />
                        {p.errorCount} fail
                      </span>
                    ) : null}
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 md:p-16 text-center">
      <p className="text-[12px] font-mono uppercase tracking-[0.2em] text-neutral-600 mb-4">
        No packets yet
      </p>
      <p className="text-[15px] text-neutral-400 mb-6 max-w-md mx-auto leading-relaxed">
        Generate your first packet from one of the four cornerstone playbooks.
        Every run is saved here, browsable forever, no re-charge.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {(Object.keys(KIND_HREF) as PacketKind[]).map((kind) => {
          const meta = KIND_META[kind];
          const Icon = meta.icon;
          return (
            <Link
              key={kind}
              href={KIND_HREF[kind]}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-neutral-200 hover:border-white/[0.2] hover:bg-white/[0.06] transition-colors"
            >
              <Icon className={`w-3.5 h-3.5 ${meta.tone}`} />
              {meta.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
