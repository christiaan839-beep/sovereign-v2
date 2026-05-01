import type { Metadata } from "next";
import Link from "next/link";
import {
  TRUST_REGISTRY,
  entriesByStatus,
  STATUS_DESCRIPTIONS,
  type TrustEntry,
} from "@/lib/trust-status";
import { ANTI_DRIFT_INVARIANTS } from "@/lib/platform-stats";

export const metadata: Metadata = {
  title: "Wiring status · Sovereign Matrix",
  description:
    "Public, auto-generated transparency table. Every R-numbered trust primitive Sovereign ships with status, source file, audit action, and test count. No vendor publishes this.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/trust/wiring-status",
  },
  openGraph: {
    title: "Wiring status — Sovereign Matrix",
    description:
      "Public transparency: which trust primitives are runtime-firing, which are library-only, which are roadmap. Cited at OWASP-grade specificity.",
    type: "website",
  },
};

/**
 * /trust/wiring-status — the procurement-grade transparency artifact.
 *
 * The thesis: most agent platforms claim defense-in-depth they don't
 * have. We publish a self-auditing table that maps every claim to a
 * source file, an audit action, and a wiring status. If a row says
 * "wired", grep finds the runtime call site. If it says "library", we
 * say so explicitly — no aspirational marketing. The anti-drift gate
 * in scripts/weekly-health.mjs (700+ invariants) breaks CI if any row
 * here drifts from the codebase.
 */

const STATUS_ICON: Record<TrustEntry["status"], string> = {
  wired: "✓",
  live: "○",
  library: "◐",
  roadmap: "—",
};

const STATUS_LABEL: Record<TrustEntry["status"], string> = {
  wired: "wired (runtime gate)",
  live: "live (public surface)",
  library: "library (not wired yet)",
  roadmap: "roadmap (not built)",
};

const STATUS_COLOR: Record<TrustEntry["status"], string> = {
  wired: "text-[#5BAB7C]",
  live: "text-[#7CA8DD]",
  library: "text-[#C9A26B]",
  roadmap: "text-[#8F8576]",
};

const STATUS_BG: Record<TrustEntry["status"], string> = {
  wired: "bg-[#3F7A5C]/15 border-[#5BAB7C]/30",
  live: "bg-[#3F6BAB]/15 border-[#7CA8DD]/30",
  library: "bg-[#A8814A]/15 border-[#C9A26B]/30",
  roadmap: "bg-[#5C544A]/15 border-[#8F8576]/30",
};

export default function WiringStatusPage() {
  const wired = entriesByStatus("wired");
  const live = entriesByStatus("live");
  const library = entriesByStatus("library");
  const roadmap = entriesByStatus("roadmap");
  const total = TRUST_REGISTRY.length;

  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      <div className="max-w-6xl mx-auto">
        {/* ─── Header ─── */}
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Trust · Wiring status · auto-generated
        </p>
        <h1 className="font-serif text-5xl lg:text-7xl leading-[1.05] tracking-tight mb-6">
          We publish
          <br />
          <em className="text-[#B5532C] not-italic">what is wired.</em>
        </h1>
        <p className="text-lg text-[#5C544A] leading-relaxed max-w-3xl mb-8">
          Most agent platforms claim defense-in-depth they don&apos;t have.
          This page maps every R-numbered trust primitive Sovereign Matrix
          ships to its source file, audit action, test count, and wiring
          status. If a row says <span className="font-mono text-[#3F7A5C]">wired</span>, a{" "}
          <code>grep</code> against the cited file finds the runtime call site.
          If a row says <span className="font-mono text-[#A8814A]">library</span>, we say so explicitly —
          no aspirational marketing. {ANTI_DRIFT_INVARIANTS}+ CI invariants in{" "}
          <code className="text-[10px] bg-white/40 px-1 rounded">scripts/weekly-health.mjs</code> break the build
          if any row here drifts from the codebase.
        </p>

        {/* ─── Summary chips ─── */}
        <div className="flex flex-wrap gap-3 mb-12">
          <SummaryChip count={wired.length} total={total} status="wired" />
          <SummaryChip count={live.length} total={total} status="live" />
          <SummaryChip count={library.length} total={total} status="library" />
          <SummaryChip count={roadmap.length} total={total} status="roadmap" />
        </div>

        {/* ─── Status legend ─── */}
        <div className="mb-14 rounded-2xl border border-[#1A1712]/10 bg-white/40 p-6">
          <h2 className="font-serif text-lg mb-4">Status semantics</h2>
          <dl className="grid md:grid-cols-2 gap-4 text-sm">
            {(["wired", "live", "library", "roadmap"] as const).map((s) => (
              <div key={s}>
                <dt className={`font-mono text-xs mb-1 ${STATUS_COLOR[s]}`}>
                  <span className="mr-2">{STATUS_ICON[s]}</span>
                  {STATUS_LABEL[s]}
                </dt>
                <dd className="text-[#5C544A] leading-snug">
                  {STATUS_DESCRIPTIONS[s]}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ─── Sections ─── */}
        <Section
          title="Wired — runtime gates"
          description="Every action passing through the platform may fire the cited audit action. Verifiable by curl, by grep, or by sovereign-inspect."
          entries={wired}
        />
        <Section
          title="Live — public surfaces"
          description="Discovery routes, open specs, and verifier endpoints. Not gates; publications. Anyone can probe them without our cooperation."
          entries={live}
        />
        <Section
          title="Library — not yet wired"
          description="Pure-function code with tests; the runtime call site does not yet exist. We publish this rather than imply it&rsquo;s firing."
          entries={library}
        />
        <Section
          title="Roadmap — declared honestly"
          description="Forthcoming work with a target. If it&rsquo;s here, it is not built yet. Time-bounded; we ship updates here as they land."
          entries={roadmap}
        />

        {/* ─── How to verify ─── */}
        <div className="mt-16 rounded-2xl border border-[#1A1712]/10 bg-white/40 p-8">
          <h2 className="font-serif text-2xl mb-4">How to verify any row above</h2>
          <ol className="space-y-3 text-sm text-[#5C544A] leading-relaxed">
            <li>
              <span className="font-mono text-xs bg-white/60 px-1.5 py-0.5 rounded mr-2">1.</span>
              Clone <a href="https://github.com/christiaan839-beep/sovereign-v2" className="text-[#B5532C] underline">github.com/christiaan839-beep/sovereign-v2</a>
            </li>
            <li>
              <span className="font-mono text-xs bg-white/60 px-1.5 py-0.5 rounded mr-2">2.</span>
              For any wired row: <code className="bg-white/60 px-1.5 py-0.5 rounded">grep -n &quot;{`<the audit action>`}&quot; src/</code> — finds the runtime call site
            </li>
            <li>
              <span className="font-mono text-xs bg-white/60 px-1.5 py-0.5 rounded mr-2">3.</span>
              For any test-counted row: <code className="bg-white/60 px-1.5 py-0.5 rounded">npx vitest run {`<the cited file path>`}</code>
            </li>
            <li>
              <span className="font-mono text-xs bg-white/60 px-1.5 py-0.5 rounded mr-2">4.</span>
              For the live public surfaces:{" "}
              <code className="bg-white/60 px-1.5 py-0.5 rounded">curl https://sovereignmatrix.agency{`<the URL>`}</code>
            </li>
            <li>
              <span className="font-mono text-xs bg-white/60 px-1.5 py-0.5 rounded mr-2">5.</span>
              Run the anti-drift gate yourself: <code className="bg-white/60 px-1.5 py-0.5 rounded">node scripts/weekly-health.mjs</code> — if all rows are honest, all {ANTI_DRIFT_INVARIANTS}+ invariants pass.
            </li>
          </ol>
        </div>

        {/* ─── Footer note ─── */}
        <p className="mt-12 text-xs text-[#8F8576] leading-relaxed max-w-3xl">
          If you find a discrepancy between this page and the running
          codebase, that is a <strong>bug</strong>, not a feature. Please
          report to{" "}
          <a href="mailto:security@sovereignmatrix.agency" className="text-[#B5532C] underline">
            security@sovereignmatrix.agency
          </a>
          . The discrepancy will be corrected within 7 days OR the row will
          be downgraded to its honest status. The full spec for this page
          format lives in{" "}
          <Link href="/docs/SOVEREIGN_TRUST_MANIFEST_SPEC.md" className="text-[#B5532C] underline">
            Sovereign Trust Manifest 1.0
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function Section({
  title,
  description,
  entries,
}: {
  title: string;
  description: string;
  entries: ReadonlyArray<TrustEntry>;
}) {
  if (entries.length === 0) return null;
  return (
    <section className="mb-14">
      <h2 className="font-serif text-2xl lg:text-3xl mb-2">
        {title}
        <span className="ml-3 font-mono text-sm text-[#8F8576]">
          ({entries.length})
        </span>
      </h2>
      <p className="text-sm text-[#5C544A] leading-relaxed mb-6 max-w-3xl">
        {description}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {entries.map((e) => (
          <EntryCard key={`${e.tag}-${e.name}`} entry={e} />
        ))}
      </div>
    </section>
  );
}

function EntryCard({ entry }: { entry: TrustEntry }) {
  return (
    <article
      className={`rounded-xl border p-5 ${STATUS_BG[entry.status]} transition-colors`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className={`font-mono text-[10px] uppercase tracking-widest ${STATUS_COLOR[entry.status]}`}>
            {entry.tag}
          </span>
          <h3 className="font-serif text-lg leading-tight mt-1">{entry.name}</h3>
        </div>
        <span className={`flex-shrink-0 font-mono text-xs ${STATUS_COLOR[entry.status]}`}>
          {STATUS_ICON[entry.status]} {STATUS_LABEL[entry.status]}
        </span>
      </div>
      <p className="text-sm text-[#5C544A] leading-relaxed mb-3">
        {entry.description}
      </p>
      <dl className="text-[11px] font-mono text-[#5C544A] leading-relaxed space-y-1">
        {entry.source !== "—" && (
          <div>
            <dt className="inline text-[#8F8576]">source: </dt>
            <dd className="inline">{entry.source}</dd>
          </div>
        )}
        {entry.auditAction && (
          <div>
            <dt className="inline text-[#8F8576]">fires: </dt>
            <dd className="inline">{entry.auditAction}</dd>
          </div>
        )}
        {entry.publicUrl && (
          <div>
            <dt className="inline text-[#8F8576]">public: </dt>
            <dd className="inline">{entry.publicUrl}</dd>
          </div>
        )}
        {typeof entry.testCount === "number" && (
          <div>
            <dt className="inline text-[#8F8576]">tests: </dt>
            <dd className="inline">{entry.testCount}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

function SummaryChip({
  count,
  total,
  status,
}: {
  count: number;
  total: number;
  status: TrustEntry["status"];
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div
      className={`px-4 py-2 rounded-full border text-sm ${STATUS_BG[status]} ${STATUS_COLOR[status]} flex items-center gap-2`}
    >
      <span className="font-mono text-xs">{STATUS_ICON[status]}</span>
      <span className="font-semibold">
        {count} {STATUS_LABEL[status].split(" ")[0]}
      </span>
      <span className="text-[#8F8576] text-xs">({pct}%)</span>
    </div>
  );
}
