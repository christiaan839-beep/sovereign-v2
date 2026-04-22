/**
 * /agents/[slug]/layout.tsx — injects Article JSON-LD so search engines
 * and social-graph crawlers can parse agent pages as structured data.
 *
 * The Server Component for the page still owns <title> / <meta> via
 * generateMetadata(); this layout only adds the JSON-LD blob.
 *
 * Safety note: we escape "<" in the JSON payload to "\u003c" so a
 * hypothetical agent description containing a literal "</script>"
 * cannot escape the script tag. All fields in the JSON come from
 * server-controlled DB rows (agent_metadata is admin-seeded), but
 * belt-and-braces escaping costs nothing.
 */

import { getAgentPublic } from "@/lib/agent-catalog";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function AgentLayout({ children, params }: Props) {
  const { slug } = await params;
  const agent = await getAgentPublic(slug);

  // Fall back gracefully — if the slug is bogus, the page.tsx notFound()
  // will fire; we just skip the JSON-LD here.
  if (!agent) return <>{children}</>;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: agent.displayName,
    description:
      agent.description ??
      agent.tagline ??
      `${agent.displayName} — one of 198 agents on the Sovereign Matrix platform.`,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: agent.category,
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: (agent.pricingCents / 100).toFixed(2),
      priceCurrency: "USD",
    },
    aggregateRating:
      agent.avgRating != null && agent.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: agent.avgRating.toFixed(2),
            reviewCount: agent.reviewCount,
          }
        : undefined,
    url: `https://sovereignmatrix.agency/agents/${slug}`,
    creator: agent.creatorHandle
      ? { "@type": "Organization", name: agent.creatorHandle }
      : { "@type": "Organization", name: "Sovereign Matrix" },
  };

  // Escape "<" so a pathological value can never break out of the script
  // element. JSON spec allows \uXXXX anywhere a character is valid.
  const safeJson = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json">{safeJson}</script>
      {children}
    </>
  );
}
