import type { Metadata } from "next";
import ClientLanding from "@/components/landing/ClientLanding";
import { getSiteLandingConfig, getSiteSocialLinks } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Luxury Pool Maintenance in South Florida | AcostasPool",
  description:
    "Immersive luxury pool maintenance experience for South Florida homes. Weekly care, chemistry control, and premium presentation.",
  openGraph: {
    title: "Luxury Pool Maintenance in South Florida",
    description:
      "Premium weekly service, equipment care, and crystal-clear water management for South Florida properties.",
    type: "website",
  },
  keywords: [
    "pool maintenance miami",
    "pool cleaning miami-dade",
    "pool repair doral",
    "chemical balancing pool service",
    "licensed pool technicians",
  ],
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "AcostasPool",
  areaServed: ["Miami", "Kendall", "Doral", "Homestead", "Cutler Bay"],
  telephone: "+1-786-793-0081",
  priceRange: "$$",
  description:
    "Professional pool maintenance, repairs, and water chemistry services.",
  serviceType: [
    "Weekly pool maintenance",
    "Water chemistry management",
    "Pool repairs",
    "One-time pool cleanups",
  ],
};

export default async function Home() {
  const [socialLinks, landingConfig] = await Promise.all([
    getSiteSocialLinks(),
    getSiteLandingConfig(),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <ClientLanding socialLinks={socialLinks} landingConfig={landingConfig} />
    </>
  );
}

