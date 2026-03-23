import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// CORS for /api is handled per-request in proxy.ts (all ALLOWED_ORIGINS supported)
const nextConfig: NextConfig = {
  // Server components can import DB directly
  serverExternalPackages: ["pg"],
  turbopack: {
    root: process.cwd(),
  },
  // Performance optimizations (swcMinify is default in Next.js 16)
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    optimizeCss: true,
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
