import type { MetadataRoute } from "next";

const SITE_URL = "https://bijoy2unicode.jehadurre.me";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
