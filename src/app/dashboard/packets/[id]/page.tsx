import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, AlertTriangle, Printer } from "lucide-react";
import { getPacketById, type PacketKind } from "@/lib/packet-store";
import { RetryAssetButton } from "@/components/dashboard/RetryAssetButton";

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
              failed during this run. Retry each below.
            </p>
          ) : null}
        </header>

        {packet.errorCount > 0 ? (
          <div className="mb-8 rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-amber-300/80 mb-3">
              Failed sub-assets · retry to re-run only the failure
            </p>
            <ul className="space-y-2">
              {(getArr(packet.output, "errors") ?? []).map((e) => {
                const asset = getStr(e, "asset") ?? "unknown";
                const message = getStr(e, "message") ?? "";
                return (
                  <li
                    key={asset}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white font-medium">
                        <span className="font-mono text-amber-200/80">
                          {asset}
                        </span>
                      </p>
                      <p className="text-[12px] text-neutral-400 leading-relaxed mt-0.5 break-words">
                        {message}
                      </p>
                    </div>
                    <RetryAssetButton packetId={packet.id} asset={asset} />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

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
            href={`/dashboard/packets/${packet.id}/print`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-[13px] text-neutral-300 hover:border-white/30 hover:text-white transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save as PDF
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
  const role = getObj(output, "role");
  const icp = getObj(output, "icp");
  const booleans = getObj(output, "booleans");
  const outreach = getObj(output, "outreach");
  const channels = getArr(output, "channels");
  const objections = getArr(output, "objections");

  return (
    <>
      {role ? (
        <div className="text-[12px] text-neutral-500 -mb-2">
          Role:{" "}
          <span className="text-neutral-300 font-mono">
            {getStr(role, "title")}
          </span>{" "}
          ·{" "}
          <span className="text-neutral-300 font-mono">
            {getStr(role, "company")}
          </span>
        </div>
      ) : null}

      {icp ? (
        <Section
          title="Ideal candidate profile"
          meta={getStr(icp, "archetype")}
        >
          <div className="grid md:grid-cols-2 gap-4 text-[12px]">
            <PillBlock
              label="Must-have signals"
              items={getArr(icp, "mustHaveSignals")}
            />
            <PillBlock
              label="Nice-to-have signals"
              items={getArr(icp, "niceToHaveSignals")}
            />
            <PillBlock label="Motivators" items={getArr(icp, "motivators")} />
            <PillBlock label="Red flags" items={getArr(icp, "redFlags")} />
          </div>
        </Section>
      ) : null}

      {booleans ? (
        <Section title="Boolean searches">
          <ul className="space-y-3">
            {(["linkedin", "googleXRay", "github"] as const).map((k) => {
              const value = getStr(booleans, k);
              if (!value) return null;
              return (
                <li
                  key={k}
                  className="rounded-xl border border-white/[0.06] bg-black/30 p-4"
                >
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C] mb-2">
                    {k === "googleXRay" ? "Google X-Ray" : k}
                  </p>
                  <pre className="text-[12.5px] font-mono text-neutral-200 whitespace-pre-wrap break-words leading-relaxed">
                    {value}
                  </pre>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {outreach ? (
        <Section title="Outreach pack">
          <div className="grid md:grid-cols-3 gap-4">
            <OutreachBlock
              label="LinkedIn DM"
              text={getStr(getObj(outreach, "linkedinDm"), "body")}
              meta={
                getNum(getObj(outreach, "linkedinDm"), "charCount")
                  ? `${getNum(getObj(outreach, "linkedinDm"), "charCount")} chars`
                  : undefined
              }
            />
            <OutreachBlock
              label="Cold email"
              subject={getStr(getObj(outreach, "coldEmail"), "subject")}
              text={getStr(getObj(outreach, "coldEmail"), "body")}
              meta={
                getNum(getObj(outreach, "coldEmail"), "wordCount")
                  ? `${getNum(getObj(outreach, "coldEmail"), "wordCount")} words`
                  : undefined
              }
            />
            <OutreachBlock
              label="Voicemail"
              text={getStr(getObj(outreach, "voicemail"), "script")}
              meta={
                getNum(getObj(outreach, "voicemail"), "estimatedSeconds")
                  ? `~${getNum(getObj(outreach, "voicemail"), "estimatedSeconds")}s`
                  : undefined
              }
            />
          </div>
        </Section>
      ) : null}

      {channels ? (
        <Section
          title="Sourcing channels"
          meta={`${channels.length} non-LinkedIn`}
        >
          <ul className="space-y-3">
            {channels.map((c, i) => (
              <li
                key={`${getStr(c, "channel")}-${i}`}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <p className="text-[14px] font-semibold text-white mb-1">
                  {i + 1}. {getStr(c, "channel")}
                </p>
                <p className="text-[13px] text-neutral-400 leading-relaxed mb-2">
                  {getStr(c, "why")}
                </p>
                <p className="text-[12px] text-emerald-300/90">
                  → {getStr(c, "firstAction")}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {objections ? (
        <Section title="Objection playbook" meta={`${objections.length} plays`}>
          <ul className="space-y-4">
            {objections.map((o, i) => (
              <li
                key={`${getStr(o, "objection")}-${i}`}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <p className="text-[13px] italic text-amber-200/80 mb-2">
                  &ldquo;{getStr(o, "objection")}&rdquo;
                </p>
                <p className="text-[13px] text-neutral-200 leading-relaxed mb-2">
                  <span className="text-neutral-500 font-mono text-[10px] uppercase tracking-wider mr-2">
                    Reply
                  </span>
                  {getStr(o, "response")}
                </p>
                <p className="text-[12px] text-neutral-400 leading-relaxed">
                  <span className="text-neutral-600 font-mono text-[10px] uppercase tracking-wider mr-2">
                    If still cold
                  </span>
                  {getStr(o, "escalation")}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

function GrowthOutput({ output }: { output: unknown }) {
  const business = getObj(output, "business");
  const seo = getObj(output, "seo");
  const socialPosts = getArr(output, "socialPosts");
  const reEngagementEmail = getObj(output, "reEngagementEmail");
  const whatsapp = getObj(output, "whatsapp");
  const offer = getObj(output, "offer");

  return (
    <>
      {business ? (
        <div className="text-[12px] text-neutral-500 -mb-2">
          {getStr(business, "name")} ·{" "}
          <span className="font-mono text-neutral-400">
            {getStr(business, "locale")} / {getStr(business, "currency")}
          </span>
        </div>
      ) : null}

      {seo ? (
        <Section
          title="Local-SEO checklist"
          meta={`${getArr(seo, "items")?.length ?? 0} items`}
        >
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-4 mb-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-amber-300/80 mb-1">
              Priority fix this month
            </p>
            <p className="text-[14px] text-white font-medium">
              {getStr(seo, "priorityFix")}
            </p>
          </div>
          <ul className="space-y-2 mb-4">
            {getArr(seo, "items")?.map((it, i) => (
              <li
                key={`${getStr(it, "task")}-${i}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-3"
              >
                <div className="flex-1">
                  <p className="text-[13.5px] text-white font-medium mb-1">
                    {getStr(it, "task")}
                  </p>
                  <p className="text-[12px] text-neutral-500 leading-relaxed">
                    {getStr(it, "why")}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-neutral-600 whitespace-nowrap shrink-0 mt-1">
                  ~{getNum(it, "estimatedMinutes")}m
                </span>
              </li>
            ))}
          </ul>
          <PillBlock
            label="Local keywords"
            items={getArr(seo, "localKeywords")}
            mono
          />
        </Section>
      ) : null}

      {socialPosts ? (
        <Section title="Social posts" meta={`${socialPosts.length} platforms`}>
          <ul className="grid md:grid-cols-2 gap-4">
            {socialPosts.map((p, i) => (
              <li
                key={`${getStr(p, "platform")}-${i}`}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C] mb-2">
                  {getStr(p, "platform")} · {getNum(p, "charCount")} chars
                </p>
                <p className="text-[13px] text-neutral-200 leading-relaxed mb-3 whitespace-pre-wrap">
                  {getStr(p, "caption")}
                </p>
                <p className="text-[11px] text-neutral-500 font-mono">
                  {getArr(p, "hashtags")?.join(" ")}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {reEngagementEmail ? (
        <Section
          title="Re-engagement email"
          meta={getStr(reEngagementEmail, "segment")}
        >
          <p className="text-[14px] font-semibold text-white mb-2">
            {getStr(reEngagementEmail, "subject")}
          </p>
          <p className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {getStr(reEngagementEmail, "body")}
          </p>
        </Section>
      ) : null}

      {whatsapp ? (
        <Section
          title="WhatsApp broadcast"
          meta={`${getNum(whatsapp, "charCount")} chars`}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
            Send to: {getStr(whatsapp, "segmentationCue")}
          </p>
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-4 mb-3">
            <p className="text-[13px] text-neutral-200 leading-relaxed whitespace-pre-wrap">
              {getStr(whatsapp, "template")}
            </p>
          </div>
          <p className="text-[12px] text-neutral-500 italic">
            Opt-out: {getStr(whatsapp, "optInDisclaimer")}
          </p>
        </Section>
      ) : null}

      {offer ? (
        <Section title="Limited-time offer card">
          <div className="rounded-xl border-2 border-[#B5532C]/30 bg-gradient-to-br from-[#B5532C]/[0.06] to-transparent p-6">
            <p className="text-2xl font-black text-white mb-2 leading-tight">
              {getStr(offer, "headline")}
            </p>
            <p className="text-[14px] text-neutral-300 leading-relaxed mb-4">
              {getStr(offer, "description")}
            </p>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-black text-[#B5532C] font-mono">
                {getStr(offer, "priceLabel")}
              </span>
              <span className="text-[12px] text-neutral-500">
                Valid until: {getStr(offer, "validUntilSuggestion")}
              </span>
            </div>
            <p className="text-[12px] font-mono text-emerald-300/90">
              → {getStr(offer, "redemptionMechanic")}
            </p>
          </div>
        </Section>
      ) : null}
    </>
  );
}

function ListingOutput({ output }: { output: unknown }) {
  const property = getObj(output, "property");
  const listing = getObj(output, "listing");
  const social = getObj(output, "social");
  const buyerEmail = getObj(output, "buyerEmail");
  const comps = getObj(output, "comps");
  const marketUpdate = getObj(output, "marketUpdate");

  return (
    <>
      {property ? (
        <div className="text-[12px] text-neutral-500 -mb-2">
          {getStr(property, "address")} ·{" "}
          <span className="font-mono text-neutral-400">
            {getStr(property, "priceLabel")}
          </span>
        </div>
      ) : null}

      {listing ? (
        <Section
          title="MLS-grade listing description"
          meta={`${getNum(listing, "wordCount")} words`}
        >
          <p className="text-[15px] font-semibold text-white mb-2">
            {getStr(listing, "headline")}
          </p>
          <p className="text-[12px] text-neutral-500 italic mb-3">
            Meta: {getStr(listing, "metaSnippet")}
          </p>
          <pre className="text-[13px] text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed">
            {getStr(listing, "body")}
          </pre>
        </Section>
      ) : null}

      {social ? (
        <Section title="Open-house social posts">
          <div className="grid md:grid-cols-3 gap-4">
            <SocialBlock
              label="Instagram"
              text={getStr(getObj(social, "instagram"), "caption")}
              hashtags={getArr(getObj(social, "instagram"), "hashtags")}
            />
            <SocialBlock
              label="Facebook"
              text={getStr(getObj(social, "facebook"), "caption")}
              hashtags={getArr(getObj(social, "facebook"), "hashtags")}
            />
            <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
                WhatsApp
              </p>
              <p className="text-[13px] text-neutral-200 leading-relaxed mb-3 whitespace-pre-wrap">
                {getStr(getObj(social, "whatsapp"), "message")}
              </p>
              <p className="text-[11px] text-neutral-500 italic leading-relaxed">
                Send to: {getStr(getObj(social, "whatsapp"), "segmentationCue")}
              </p>
            </div>
          </div>
        </Section>
      ) : null}

      {buyerEmail ? (
        <Section title="Buyer-list email" meta={getStr(buyerEmail, "segment")}>
          <p className="text-[14px] font-semibold text-white mb-2">
            {getStr(buyerEmail, "subject")}
          </p>
          <p className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {getStr(buyerEmail, "body")}
          </p>
        </Section>
      ) : null}

      {comps ? (
        <Section
          title="Comparable analysis"
          meta={`${getArr(comps, "comps")?.length ?? 0} comps`}
        >
          <ul className="space-y-3 mb-4">
            {getArr(comps, "comps")?.map((c, i) => (
              <li
                key={`${getStr(c, "descriptor")}-${i}`}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <p className="text-[13.5px] text-white font-medium mb-1">
                  {getStr(c, "descriptor")}
                </p>
                <p className="text-[12px] text-neutral-500 mb-2 font-mono">
                  {getStr(c, "soldOrListed")}
                </p>
                <p className="text-[12.5px] text-neutral-300 leading-relaxed">
                  <span className="text-neutral-500">Difference: </span>
                  {getStr(c, "differentiator")}
                </p>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-amber-300/80 mb-1">
              Positioning note
            </p>
            <p className="text-[13px] text-neutral-200 leading-relaxed">
              {getStr(comps, "positioningNote")}
            </p>
          </div>
        </Section>
      ) : null}

      {marketUpdate ? (
        <Section title="Suburb market update">
          <p className="text-[15px] font-semibold text-white mb-4 leading-snug">
            {getStr(marketUpdate, "headline")}
          </p>
          <ul className="space-y-2 mb-4">
            {getArr(marketUpdate, "bullets")?.map((b, i) => (
              <li
                key={`mu-${i}`}
                className="flex items-start gap-2 text-[13px] text-neutral-300"
              >
                <span className="text-[#B5532C] font-bold shrink-0 mt-0.5">
                  {i + 1}.
                </span>
                <span className="leading-relaxed">{String(b)}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
              Voice-note opener
            </p>
            <p className="text-[13px] text-neutral-200 italic leading-relaxed">
              &ldquo;{getStr(marketUpdate, "voiceNoteOpener")}&rdquo;
            </p>
          </div>
        </Section>
      ) : null}
    </>
  );
}

// ─── Small leaf components ─────────────────────────────────────────────

function PillBlock({
  label,
  items,
  mono,
}: {
  label: string;
  items: unknown[] | undefined;
  mono?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
        {label}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <li
            key={`${i}-${String(item).slice(0, 12)}`}
            className={`text-[12px] px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-neutral-300 ${mono ? "font-mono" : ""}`}
          >
            {String(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutreachBlock({
  label,
  text,
  subject,
  meta,
}: {
  label: string;
  text: string | undefined;
  subject?: string;
  meta?: string;
}) {
  if (!text) return null;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C] mb-2">
        {label}
        {meta ? ` · ${meta}` : ""}
      </p>
      {subject ? (
        <p className="text-[13.5px] font-semibold text-white mb-2">{subject}</p>
      ) : null}
      <p className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}

function SocialBlock({
  label,
  text,
  hashtags,
}: {
  label: string;
  text: string | undefined;
  hashtags: unknown[] | undefined;
}) {
  if (!text) return null;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C] mb-2">
        {label}
      </p>
      <p className="text-[13px] text-neutral-200 leading-relaxed mb-3 whitespace-pre-wrap">
        {text}
      </p>
      <p className="text-[11px] text-neutral-500 font-mono">
        {hashtags?.map(String).join(" ")}
      </p>
    </div>
  );
}

function getNum(obj: unknown, key: string): number | undefined {
  if (
    obj &&
    typeof obj === "object" &&
    key in (obj as Record<string, unknown>)
  ) {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === "number" ? v : undefined;
  }
  return undefined;
}
