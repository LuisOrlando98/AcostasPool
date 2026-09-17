import type { MetadataRoute } from "next";
import { COMPLIANCE_DOC_DEFINITIONS, COMPLIANCE_DOC_IDS } from "@/lib/compliance-config";
import { getLandingSiteUrl } from "@/lib/landing-config";

/*
 * Public pages only. Localized routes (/es/...) are not implemented yet: the
 * language is a client-side preference, so every URL is listed once.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getLandingSiteUrl();
  const now = new Date();

  const legalDocs: MetadataRoute.Sitemap = COMPLIANCE_DOC_IDS.map((docId) => {
    const definition = COMPLIANCE_DOC_DEFINITIONS[docId];
    return {
      url: `${siteUrl}/legal/${definition.slug}`,
      lastModified: new Date(definition.defaults.en.effectiveDate),
      changeFrequency: "yearly",
      priority: 0.3,
    };
  });

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/legal`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    ...legalDocs,
  ];
}
