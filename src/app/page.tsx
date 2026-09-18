import type { Metadata } from "next";
import ClientLanding from "@/components/landing/ClientLanding";
import {
  LANDING_BUSINESS_HOURS,
  LANDING_CONTACT,
  LANDING_OG_IMAGE,
  LANDING_SERVICE_AREAS,
  LANDING_SITE_NAME,
  buildLandingMetadata,
  getLandingSiteUrl,
  toLandingAbsoluteUrl,
} from "@/lib/landing-config";
import {
  getSiteLandingConfig,
  getSiteSocialLinks,
  type SiteSocialLinks,
} from "@/lib/site-settings";

const PAGE_DESCRIPTION =
  "Immersive luxury pool maintenance experience for South Florida homes. Weekly care, chemistry control, and premium presentation.";

export const metadata: Metadata = buildLandingMetadata({
  path: "/",
  title: "Luxury Pool Maintenance in South Florida | AcostasPool",
  description: PAGE_DESCRIPTION,
  keywords: [
    "pool maintenance miami",
    "pool cleaning miami-dade",
    "pool repair doral",
    "chemical balancing pool service",
    "licensed pool technicians",
  ],
  openGraph: {
    title: "Luxury Pool Maintenance in South Florida",
    description:
      "Premium weekly service, equipment care, and crystal-clear water management for South Florida properties.",
  },
});

function buildLocalBusinessSchema(socialLinks: SiteSocialLinks) {
  const siteUrl = getLandingSiteUrl();
  const sameAs = [
    socialLinks.instagramUrl,
    socialLinks.facebookUrl,
    socialLinks.youtubeUrl,
    socialLinks.tiktokUrl,
    socialLinks.xUrl,
  ].filter((value): value is string => Boolean(value));

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#business`,
    name: LANDING_SITE_NAME,
    url: `${siteUrl}/`,
    image: toLandingAbsoluteUrl(LANDING_OG_IMAGE.src),
    logo: toLandingAbsoluteUrl("/newlogo.png"),
    telephone: LANDING_CONTACT.phoneSchema,
    email: LANDING_CONTACT.supportEmail,
    priceRange: "$$",
    description:
      "Professional pool maintenance, repairs, and water chemistry services.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Miami",
      addressRegion: "FL",
      addressCountry: "US",
    },
    areaServed: LANDING_SERVICE_AREAS.map((city) => ({ "@type": "City", name: city })),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [...LANDING_BUSINESS_HOURS.days],
        opens: LANDING_BUSINESS_HOURS.opens,
        closes: LANDING_BUSINESS_HOURS.closes,
      },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: LANDING_CONTACT.phoneSchema,
        email: LANDING_CONTACT.supportEmail,
        availableLanguage: ["English", "Spanish"],
        areaServed: "US",
      },
    ],
    serviceType: [
      "Weekly pool maintenance",
      "Water chemistry management",
      "Pool repairs",
      "One-time pool cleanups",
    ],
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/** Serializes JSON-LD safely for inline script tags (escapes `<` to avoid `</script>` breaks). */
function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function Home() {
  const [socialLinks, landingConfig] = await Promise.all([
    getSiteSocialLinks(),
    getSiteLandingConfig(),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildLocalBusinessSchema(socialLinks)) }}
      />
      <ClientLanding socialLinks={socialLinks} landingConfig={landingConfig} />
    </>
  );
}
