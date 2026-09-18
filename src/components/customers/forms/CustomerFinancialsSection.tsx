import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { CustomerDetailModalTrigger } from "./CustomerDetailModals";
import type { Translator } from "./types";

/** Datos de cobro que se muestran en la ficha, ya serializados. */
export type CustomerFinancialsSummary = {
  planName: string | null;
  paymentMethod: string | null;
  servicePrice: number | null;
  paymentDay: number | null;
  paymentType: string | null;
  propertiesCount: number;
};

type CustomerFinancialsSectionProps = {
  t: Translator;
  summary: CustomerFinancialsSummary;
  formatCurrency: (value: number) => string;
};

const FIELD_LABEL_CLASS =
  "text-xs font-semibold uppercase tracking-[0.2em] text-slate-500";

export default function CustomerFinancialsSection({
  t,
  summary,
  formatCurrency,
}: CustomerFinancialsSectionProps) {
  const notAvailable = t("common.labels.notAvailable");

  return (
    <div className="min-w-0">
      <CollapsibleSection
        className="h-full lg:min-h-[360px]"
        title={t("admin.customers.detail.sections.financialsTitle")}
        subtitle={t("admin.customers.detail.sections.financialsSubtitle")}
        headerExtra={
          <CustomerDetailModalTrigger
            modal="edit-customer-financials"
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
          >
            {t("common.actions.edit")}
          </CustomerDetailModalTrigger>
        }
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className={FIELD_LABEL_CLASS}>
              {t("admin.customers.detail.financials.fields.plan")}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {summary.planName ?? notAvailable}
            </p>
            <p className={`mt-4 ${FIELD_LABEL_CLASS}`}>
              {t("admin.customers.detail.financials.fields.paymentMethod")}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {summary.paymentMethod
                ? t(
                    `admin.customers.detail.financials.paymentMethods.${summary.paymentMethod}`
                  )
                : notAvailable}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className={FIELD_LABEL_CLASS}>
              {t("admin.invoices.servicePayment.fields.servicePrice")}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {summary.servicePrice != null
                ? formatCurrency(summary.servicePrice)
                : notAvailable}
            </p>
            <p className={`mt-4 ${FIELD_LABEL_CLASS}`}>
              {t("admin.invoices.servicePayment.fields.paymentDay")}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {summary.paymentDay
                ? t("admin.invoices.servicePayment.dayOfMonth", {
                    day: String(summary.paymentDay),
                  })
                : notAvailable}
            </p>
            <p className={`mt-4 ${FIELD_LABEL_CLASS}`}>
              {t("admin.invoices.servicePayment.fields.paymentType")}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {summary.paymentType
                ? t(
                    `admin.invoices.servicePayment.paymentTypes.${summary.paymentType}`
                  )
                : notAvailable}
            </p>
          </article>
        </div>
        {summary.propertiesCount > 1 ? (
          <p className="mt-3 text-xs text-slate-500">
            {t("admin.customers.detail.financials.multiPropertyHint")}
          </p>
        ) : null}
        {summary.propertiesCount === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            {t("admin.customers.detail.financials.noPropertyHint")}
          </p>
        ) : null}
      </CollapsibleSection>
    </div>
  );
}
