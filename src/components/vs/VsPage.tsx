import Link from "next/link";

export interface ComparisonRow {
  feature: string;
  competitor: string | { value: string; tone?: "good" | "bad" | "neutral" };
  sovereign: string | { value: string; tone?: "good" | "bad" | "neutral" };
}

export interface VsPageData {
  competitorName: string;
  competitorTagline: string;
  competitorCategory: string;
  competitorPriceRange: string;
  ourAngle: string;
  whoTheyServe: string;
  whoWeServe: string;
  comparison: ComparisonRow[];
  whenToPickThem: string[];
  whenToPickUs: string[];
  npmPackageHighlight: string;
  installCommand: string;
}

export function VsPage({ data }: { data: VsPageData }) {
  return (
    <div className="relative min-h-dvh bg-[#030303] text-white antialiased">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-30"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 0%, rgba(181,83,44,0.18) 0%, transparent 70%)",
        }}
      />

      <main className="relative max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">

        <div className="max-w-3xl">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-5">
            {data.competitorCategory} · comparison
          </p>
          <h1 className="font-serif text-5xl md:text-6xl leading-[1.04] tracking-[-0.02em] mb-6">
            Sovereign Matrix
            <br />
            <span className="text-neutral-500 text-4xl md:text-5xl">
              vs
            </span>{" "}
            <em className="not-italic text-[#B5532C]">{data.competitorName}</em>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] mb-3">
            {data.ourAngle}
          </p>
        </div>

        <section className="mt-16 grid md:grid-cols-2 gap-5">
          <ProfileCard
            heading={data.competitorName}
            tagline={data.competitorTagline}
            price={data.competitorPriceRange}
            serves={data.whoTheyServe}
            license="Closed-source SaaS"
            tone="muted"
          />
          <ProfileCard
            heading="Sovereign Matrix"
            tagline="Apache 2.0 receipt primitive + 6-framework regulatory exporter suite + MCP server."
            price="Free (OSS) · paid managed tier coming"
            serves={data.whoWeServe}
            license="Apache 2.0"
            tone="accent"
          />
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            Feature comparison
          </h2>
          <div className="rounded-[6px] border border-white/[0.06] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-white/[0.02] text-neutral-500 font-mono uppercase tracking-[0.14em] text-[10px]">
                <tr>
                  <th className="text-left px-4 py-3 w-[34%]">Feature</th>
                  <th className="text-left px-4 py-3">{data.competitorName}</th>
                  <th className="text-left px-4 py-3">Sovereign Matrix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.comparison.map((row) => (
                  <tr key={row.feature} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-neutral-400 font-medium">
                      {row.feature}
                    </td>
                    <td className="px-4 py-3">{renderCell(row.competitor)}</td>
                    <td className="px-4 py-3">{renderCell(row.sovereign)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-16 grid md:grid-cols-2 gap-5">
          <div className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400 mb-4">
              Pick {data.competitorName} if
            </p>
            <ul className="space-y-2.5 text-[14px] text-neutral-300 leading-[1.55]">
              {data.whenToPickThem.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="text-neutral-600 mt-0.5">
                    ·
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[6px] border border-[#B5532C]/30 bg-[#1a0f0a]/40 p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#B5532C] mb-4">
              Pick Sovereign Matrix if
            </p>
            <ul className="space-y-2.5 text-[14px] text-neutral-200 leading-[1.55]">
              {data.whenToPickUs.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="text-[#B5532C] mt-0.5">
                    ✓
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-16 rounded-[6px] border border-cyan-500/20 bg-black/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Try it now · Apache 2.0
            </p>
            <code className="text-[10px] font-mono text-cyan-300/80">
              {data.npmPackageHighlight}
            </code>
          </div>
          <pre className="px-5 py-4 overflow-x-auto font-mono text-[13px] leading-[1.6] text-cyan-300/95">
            {data.installCommand}
          </pre>
        </section>

        <section className="mt-12 mb-8 rounded-[10px] border border-[#B5532C]/20 bg-[#1a0f0a]/40 px-6 md:px-10 py-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#B5532C] mb-4">
            Both, actually
          </p>
          <h3 className="font-serif text-3xl mb-4 tracking-tight max-w-3xl">
            Sovereign Matrix is not a replacement for{" "}
            <em className="not-italic text-[#B5532C]">{data.competitorName}</em>
            &apos;s whole platform.
          </h3>
          <p className="text-[14px] text-neutral-400 leading-relaxed max-w-3xl mb-6">
            It replaces the <em>evidence generation</em> layer — the byte-
            deterministic, auditor-reproducible artifact {data.competitorName}{" "}
            produces. You still need {data.competitorName} (or your auditor
            directly) for the certification process, the relationships, and the
            insurance. But the document itself? Generate it in 3 lines of code
            for free.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#B5532C] text-white font-semibold text-[13px] rounded-[3px] hover:bg-[#C96234] transition-colors tracking-tight"
            >
              Start free
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/[0.04] text-[12px] font-mono text-neutral-600 max-w-3xl">
          Note: this page is honest about both products. We don&apos;t run hit
          pieces. {data.competitorName} is a real company solving real problems.
          We compete on the narrow slice of evidence generation where OSS
          economics give us a structural advantage.
        </footer>
      </main>
    </div>
  );
}

function renderCell(v: ComparisonRow["competitor"]) {
  if (typeof v === "string") {
    return <span className="text-neutral-300">{v}</span>;
  }
  const colorClass =
    v.tone === "good"
      ? "text-emerald-400"
      : v.tone === "bad"
        ? "text-amber-400"
        : "text-neutral-300";
  return <span className={colorClass}>{v.value}</span>;
}

function ProfileCard({
  heading,
  tagline,
  price,
  serves,
  license,
  tone,
}: {
  heading: string;
  tagline: string;
  price: string;
  serves: string;
  license: string;
  tone: "muted" | "accent";
}) {
  return (
    <div
      className={`rounded-[8px] border p-6 ${
        tone === "accent"
          ? "border-[#B5532C]/30 bg-[#1a0f0a]/40"
          : "border-white/[0.06] bg-white/[0.015]"
      }`}
    >
      <h3 className="font-serif text-[24px] mb-2 tracking-tight">{heading}</h3>
      <p className="text-[14px] text-neutral-400 leading-[1.55] mb-4">
        {tagline}
      </p>
      <dl className="space-y-2 text-[12px] font-mono">
        <Row label="Pricing" value={price} />
        <Row label="Serves" value={serves} />
        <Row label="License" value={license} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-neutral-500 uppercase tracking-[0.14em] text-[10px] min-w-[64px]">
        {label}
      </dt>
      <dd className="text-neutral-200">{value}</dd>
    </div>
  );
}
