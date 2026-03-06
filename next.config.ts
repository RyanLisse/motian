import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Allowed origins for CORS — set ALLOWED_ORIGINS env var as comma-separated list
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Server components can import DB directly
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/professionals",
        destination: "/kandidaten",
        permanent: true,
      },
      {
        source: "/professionals/:id",
        destination: "/kandidaten/:id",
        permanent: true,
      },
    ];
  },
  async headers() {
    // In dev, allow localhost; in prod, only explicitly allowed origins
    const origin =
      allowedOrigins.length > 0
        ? allowedOrigins[0]
        : process.env.NODE_ENV === "development"
          ? "http://localhost:3001"
          : "";

    if (!origin) return [];

    return [
      {
        // CORS headers for API routes — allows Chrome extension + app requests
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: origin },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Vary", value: "Origin" },
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
