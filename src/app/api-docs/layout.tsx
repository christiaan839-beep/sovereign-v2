import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Docs — Sovereign Matrix",
  description:
    "OpenAPI 3.1 contract for the Sovereign public verification API. Five endpoints: verify, fetch receipt, latest public, recent public feed, aggregate stats. No auth, open CORS. Importable into Cursor, Postman, Insomnia, VSCode REST Client.",
  openGraph: {
    title: "Sovereign Matrix — OpenAPI 3.1 contract",
    description:
      "Five public-verification endpoints. Importable into any AI tool, IDE, or API client.",
    url: "https://sovereignmatrix.agency/api-docs",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovereign API Docs",
    description: "OpenAPI 3.1 contract for the public verification API.",
  },
  alternates: { canonical: "https://sovereignmatrix.agency/api-docs" },
};

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
