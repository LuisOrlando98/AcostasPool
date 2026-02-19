import type { Metadata } from "next";
import AboutPageClient from "@/components/landing/AboutPageClient";
import { getSiteSocialLinks } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "About AcostasPool | South Florida Pool Maintenance Team",
  description:
    "Learn how AcostasPool delivers consistent premium pool maintenance across South Florida with clear communication and detail-focused service standards.",
};

export default async function AboutPage() {
  const socialLinks = await getSiteSocialLinks();

  return <AboutPageClient socialLinks={socialLinks} />;
}
