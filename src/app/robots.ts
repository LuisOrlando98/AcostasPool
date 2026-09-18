import type { MetadataRoute } from "next";
import { getLandingSiteUrl } from "@/lib/landing-config";

/** Private areas of the application that must never be crawled or indexed. */
const PRIVATE_PATHS = ["/admin", "/tech", "/client", "/api", "/account"];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getLandingSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
