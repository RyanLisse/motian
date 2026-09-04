import "./src/env";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const analyzeBundles = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const hasSentryRuntimeConfig = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
);

if (process.env.NODE_ENV === "production" && hasSentryRuntimeConfig && !process.env.SENTRY_AUTH_TOKEN) {
  throw new Error(
    "SENTRY_AUTH_TOKEN is required for production builds when SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is configured, so sourcemaps upload successfully.",
  );
}

// CORS for /api is handled per-request in proxy.ts (all ALLOWED_ORIGINS supported)
const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the
  // node_modules actually imported, so the runtime image carries no pnpm store
  // and no dev dependencies (RJC-419).
  output: "standalone",
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
      // /dashboard is the common English default; this app's overview lives at /overzicht.
      {
        source: "/dashboard",
        destination: "/overzicht",
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
    minimumCacheTTL: 86_400, // Cache optimized images for 24 hours
    formats: ["image/avif", "image/webp"],
    // Company logos are scraped from multiple external sources, so the allowlist
    // must support arbitrary HTTP(S) hosts while still keeping SVG delivery safe.
    remotePatterns: [
      { protocol: "https", hostname: "**", pathname: "/**" },
      { protocol: "http", hostname: "**", pathname: "/**" },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default withSentryConfig(analyzeBundles(nextConfig), {
  org: "ryan-lisse-bv",
  project: "motian",
  silent: !process.env.CI,
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
    // Cleanup sourcemaps after upload to reduce deployment size (5-10MB saved)
    deleteSourcemapsAfterUpload: process.env.NODE_ENV === "production",
  },
  // Debug logging removal: Turbopack doesn't support webpack.treeshake.removeDebugLogging,
  // so we rely on tree-shaking to strip debug calls in production builds.
});
