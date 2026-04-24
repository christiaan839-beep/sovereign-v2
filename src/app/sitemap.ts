import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://sovereignmatrix.agency";

  const pages: Array<{ path: string; priority: number; changeFreq: "daily" | "weekly" | "monthly" }> = [
    // Core pages (highest priority)
    { path: "", priority: 1.0, changeFreq: "daily" },
    { path: "/marketplace", priority: 0.9, changeFreq: "daily" },
    { path: "/intelligence", priority: 0.85, changeFreq: "weekly" },
    { path: "/pricing", priority: 0.9, changeFreq: "weekly" },
    { path: "/onboarding", priority: 0.9, changeFreq: "monthly" },
    { path: "/docs", priority: 0.9, changeFreq: "weekly" },
    { path: "/enterprise", priority: 0.9, changeFreq: "weekly" },
    { path: "/for-agencies", priority: 0.9, changeFreq: "weekly" },

    // Product pages
    { path: "/showcase", priority: 0.8, changeFreq: "weekly" },
    { path: "/playground", priority: 0.8, changeFreq: "monthly" },
    { path: "/developer", priority: 0.8, changeFreq: "weekly" },
    { path: "/whitepaper", priority: 0.8, changeFreq: "monthly" },
    { path: "/app", priority: 0.8, changeFreq: "monthly" },
    { path: "/chat", priority: 0.8, changeFreq: "monthly" },

    // Positioning pages (owned narrative)
    { path: "/built-with-claude", priority: 0.9, changeFreq: "weekly" },

    // Use case pages
    { path: "/use-cases/second-brain", priority: 0.8, changeFreq: "monthly" },
    { path: "/use-cases/lead-gen", priority: 0.8, changeFreq: "monthly" },
    { path: "/use-cases/content-engine", priority: 0.8, changeFreq: "monthly" },

    // Free tools (high conversion)
    { path: "/free/competitor-scan", priority: 0.9, changeFreq: "monthly" },
    { path: "/free/seo-audit", priority: 0.9, changeFreq: "monthly" },
    { path: "/free/lead-finder", priority: 0.9, changeFreq: "monthly" },

    // Integrations
    { path: "/integrations", priority: 0.8, changeFreq: "monthly" },

    // Demo
    { path: "/demo", priority: 0.9, changeFreq: "monthly" },

    // Roadmap
    { path: "/roadmap", priority: 0.7, changeFreq: "weekly" },

    // Launch
    { path: "/launch", priority: 1.0, changeFreq: "weekly" },

    // Sector pages — 10 live industries
    { path: "/for-healthcare", priority: 0.8, changeFreq: "monthly" },
    { path: "/for-legal", priority: 0.8, changeFreq: "monthly" },
    { path: "/for-realestate", priority: 0.8, changeFreq: "monthly" },
    { path: "/for-recruiting", priority: 0.8, changeFreq: "monthly" },
    { path: "/for-cybersecurity", priority: 0.8, changeFreq: "monthly" },
    { path: "/for-education", priority: 0.8, changeFreq: "monthly" },
    { path: "/for-fintech", priority: 0.8, changeFreq: "monthly" },
    { path: "/for-ecommerce", priority: 0.8, changeFreq: "monthly" },
    { path: "/for-insurance", priority: 0.85, changeFreq: "monthly" },
    { path: "/for-logistics", priority: 0.85, changeFreq: "monthly" },
    { path: "/for-agriculture", priority: 0.85, changeFreq: "monthly" },
    { path: "/for-construction", priority: 0.85, changeFreq: "monthly" },
    { path: "/for-manufacturing", priority: 0.75, changeFreq: "monthly" },
    { path: "/for-government", priority: 0.75, changeFreq: "monthly" },

    // Competitive positioning + live metrics
    { path: "/compare", priority: 0.9, changeFreq: "weekly" },
    { path: "/benchmarks", priority: 0.85, changeFreq: "daily" },
    { path: "/status/slo", priority: 0.8, changeFreq: "daily" },

    // Developer surface — OpenAPI + error taxonomy + webhook verification
    { path: "/developers/api-explorer", priority: 0.85, changeFreq: "weekly" },
    { path: "/docs/errors", priority: 0.8, changeFreq: "monthly" },
    { path: "/docs/webhooks/verify", priority: 0.8, changeFreq: "monthly" },

    // Contact
    { path: "/contact", priority: 0.7, changeFreq: "monthly" },

    // Marketing pages
    { path: "/about", priority: 0.7, changeFreq: "monthly" },
    { path: "/partner", priority: 0.7, changeFreq: "monthly" },
    { path: "/blog", priority: 0.8, changeFreq: "daily" },
    { path: "/developers", priority: 0.8, changeFreq: "weekly" },
    { path: "/developers/docs", priority: 0.8, changeFreq: "weekly" },

    // Trust & transparency
    { path: "/security", priority: 0.7, changeFreq: "monthly" },
    { path: "/sla", priority: 0.6, changeFreq: "monthly" },
    { path: "/status", priority: 0.6, changeFreq: "daily" },
    { path: "/changelog", priority: 0.6, changeFreq: "weekly" },
    { path: "/trust", priority: 0.7, changeFreq: "monthly" },

    // Platform surfaces (operator + procurement)
    { path: "/platform/status", priority: 0.8, changeFreq: "daily" },
    { path: "/platform/trust", priority: 0.85, changeFreq: "monthly" },

    // Marketplace depth (buyer entry points beyond the homepage)
    { path: "/marketplace/search", priority: 0.9, changeFreq: "daily" },
    { path: "/marketplace/leaderboard", priority: 0.85, changeFreq: "daily" },

    // Spec + creator acquisition
    { path: "/spec/agent-manifest", priority: 0.85, changeFreq: "monthly" },
    { path: "/developers/build-an-agent", priority: 0.9, changeFreq: "weekly" },
    { path: "/creators/apply", priority: 0.85, changeFreq: "weekly" },

    // Legal
    { path: "/privacy", priority: 0.5, changeFreq: "monthly" },
    { path: "/terms", priority: 0.5, changeFreq: "monthly" },
    { path: "/dpa", priority: 0.5, changeFreq: "monthly" },
    { path: "/unsubscribe", priority: 0.3, changeFreq: "monthly" },

    // Auth
    { path: "/login", priority: 0.4, changeFreq: "monthly" },
    { path: "/signup", priority: 0.5, changeFreq: "monthly" },
  ];

  return pages.map(({ path, priority, changeFreq }) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date().toISOString(),
    changeFrequency: changeFreq,
    priority,
  }));
}
