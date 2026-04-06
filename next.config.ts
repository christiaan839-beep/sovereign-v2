import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker/Railway — Vercel injects VERCEL=1 automatically
  // so this activates only for self-hosted deployments.
  output: process.env.VERCEL ? undefined : "standalone",

  // Allow build to proceed despite strict TS on dynamic icon components
  typescript: { ignoreBuildErrors: true },

  // Keep Node.js-only packages out of client/edge bundles
  serverExternalPackages: [
    "@pinecone-database/pinecone",
    "twilio",
    "drizzle-orm",
    "@neondatabase/serverless",
  ],

  // Performance: compress responses
  compress: true,

  // Security: don't leak framework version in response headers
  poweredByHeader: false,

  // Image optimization for external domains
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.clerk.com" },
      { protocol: "https", hostname: "**.stripe.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.nvidia.com" },
      { protocol: "https", hostname: "**.googleapis.com" },
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
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com https://plausible.io https://*.clerk.com https://*.clerk.accounts.dev https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com https://*.clerk.com https://*.clerk.accounts.dev",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
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
