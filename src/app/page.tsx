import type { Metadata } from "next";
import ClientLanding from "@/components/landing/ClientLanding";
import { getSiteSocialLinks } from "@/lib/site-settings";

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
  telephone: "+1-786-519-5059",
  priceRange: "$$",
  description:
    "Professional pool maintenance, repairs, and water chemistry services.",
  serviceType: [
    "Weekly pool maintenance",
    "Water chemistry management",
    "Pool equipment repairs",
    "One-time pool cleanups",
  ],
};

export default async function Home() {
  const socialLinks = await getSiteSocialLinks();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <ClientLanding socialLinks={socialLinks} />
    </>
  );
}

