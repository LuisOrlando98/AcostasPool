import Link from "next/link";
import type { Metadata } from "next";
import { getRequestLocale } from "@/i18n/server";
import {
  COMPLIANCE_DOC_DEFINITIONS,
  COMPLIANCE_DOC_IDS,
} from "@/lib/compliance-config";
import { getComplianceContentConfig } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Compliance Center | AcostasPool",
  description: "Public legal and compliance policies for AcostasPool services.",
};

export default async function LegalIndexPage() {
  const locale = await getRequestLocale();
  const compliance = await getComplianceContentConfig();
  const isSpanish = locale === "es";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            AcostasPool
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {isSpanish ? "Centro de Cumplimiento" : "Compliance Center"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isSpanish
              ? "Politicas publicas de privacidad, seguridad y operacion."
              : "Public policies for privacy, security, and operations."}
          </p>
        </div>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {COMPLIANCE_DOC_IDS.map((docId) => {
            const definition = COMPLIANCE_DOC_DEFINITIONS[docId];
            const content = compliance[docId][locale];

            return (
              <article
                key={docId}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {definition.label}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  {content.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600">{content.summary}</p>
                <p className="mt-3 text-xs text-slate-500">
                  {isSpanish ? "Vigencia" : "Effective"}: {content.effectiveDate}
                </p>
                <div className="mt-4">
                  <Link
                    href={`/legal/${definition.slug}`}
                    className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    {isSpanish ? "Ver documento" : "Read policy"}
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

