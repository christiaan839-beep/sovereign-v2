import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/client-portal/',
        '/api/',
      ],
    },
    sitemap: 'https://sovereignmatrix.agency/sitemap.xml',
  };
}
