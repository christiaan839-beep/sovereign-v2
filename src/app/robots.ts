import { MetadataRoute } from "next";

/**
 * robots.txt — block private surfaces, allow everything else, and
 * explicitly allow the public-discovery API endpoints so AI agents
 * + procurement search can index them.
 *
 * The default `/api/` disallow was too broad — it hid our public
 * OpenAPI contract, Postman collection, MCP manifest, and the
 * receipt-verifier endpoint from crawlers and AI-agent discovery.
 * Listing them under `allow` overrides the path prefix because
 * Google's robots-rule resolver picks the longest matching pattern.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/api/openapi.json",
        "/api/postman.json",
        "/api/verify",
        "/api/agent-runs/latest-public",
        "/api/agent-runs/recent-public",
        "/api/stats/public",
      ],
      disallow: ["/dashboard/", "/client-portal/", "/api/"],
    },
    sitemap: "https://sovereignmatrix.agency/sitemap.xml",
  };
}
