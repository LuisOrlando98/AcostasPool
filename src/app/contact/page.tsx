import type { Metadata } from "next";
import ContactPageClient from "@/components/landing/ContactPageClient";
import { getSiteSocialLinks } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Contact AcostasPool | South Florida Pool Maintenance",
  description:
    "Contact AcostasPool for premium weekly pool maintenance, equipment diagnostics, and chemistry management in South Florida.",
};

export default async function ContactPage() {
  const socialLinks = await getSiteSocialLinks();

  return <ContactPageClient socialLinks={socialLinks} />;
}
