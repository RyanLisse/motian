import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Motia API runs on 3000, Next.js on 3001
  // Server components can import DB directly
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
