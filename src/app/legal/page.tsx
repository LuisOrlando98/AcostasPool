import type { Metadata } from "next";
import LegalIndexPageClient from "@/components/landing/LegalIndexPageClient";
import {
  COMPLIANCE_DOC_DEFINITIONS,
  COMPLIANCE_DOC_IDS,
} from "@/lib/compliance-config";
import { getComplianceContentConfig, getSiteSocialLinks } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Legal Center | AcostasPool",
  description: "Public legal policies for AcostasPool services.",
};

export default async function LegalIndexPage() {
  const [compliance, socialLinks] = await Promise.all([
    getComplianceContentConfig(),
    getSiteSocialLinks(),
  ]);

  const docs = COMPLIANCE_DOC_IDS.map((docId) => {
    const definition = COMPLIANCE_DOC_DEFINITIONS[docId];
    return {
      id: docId,
      slug: definition.slug,
      label: definition.label,
      description: definition.description,
      content: compliance[docId],
    };
  });

  return <LegalIndexPageClient docs={docs} socialLinks={socialLinks} />;
}

