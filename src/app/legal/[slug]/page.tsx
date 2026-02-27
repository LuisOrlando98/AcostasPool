import { notFound } from "next/navigation";
import type { Metadata } from "next";
import LegalDocPageClient from "@/components/landing/LegalDocPageClient";
import { getRequestLocale } from "@/i18n/server";
import {
  COMPLIANCE_DOC_DEFINITIONS,
  COMPLIANCE_DOC_IDS,
  getComplianceDocBySlug,
} from "@/lib/compliance-config";
import { getComplianceContentConfig, getSiteSocialLinks } from "@/lib/site-settings";

type LegalDocPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: LegalDocPageProps): Promise<Metadata> {
  const resolved = await params;
  const docId = getComplianceDocBySlug(resolved.slug);
  if (!docId) {
    return {
      title: "Policy Not Found | AcostasPool",
    };
  }

  const locale = await getRequestLocale();
  const compliance = await getComplianceContentConfig();
  const content = compliance[docId][locale];

  return {
    title: `${content.title} | AcostasPool`,
    description: content.summary,
  };
}

export default async function LegalDocPage({ params }: LegalDocPageProps) {
  const resolved = await params;
  const docId = getComplianceDocBySlug(resolved.slug);
  if (!docId) {
    notFound();
  }

  const [compliance, socialLinks] = await Promise.all([
    getComplianceContentConfig(),
    getSiteSocialLinks(),
  ]);

  const docs = COMPLIANCE_DOC_IDS.map((id) => {
    const definition = COMPLIANCE_DOC_DEFINITIONS[id];
    return {
      id,
      slug: definition.slug,
      label: definition.label,
      description: definition.description,
      content: compliance[id],
    };
  });

  return (
    <LegalDocPageClient docs={docs} currentDocId={docId} socialLinks={socialLinks} />
  );
}

