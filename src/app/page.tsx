import type { Metadata } from "next";
import ClientLanding from "@/components/landing/ClientLanding";

export const metadata: Metadata = {
  title: "Professional Pool Maintenance You Can Trust | AcostasPool",
  description:
    "Weekly pool service, repairs, and chemical balancing in Miami-Dade. Licensed and insured technicians with fast quote response.",
  openGraph: {
    title: "Professional Pool Maintenance You Can Trust",
    description:
      "Weekly service, equipment repairs, and water chemistry management for Miami-Dade homes.",
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
  telephone: "+1-305-555-0199",
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

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <ClientLanding />
    </>
  );
}
