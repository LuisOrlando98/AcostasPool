import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRequestLocale } from "@/i18n/server";
import {
  COMPLIANCE_DOC_DEFINITIONS,
  getComplianceDocBySlug,
} from "@/lib/compliance-config";
import { getComplianceContentConfig } from "@/lib/site-settings";

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

  const locale = await getRequestLocale();
  const isSpanish = locale === "es";
  const compliance = await getComplianceContentConfig();
  const content = compliance[docId][locale];
  const definition = COMPLIANCE_DOC_DEFINITIONS[docId];

  const paragraphs = content.body
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <article className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {definition.label}
          </p>
          <Link
            href="/legal"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            {isSpanish ? "Volver a legal" : "Back to legal"}
          </Link>
        </div>

        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{content.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{content.summary}</p>
        <p className="mt-4 text-xs text-slate-500">
          {isSpanish ? "Vigencia" : "Effective date"}: {content.effectiveDate}
        </p>

        <section className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
          {paragraphs.map((block, index) => (
            <p key={`${docId}-${index}`} className="whitespace-pre-wrap">
              {block}
            </p>
          ))}
        </section>
      </article>
    </main>
  );
}

