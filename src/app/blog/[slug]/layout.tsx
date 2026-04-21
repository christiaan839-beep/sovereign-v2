import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

/**
 * Blog post layout — emits BreadcrumbList + Article publisher schema.
 *
 * Article-level metadata (title, description, publishedAt) is set per-page
 * via each post's `generateMetadata()` export. This layout handles the
 * structural schema that is constant across all blog posts.
 */

const publisherSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://sovereignmatrix.agency/#org",
  name: "Sovereign Matrix",
  url: "https://sovereignmatrix.agency",
  logo: {
    "@type": "ImageObject",
    url: "https://sovereignmatrix.agency/logo.png",
  },
  sameAs: [
    "https://twitter.com/sovereignmatrix",
    "https://linkedin.com/company/sovereign-matrix",
  ],
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "Blog", url: "https://sovereignmatrix.agency/blog" },
  { name: "Article", url: "https://sovereignmatrix.agency/blog" },
]);

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={publisherSchema} />
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
