// Server component for emitting JSON-LD structured data.
// Uses children pattern since JSON.stringify of a typed object literal
// is XSS-safe — there is no user input path.

type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

export function JsonLd({ data }: JsonLdProps) {
  return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}

// Helper: generate a BreadcrumbList for a route hierarchy.
// Pass [{name, url}, ...] in order from root to current page.
export function breadcrumbSchema(crumbs: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/**
 * Service schema for a vertical playbook (agency packet, sourcing
 * sprint, growth pulse, listing pulse). Renders as a Service offering
 * by Sovereign Matrix to a specific audience type.
 */
export function playbookServiceSchema(args: {
  name: string;
  description: string;
  url: string;
  audienceType: string;
  priceLow: number;
  priceHigh: number;
  priceCurrency: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: args.name,
    description: args.description,
    url: args.url,
    provider: {
      "@type": "Organization",
      name: "Sovereign Matrix",
      url: "https://sovereignmatrix.agency",
    },
    audience: {
      "@type": "Audience",
      audienceType: args.audienceType,
    },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: args.priceCurrency,
      lowPrice: String(args.priceLow),
      highPrice: String(args.priceHigh),
    },
  };
}
