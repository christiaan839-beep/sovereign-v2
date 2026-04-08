import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://sovereignmatrix.agency";

  const pages: Array<{ path: string; priority: number; changeFreq: "daily" | "weekly" | "monthly" }> = [
    // Core pages (highest priority)
    { path: "", priority: 1.0, changeFreq: "daily" },
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

    // Competitive comparison pages (high SEO value)
    { path: "/vs/hubspot", priority: 0.9, changeFreq: "weekly" },
    { path: "/vs/clay", priority: 0.9, changeFreq: "weekly" },
    { path: "/vs/zapier", priority: 0.9, changeFreq: "weekly" },
    { path: "/vs/crewai", priority: 0.9, changeFreq: "weekly" },
    { path: "/vs/n8n", priority: 0.9, changeFreq: "weekly" },
    { path: "/vs/lindy", priority: 0.9, changeFreq: "weekly" },
    { path: "/vs/sintra", priority: 0.9, changeFreq: "weekly" },
    { path: "/vs/manus", priority: 0.9, changeFreq: "weekly" },
    { path: "/vs/relevance-ai", priority: 0.9, changeFreq: "weekly" },
    { path: "/vs/make", priority: 0.9, changeFreq: "weekly" },

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

    // Roadmap
    { path: "/roadmap", priority: 0.7, changeFreq: "weekly" },

    // Marketing pages
    { path: "/about", priority: 0.7, changeFreq: "monthly" },
    { path: "/partner", priority: 0.7, changeFreq: "monthly" },
    { path: "/blog", priority: 0.8, changeFreq: "daily" },
    { path: "/marketplace", priority: 0.8, changeFreq: "weekly" },
    { path: "/developers", priority: 0.8, changeFreq: "weekly" },
    { path: "/developers/docs", priority: 0.8, changeFreq: "weekly" },

    // Trust & transparency
    { path: "/security", priority: 0.7, changeFreq: "monthly" },
    { path: "/sla", priority: 0.6, changeFreq: "monthly" },
    { path: "/status", priority: 0.6, changeFreq: "daily" },
    { path: "/changelog", priority: 0.6, changeFreq: "weekly" },

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
