import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Motia API runs on 3000, Next.js on 3001
  // Server components can import DB directly
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        // CORS headers for API routes — allows Chrome extension requests
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "ryan-lisse-bv",
  project: "motian",
  silent: !process.env.CI,
  sourcemaps: { disable: process.env.NODE_ENV !== "production" },
});
