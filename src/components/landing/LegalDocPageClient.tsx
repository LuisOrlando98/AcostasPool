"use client";

import Link from "next/link";
import type { ComplianceDocConfig, ComplianceDocId } from "@/lib/compliance-config";
import type { LandingSocialLinks } from "@/components/landing/LandingFooter";
import { useLandingPreferences } from "@/components/landing/useLandingPreferences";
import LegalPageChrome from "@/components/landing/LegalPageChrome";

type LegalDoc = {
  id: ComplianceDocId;
  slug: string;
  label: string;
  description: string;
  content: ComplianceDocConfig;
};

const DOC_COPY = {
  en: {
    back: "Back to legal center",
    effective: "Effective date",
    related: "Other legal documents",
  },
  es: {
    back: "Volver al centro legal",
    effective: "Fecha de vigencia",
    related: "Otros documentos legales",
  },
} as const;

export default function LegalDocPageClient({
  docs,
  currentDocId,
  socialLinks,
}: {
  docs: LegalDoc[];
  currentDocId: ComplianceDocId;
  socialLinks?: LandingSocialLinks;
}) {
  const { language, setLanguage, theme, setTheme } = useLandingPreferences();
  const copy = DOC_COPY[language];

  const currentDoc = docs.find((doc) => doc.id === currentDocId) ?? docs[0];
  const currentContent = currentDoc.content[language];
  const paragraphs = currentContent.body
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <LegalPageChrome
      language={language}
      theme={theme}
      onLanguageChange={setLanguage}
      onThemeChange={setTheme}
      socialLinks={socialLinks}
    >
      <section className="lp-section">
        <div className="lp-container grid gap-5 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,0.28fr)]">
          <article className="app-card p-6 shadow-contrast sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {currentDoc.label}
              </p>
              <Link
                href="/legal"
                className="app-button-secondary inline-flex min-h-9 items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
              >
                {copy.back}
              </Link>
            </div>

            <h1 className="mt-3 text-3xl font-semibold text-slate-900">{currentContent.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{currentContent.summary}</p>
            <p className="mt-4 text-xs text-slate-500">
              {copy.effective}: <span className="font-semibold text-slate-700">{currentContent.effectiveDate}</span>
            </p>

            <section className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
              {paragraphs.map((block, index) => (
                <p key={`${currentDoc.id}-${index}`} className="whitespace-pre-wrap">
                  {block}
                </p>
              ))}
            </section>
          </article>

          <aside className="app-card h-fit p-5 shadow-contrast xl:sticky xl:top-24">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              {copy.related}
            </h2>
            <div className="mt-3 space-y-2">
              {docs.map((doc) => {
                const selected = doc.id === currentDoc.id;
                const localized = doc.content[language];
                return (
                  <Link
                    key={doc.id}
                    href={`/legal/${doc.slug}`}
                    className={`block rounded-xl border px-3 py-3 text-left transition ${
                      selected
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                      {doc.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{localized.title}</p>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      </section>
    </LegalPageChrome>
  );
}

