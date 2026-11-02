import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://www.b2bradar.pro", changeFrequency: "monthly", priority: 1 },
    { url: "https://www.b2bradar.pro/automacao", changeFrequency: "monthly", priority: 0.6 },
  ];
}
