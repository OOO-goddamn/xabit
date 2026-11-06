import type { NextConfig } from "next";

// GitHub Pages serves a fully static site: no Next.js server, no rewrites.
// The workflow sets STATIC_EXPORT/PAGES_BASE_PATH, while Docker and local
// development keep the standalone build with the /api proxy.
const isStaticExport = process.env.STATIC_EXPORT === "true";
const basePath = process.env.PAGES_BASE_PATH || undefined;
const apiUrl = (process.env.API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  basePath,
  trailingSlash: isStaticExport,
  images: isStaticExport ? { unoptimized: true } : undefined,
  // Cache Components (and PPR) requires a Next.js server, so static export
  // falls back to plain prerendering.
  cacheComponents: !isStaticExport,
  partialPrefetching: !isStaticExport,
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(isStaticExport
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${apiUrl}/api/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
