// Server component for emitting JSON-LD structured data.
// Uses children pattern since JSON.stringify of a typed object literal
// is XSS-safe — there is no user input path.

type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script type="application/ld+json">
      {JSON.stringify(data)}
    </script>
  );
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
