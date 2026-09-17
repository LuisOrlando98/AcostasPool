import type { Customer } from "@prisma/client";
import { formatUsPhone } from "@/lib/phones";
import type { Translator } from "./types";

type CustomerHeroSectionProps = {
  t: Translator;
  customer: Pick<Customer, "telefono" | "estadoCuenta">;
  customerName: string;
  customerEmailLabel: string;
  portalStatusLabel: string;
  counts: {
    properties: number;
    jobs: number;
    plans: number;
    invoices: number;
  };
};

export default function CustomerHeroSection({
  t,
  customer,
  customerName,
  customerEmailLabel,
  portalStatusLabel,
  counts,
}: CustomerHeroSectionProps) {
  return (
    <div className="customers-detail-hero overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.25),_transparent_45%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-100/70">
              {t("admin.customers.detail.kicker")}
            </p>
            <h2 className="text-2xl font-semibold">{customerName}</h2>
            <p className="text-sm text-sky-100/80">{customerEmailLabel}</p>
            <p className="text-xs text-sky-100/60">
              {formatUsPhone(customer.telefono) ||
                t("admin.routes.labels.noPhone")}
            </p>
            <p className="mt-2 inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90">
              {portalStatusLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                customer.estadoCuenta === "ACTIVE"
                  ? "border-teal-300 bg-teal-500 text-white"
                  : "border-white/30 bg-white/10 text-white"
              }`}
            >
              {customer.estadoCuenta === "ACTIVE"
                ? t("common.status.active")
                : t("common.status.inactive")}
            </span>
            <label
              htmlFor="new-property"
              className="cursor-pointer rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
            >
              {t("admin.customers.detail.actions.addProperty")}
            </label>
            <label
              htmlFor="new-job"
              className="cursor-pointer rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
            >
              {t("admin.customers.detail.actions.scheduleJob")}
            </label>
            <label
              htmlFor="new-plan"
              className="cursor-pointer rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
            >
              {t("admin.customers.detail.actions.newPlan")}
            </label>
          </div>
        </div>
      </div>
      <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {t("admin.customers.detail.cards.properties")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {counts.properties}
          </p>
          <p className="text-xs text-slate-500">
            {t("admin.customers.detail.cards.propertiesHint")}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-700">
            {t("admin.customers.detail.cards.jobs")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-sky-900">
            {counts.jobs}
          </p>
          <p className="text-xs text-sky-700">
            {t("admin.customers.detail.cards.jobsHint")}
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-700">
            {t("admin.customers.detail.cards.plans")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-indigo-900">
            {counts.plans}
          </p>
          <p className="text-xs text-indigo-700">
            {t("admin.customers.detail.cards.plansHint")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {t("admin.customers.detail.cards.invoices")}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {counts.invoices}
          </p>
          <p className="text-xs text-slate-500">
            {t("admin.customers.detail.cards.invoicesHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
