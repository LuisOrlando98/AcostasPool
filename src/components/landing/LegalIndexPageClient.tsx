"use client";

import Link from "next/link";
import type { ComplianceDocConfig, ComplianceDocId } from "@/lib/compliance-config";
import { useLandingPreferences } from "@/components/landing/useLandingPreferences";
import type { LandingSocialLinks } from "@/components/landing/LandingFooter";
import LegalPageChrome from "@/components/landing/LegalPageChrome";

type LegalIndexDoc = {
  id: ComplianceDocId;
  slug: string;
  label: string;
  description: string;
  content: ComplianceDocConfig;
};

const INDEX_COPY = {
  en: {
    kicker: "AcostasPool legal center",
    title: "Legal and compliance policies",
    subtitle:
      "Review our current policies for privacy, service terms, billing, and operational limits.",
    summaryTitle: "Document summary",
    effective: "Effective",
    action: "Read policy",
  },
  es: {
    kicker: "Centro legal de AcostasPool",
    title: "Politicas legales y de cumplimiento",
    subtitle:
      "Consulta nuestras politicas vigentes sobre privacidad, terminos del servicio, pagos y limites operativos.",
    summaryTitle: "Resumen del documento",
    effective: "Vigencia",
    action: "Ver politica",
  },
} as const;

export default function LegalIndexPageClient({
  docs,
  socialLinks,
}: {
  docs: LegalIndexDoc[];
  socialLinks?: LandingSocialLinks;
}) {
  const { language, setLanguage, theme, setTheme } = useLandingPreferences();
  const copy = INDEX_COPY[language];

  return (
    <LegalPageChrome
      language={language}
      theme={theme}
      onLanguageChange={setLanguage}
      onThemeChange={setTheme}
      socialLinks={socialLinks}
    >
      <section className="lp-section">
        <div className="lp-container">
          <article className="app-card p-6 shadow-contrast">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{copy.kicker}</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{copy.title}</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">{copy.subtitle}</p>
          </article>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {docs.map((doc) => {
              const localized = doc.content[language];
              return (
                <article key={doc.id} className="app-card p-5 shadow-contrast">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {doc.label}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">{localized.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">{doc.description}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {copy.summaryTitle}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{localized.summary}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <p className="text-xs text-slate-500">
                      {copy.effective}: <span className="font-semibold text-slate-700">{localized.effectiveDate}</span>
                    </p>
                    <Link
                      href={`/legal/${doc.slug}`}
                      className="app-button-secondary inline-flex min-h-9 items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
                    >
                      {copy.action}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </LegalPageChrome>
  );
}

