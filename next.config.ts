import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// CORS for /api is handled per-request in proxy.ts (all ALLOWED_ORIGINS supported)
const nextConfig: NextConfig = {
  // Server components can import DB directly
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      {
        source: "/opdrachten/:path*",
        destination: "/vacatures/:path*",
        permanent: true,
      },
      {
        source: "/opdrachten",
        destination: "/vacatures",
        permanent: true,
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
  // Performance optimizations (swcMinify is default in Next.js 16)
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    optimizeCss: true,
    // Client-side router cache: reduce unnecessary SSR invocations
    staleTimes: {
      dynamic: 30, // Cache dynamic pages for 30s on client
      static: 300, // Cache static pages for 5min on client
    },
  },
  images: {
    // Limit image optimization compute: only optimize common widths
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 3600, // Cache optimized images for 1 hour (default 60s)
    formats: ["image/webp"], // Skip avif (slower to encode, more compute)
  },
};

export default withSentryConfig(nextConfig, {
  org: "ryan-lisse-bv",
  project: "motian",
  silent: !process.env.CI,
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
    // Cleanup sourcemaps after upload to reduce deployment size (5-10MB saved)
    deleteSourcemapsAfterUpload: process.env.NODE_ENV === "production",
  },
  disableLogger: process.env.NODE_ENV === "production",
});
