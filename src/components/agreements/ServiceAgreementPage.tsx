import Link from "next/link";
import {
  SERVICE_AGREEMENT_CLAUSES,
  SERVICE_AGREEMENT_EXECUTIVE_SUMMARY,
  SERVICE_AGREEMENT_FEATURES,
  SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN,
  SERVICE_AGREEMENT_INITIAL_GUARANTEE,
  SERVICE_AGREEMENT_INTERNAL_SOURCES,
  SERVICE_AGREEMENT_LOGOS,
  SERVICE_AGREEMENT_META,
  SERVICE_AGREEMENT_PLAN_PRICING,
  SERVICE_AGREEMENT_PLUS_PLAN,
  SERVICE_AGREEMENT_REFERENCES,
  SERVICE_AGREEMENT_VALUE_PROPS,
} from "@/lib/service-agreement-content";

type ServiceAgreementPageProps = {
  canonicalPath: "/admin/agreement-service";
};

export default function ServiceAgreementPage({
  canonicalPath,
}: ServiceAgreementPageProps) {
  const generatedAt = new Date().toLocaleDateString("es-US");
  const categoryLabel: Record<(typeof SERVICE_AGREEMENT_LOGOS)[number]["category"], string> = {
    brand: "Brand",
    platform: "Platform",
    infrastructure: "Infrastructure",
    operation: "Operation",
  };

  return (
    <section className="bg-[linear-gradient(180deg,#f3f8ff_0%,#f7fbff_46%,#f8fafc_100%)] px-4 py-8 text-slate-800 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-[1200px] space-y-6">
        <section className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-[0_24px_80px_rgba(8,35,77,0.08)]">
          <div className="border-b border-sky-100 bg-[linear-gradient(120deg,#061939,#0d2f66_48%,#16528f)] px-6 py-8 text-white sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/90">
              Presentacion Comercial y Contractual
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {SERVICE_AGREEMENT_META.title}
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-sky-100/90 sm:text-base">
              {SERVICE_AGREEMENT_META.subtitle}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-sky-100/90">
              <span className="rounded-full border border-white/25 px-3 py-1">
                {SERVICE_AGREEMENT_META.documentVersion}
              </span>
              <span className="rounded-full border border-white/25 px-3 py-1">
                {SERVICE_AGREEMENT_META.preparedBy}
              </span>
              <span className="rounded-full border border-white/25 px-3 py-1">
                {SERVICE_AGREEMENT_META.publicationDateLabel}: {generatedAt}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/api/service-agreement/pdf"
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-900 transition hover:bg-sky-50"
              >
                Descargar PDF Ejecutivo
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-transparent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/10"
              >
                Solicitar Reunion Comercial
              </Link>
            </div>
          </div>

          <div className="grid gap-5 px-6 py-6 sm:px-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <article className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Resumen Ejecutivo
              </h2>
              {SERVICE_AGREEMENT_EXECUTIVE_SUMMARY.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-slate-600">
                  {paragraph}
                </p>
              ))}
            </article>
            <aside className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                Propuesta de Valor
              </h3>
              <ul className="mt-3 space-y-2">
                {SERVICE_AGREEMENT_VALUE_PROPS.map((item) => (
                  <li key={item} className="text-sm text-slate-600">
                    {item}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">
              Matriz de Logos (23)
            </h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
              {SERVICE_AGREEMENT_LOGOS.length} logos integrados
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Identidad visual y ecosistema operativo presentado para propuesta
            comercial. Incluye logos de marca, plataforma, infraestructura y
            operacion, con enfasis en Wyxloop Dev y el lockup AcostasPool usado
            en invoice.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {SERVICE_AGREEMENT_LOGOS.map((logo) => (
              <article
                key={logo.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: logo.accentHex }}
                />
                <div className="flex items-center gap-3">
                  {logo.imageSrc ? (
                    <div className="flex h-14 w-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
                      <img
                        src={logo.imageSrc}
                        alt={`${logo.name} logo`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xs font-bold uppercase text-white"
                      style={{ backgroundColor: logo.accentHex }}
                    >
                      {logo.short}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {logo.name}
                    </p>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      {categoryLabel[logo.category]}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            Cobertura Funcional de la Plataforma
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Vista integral de funcionalidades disponibles para operacion
            administrativa, tecnica y de cliente final.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {SERVICE_AGREEMENT_FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <h3 className="text-sm font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{feature.summary}</p>
                <ul className="mt-3 space-y-1.5">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="text-xs leading-6 text-slate-600">
                      - {bullet}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            Garantia Inicial y Planes de Continuidad
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Estructura economica y de soporte posterior a la entrega oficial del
            sistema, presentada para evaluacion comercial del cliente.
          </p>

          <article className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-emerald-900">
              {SERVICE_AGREEMENT_INITIAL_GUARANTEE.title}
            </h3>
            <p className="mt-2 text-sm leading-7 text-emerald-900/90">
              {SERVICE_AGREEMENT_INITIAL_GUARANTEE.summary}
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {SERVICE_AGREEMENT_INITIAL_GUARANTEE.supportScope.map((item) => (
                <li key={item} className="text-sm text-emerald-900/90">
                  - {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-6 text-emerald-900/80">
              {SERVICE_AGREEMENT_INITIAL_GUARANTEE.transitionNote}
            </p>
          </article>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-900">
                {SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.summary}
              </p>
              <ul className="mt-3 space-y-1.5">
                {SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.includedInfrastructure.map(
                  (item) => (
                    <li key={item} className="text-sm text-slate-600">
                      - {item}
                    </li>
                  )
                )}
              </ul>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                {SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.importantNote}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-900">
                {SERVICE_AGREEMENT_PLUS_PLAN.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {SERVICE_AGREEMENT_PLUS_PLAN.summary}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-800">
                Incluye
              </p>
              <ul className="mt-1 space-y-1.5">
                {SERVICE_AGREEMENT_PLUS_PLAN.includedServices.map((item) => (
                  <li key={item} className="text-sm text-slate-600">
                    - {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-800">
                No incluye
              </p>
              <ul className="mt-1 space-y-1.5">
                {SERVICE_AGREEMENT_PLUS_PLAN.exclusions.map((item) => (
                  <li key={item} className="text-sm text-slate-600">
                    - {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <article className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-900">
              Importancia Operativa del Plan Plus
            </h3>
            <ul className="mt-2 space-y-1.5">
              {SERVICE_AGREEMENT_PLUS_PLAN.businessRationale.map((item) => (
                <li key={item} className="text-sm leading-7 text-slate-600">
                  - {item}
                </li>
              ))}
            </ul>
          </article>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[540px] w-full border-collapse">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em]">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em]">
                    Ano 1
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em]">
                    Ano 2 en adelante
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {SERVICE_AGREEMENT_PLAN_PRICING.map((row) => (
                  <tr key={row.plan} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">
                      {row.plan}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{row.year1}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {row.year2Plus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            Estructura Contractual Recomendada
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Secciones base para contrato de prestacion de servicio SaaS y
            operacion continua.
          </p>
          <div className="mt-5 space-y-4">
            {SERVICE_AGREEMENT_CLAUSES.map((clause) => (
              <article
                key={clause.title}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-800">
                  {clause.title}
                </h3>
                <div className="mt-2 space-y-2">
                  {clause.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-7 text-slate-600">
                      {paragraph}
                    </p>
                  ))}
                </div>
                {clause.bullets ? (
                  <ul className="mt-2 space-y-1">
                    {clause.bullets.map((bullet) => (
                      <li key={bullet} className="text-sm text-slate-600">
                        - {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900">
            Referencias de Estructura y Cumplimiento
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Referencias Externas Revisadas
              </h3>
              <ul className="mt-3 space-y-3">
                {SERVICE_AGREEMENT_REFERENCES.map((reference) => (
                  <li key={reference.url} className="text-sm text-slate-600">
                    <p className="font-semibold text-slate-800">{reference.label}</p>
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-700 underline underline-offset-2"
                    >
                      {reference.url}
                    </a>
                    <p className="mt-1 text-xs leading-6 text-slate-500">{reference.note}</p>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Fuentes Internas de Producto
              </h3>
              <ul className="mt-3 space-y-3">
                {SERVICE_AGREEMENT_INTERNAL_SOURCES.map((reference) => (
                  <li key={`${reference.label}-${reference.url}`} className="text-sm text-slate-600">
                    <p className="font-semibold text-slate-800">{reference.label}</p>
                    <p className="text-xs text-slate-500">{reference.url}</p>
                    <p className="mt-1 text-xs leading-6 text-slate-500">{reference.note}</p>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold uppercase tracking-[0.12em]">
            Aviso Legal
          </p>
          <p className="mt-2 leading-7">
            Este material es una base comercial y operativa para evaluacion del
            servicio. El texto contractual final debe ser validado por asesoria
            legal de ambas partes antes de firma.
          </p>
          <p className="mt-2 text-xs text-amber-800">
            Ruta canonica: {canonicalPath}
          </p>
        </section>
      </div>
    </section>
  );
}
