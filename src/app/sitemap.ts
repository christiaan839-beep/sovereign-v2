import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = "https://sovereignmatrix.agency";

    const routes = [
        "",
        "/pricing",
        "/demo",
        "/partner",
        "/about",
        "/case-studies",
        "/privacy",
        "/terms",
    ];

    return routes.map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date().toISOString(),
        changeFrequency: "weekly" as const,
        priority: route === "" ? 1.0 : 0.8,
    }));
}
