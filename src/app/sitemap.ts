import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = "https://sovereignmatrix.agency";

    // Core public pages (high priority)
    const coreRoutes = [
        { path: "", priority: 1.0, changeFrequency: "weekly" as const },
        { path: "/pricing", priority: 0.9, changeFrequency: "weekly" as const },
        { path: "/demo", priority: 0.9, changeFrequency: "monthly" as const },
        { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
        { path: "/partner", priority: 0.8, changeFrequency: "monthly" as const },
        { path: "/case-studies", priority: 0.8, changeFrequency: "monthly" as const },
        { path: "/blog", priority: 0.8, changeFrequency: "weekly" as const },
        { path: "/docs", priority: 0.7, changeFrequency: "weekly" as const },
        { path: "/developer", priority: 0.7, changeFrequency: "monthly" as const },
        { path: "/showcase", priority: 0.7, changeFrequency: "monthly" as const },
        { path: "/roi", priority: 0.7, changeFrequency: "monthly" as const },
        { path: "/scan", priority: 0.6, changeFrequency: "monthly" as const },
        { path: "/status", priority: 0.5, changeFrequency: "daily" as const },
        { path: "/login", priority: 0.4, changeFrequency: "yearly" as const },
        { path: "/onboarding", priority: 0.6, changeFrequency: "monthly" as const },
    ];

    // Legal pages
    const legalRoutes = [
        { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
        { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    ];

    // Dashboard pages (lower priority — behind auth, but indexable for SEO)
    const dashboardRoutes = [
        "agent-builder", "agent-command", "agent-world", "agent-hq",
        "agency-hub", "agent-analytics", "competitor", "audit-destroy",
        "capability-matrix", "client-portal", "flywheel", "avatar",
        "content-factory", "billing", "cyber-audit", "build", "canvas",
        "edify-forge", "arsenal", "designer", "deepfake-studio",
        "holographic-agent", "marketplace", "library", "nim-arsenal",
        "god-eye", "live-terminal", "leads", "integrations",
        "nemo-claw", "omnipresence", "morpheus-shield", "inbox",
        "omni-search", "ghost-protocol", "leaderboard", "page-builder",
        "scheduled", "podcast", "seo-dominator", "sovereign-ai",
        "support-router", "vsl-hacker", "system-status", "war-room",
        "workflows", "templates", "voice-swarm", "visual-studio",
        "voice-assistant", "automations", "settings",
    ].map(slug => ({
        path: `/dashboard/${slug}`,
        priority: 0.4,
        changeFrequency: "weekly" as const,
    }));

    const allRoutes = [...coreRoutes, ...legalRoutes, ...dashboardRoutes];

    return allRoutes.map((route) => ({
        url: `${baseUrl}${route.path}`,
        lastModified: new Date().toISOString(),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
    }));
}
