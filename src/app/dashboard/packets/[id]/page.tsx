import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import { getPacketById, type PacketKind } from "@/lib/packet-store";

/**
 * /dashboard/packets/[id] — saved packet detail.
 *
 * Server-rendered, ownership-checked, restores the user-facing packet
 * dashboard *exactly* as it was the first time it ran. Output is stored
 * verbatim so re-opening costs zero LLM tokens.
 *
 * Each kind renders via its own block so the schemas can drift over
 * time without breaking older saved packets — we only touch the fields
 * we know about and skip silently when shape doesn't match.
 */

const KIND_LABEL: Record<PacketKind, string> = {
  "agency-content-packet": "Agency content packet",
  "recruiting-sourcing-sprint": "Recruiting sourcing sprint",
  "growth-pulse": "Growth pulse",
  "listing-pulse": "Listing pulse",
};

const KIND_RUN_HREF: Record<PacketKind, string> = {
  "agency-content-packet": "/playbooks/agency-content-packet",
  "recruiting-sourcing-sprint": "/playbooks/recruiting-sourcing-sprint",
  "growth-pulse": "/playbooks/growth-pulse",
  "listing-pulse": "/playbooks/realestate-listing-pulse",
};

interface KvProps {
  label: string;
  value?: string | number | null | undefined;
}
function Kv({ label, value }: KvProps) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-b-0">
      <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 shrink-0">
        {label}
      </span>
      <span className="text-[13px] text-neutral-200 text-right break-words">
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <header className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-white">{title}</h3>
        {meta ? (
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            {meta}
          </span>
        ) : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function getStr(obj: unknown, key: string): string | undefined {
  if (
    obj &&
    typeof obj === "object" &&
    key in (obj as Record<string, unknown>)
  ) {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

function getObj(
  obj: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (
    obj &&
    typeof obj === "object" &&
    key in (obj as Record<string, unknown>)
  ) {
    const v = (obj as Record<string, unknown>)[key];
    return v && typeof v === "object"
      ? (v as Record<string, unknown>)
      : undefined;
  }
  return undefined;
}

function getArr(obj: unknown, key: string): unknown[] | undefined {
  if (
    obj &&
    typeof obj === "object" &&
    key in (obj as Record<string, unknown>)
  ) {
    const v = (obj as Record<string, unknown>)[key];
    return Array.isArray(v) ? v : undefined;
  }
  return undefined;
}

export default async function PacketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  const { id } = await params;
  if (!userId) {
    redirect(`/login?redirect=/dashboard/packets/${id}`);
  }

  const packet = await getPacketById(userId, id);
  if (!packet) {
    notFound();
  }

  const seconds = (packet.durationMs / 1000).toFixed(1);
  const created = new Date(packet.createdAt);
  const createdLabel = Number.isNaN(created.getTime())
    ? packet.createdAt
    : created.toLocaleString();

  return (
    <main className="min-h-screen bg-[#030303] text-white">
      <div className="max-w-4xl mx-auto px-6 md:px-10 pt-10 pb-24">
        <Link
          href="/dashboard/packets"
          className="inline-flex items-center gap-2 text-[12px] text-neutral-500 hover:text-white uppercase tracking-widest mb-8"
        >
          <ArrowLeft className="w-3 h-3" />
          All packets
        </Link>

        <header className="mb-10">
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-3">
            {KIND_LABEL[packet.kind]} · {seconds}s · {createdLabel}
          </p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
            {clientNameFromInput(packet.input) || "Saved packet"}
          </h1>
          {packet.errorCount > 0 ? (
            <p className="mt-3 inline-flex items-center gap-2 text-[12px] text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" />
              {packet.errorCount} sub-asset{packet.errorCount === 1 ? "" : "s"}{" "}
              failed during this run.
            </p>
          ) : null}
        </header>

        {/* Inputs (always rendered — auditable record of what produced the packet) */}
        <div className="mb-8">
          <Section title="Inputs" meta="As submitted">
            <div className="space-y-0.5">
              {Object.entries(packet.input)
                .slice(0, 20)
                .map(([k, v]) => (
                  <Kv
                    key={k}
                    label={k}
                    value={
                      Array.isArray(v)
                        ? v.join(", ")
                        : typeof v === "object" && v !== null
                          ? JSON.stringify(v)
                          : (v as string | number)
                    }
                  />
                ))}
            </div>
          </Section>
        </div>

        {/* Output — vertical-specific renderer */}
        <div className="space-y-5">
          {packet.kind === "agency-content-packet" ? (
            <AgencyOutput output={packet.output} />
          ) : null}
          {packet.kind === "recruiting-sourcing-sprint" ? (
            <SourcingOutput output={packet.output} />
          ) : null}
          {packet.kind === "growth-pulse" ? (
            <GrowthOutput output={packet.output} />
          ) : null}
          {packet.kind === "listing-pulse" ? (
            <ListingOutput output={packet.output} />
          ) : null}
        </div>

        <div className="mt-12 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row gap-3">
          <Link
            href={KIND_RUN_HREF[packet.kind]}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B5532C] text-black font-semibold text-[13px] hover:bg-[#cd6234] transition-colors"
          >
            Run another {KIND_LABEL[packet.kind].toLowerCase()}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/dashboard/packets"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-[13px] text-neutral-300 hover:border-white/30 hover:text-white transition-colors"
          >
            All saved packets
          </Link>
        </div>
      </div>
    </main>
  );
}

// ─── Vertical output renderers ──────────────────────────────────────────

function clientNameFromInput(i: unknown): string | undefined {
  return (
    getStr(i, "clientName") ||
    getStr(i, "businessName") ||
    getStr(i, "companyName") ||
    getStr(i, "propertyAddress")
  );
}

function AgencyOutput({ output }: { output: unknown }) {
  const blog = getObj(output, "blog");
  const seq = getObj(output, "emailSequence");
  const ads = getArr(output, "ads");
  const comp = getObj(output, "competitor");
  return (
    <>
      {blog ? (
        <Section
          title="SEO blog post"
          meta={`${getStr(blog, "wordCount") ?? ""} words`}
        >
          <p className="text-[15px] font-semibold text-white mb-2">
            {getStr(blog, "title")}
          </p>
          <pre className="text-[13px] text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed max-h-[420px] overflow-y-auto">
            {getStr(blog, "body")}
          </pre>
        </Section>
      ) : null}
      {seq ? (
        <Section title="Email sequence" meta={getStr(seq, "sequenceName")}>
          <ul className="space-y-3">
            {getArr(seq, "emails")?.map((e, i) => (
              <li
                key={`em-${i}`}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <p className="text-[14px] font-semibold text-white mb-2">
                  {getStr(e, "subject")}
                </p>
                <p className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {getStr(e, "body")}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {ads ? (
        <Section title="Ad creatives" meta={`${ads.length} platforms`}>
          <ul className="grid md:grid-cols-3 gap-3">
            {ads.map((ad, i) => (
              <li
                key={`ad-${i}`}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C] mb-2">
                  {getStr(ad, "platform")}
                </p>
                <p className="text-[13.5px] font-semibold text-white mb-2">
                  {getStr(ad, "headline")}
                </p>
                <p className="text-[12.5px] text-neutral-300 leading-relaxed">
                  {getStr(ad, "primaryText")}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {comp ? (
        <Section title="Competitor teaser" meta={getStr(comp, "competitor")}>
          <pre className="text-[13px] text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed">
            {JSON.stringify(comp, null, 2)}
          </pre>
        </Section>
      ) : null}
    </>
  );
}

function SourcingOutput({ output }: { output: unknown }) {
  return (
    <Section title="Sourcing sprint output">
      <pre className="text-[12px] text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[640px] overflow-y-auto">
        {JSON.stringify(output, null, 2)}
      </pre>
    </Section>
  );
}

function GrowthOutput({ output }: { output: unknown }) {
  return (
    <Section title="Growth pulse output">
      <pre className="text-[12px] text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[640px] overflow-y-auto">
        {JSON.stringify(output, null, 2)}
      </pre>
    </Section>
  );
}

function ListingOutput({ output }: { output: unknown }) {
  return (
    <Section title="Listing pulse output">
      <pre className="text-[12px] text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[640px] overflow-y-auto">
        {JSON.stringify(output, null, 2)}
      </pre>
    </Section>
  );
}
