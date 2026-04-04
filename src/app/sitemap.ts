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

    // Marketing pages
    { path: "/about", priority: 0.7, changeFreq: "monthly" },
    { path: "/case-studies", priority: 0.7, changeFreq: "weekly" },
    { path: "/partner", priority: 0.7, changeFreq: "monthly" },
    { path: "/roi", priority: 0.7, changeFreq: "monthly" },
    { path: "/scan", priority: 0.7, changeFreq: "monthly" },
    { path: "/blog", priority: 0.7, changeFreq: "daily" },
    { path: "/locations", priority: 0.6, changeFreq: "monthly" },

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
  ];

  return pages.map(({ path, priority, changeFreq }) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date().toISOString(),
    changeFrequency: changeFreq,
    priority,
  }));
}
