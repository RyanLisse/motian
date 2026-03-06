import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// CORS for /api is handled per-request in proxy.ts (all ALLOWED_ORIGINS supported)
const nextConfig: NextConfig = {
  // Server components can import DB directly
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "ryan-lisse-bv",
  project: "motian",
  silent: !process.env.CI,
  sourcemaps: { disable: process.env.NODE_ENV !== "production" },
});
