import { createMDX } from "fumadocs-mdx/next";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  turbopack: {
    root: join(__dirname, ".."),
  },
  async rewrites() {
    return [
      {
        destination: "/llms.mdx/docs/:path*",
        source: "/docs/:path*.mdx",
      },
    ];
  },
};

export default withMDX(config);
