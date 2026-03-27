import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: "standalone" removed — incompatible with Vercel serverless deployment.
  // Only needed for Docker/self-hosted. Vercel auto-splits into lambdas.

  // TypeScript errors enforced — no silent failures in production

  // Keep Node.js-only packages out of client/edge bundles
  serverExternalPackages: [
    "@pinecone-database/pinecone",
    "twilio",
    "drizzle-orm",
    "@neondatabase/serverless",
  ],

  // Performance: compress responses
  compress: true,

  // Image optimization for external domains
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.clerk.com" },
      { protocol: "https", hostname: "**.stripe.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  // Experimental performance features
  experimental: {
    // optimizeCss requires 'critters' package — disabled until installed
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com;",
          },
        ],
      },
    ];
  },

  // Rewrites for white-label subdomain routing
  async rewrites() {
    return [
      {
        source: "/client/:clientId/:path*",
        destination: "/portal/:clientId/:path*",
      },
    ];
  },
};

export default nextConfig;
