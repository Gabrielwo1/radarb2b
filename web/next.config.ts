import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // A landing virou a página inicial; o sistema fica em /app
  async redirects() {
    return [{ source: "/landing", destination: "/", permanent: true }];
  },
  // Dados fixos da landing mudam uma vez por mês: cache de 1 dia no navegador e na CDN
  async headers() {
    return [{
      source: "/dados/:arquivo*",
      headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
    }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
