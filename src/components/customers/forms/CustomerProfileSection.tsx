import type { Customer } from "@prisma/client";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import ActionForm from "./ActionForm";
import type { CustomerDetailFormAction } from "./action-result";
import { formatUsPhone } from "@/lib/phones";
import { CustomerDetailModalTrigger } from "./CustomerDetailModals";
import type { Translator } from "./types";

type CustomerProfileSectionProps = {
  t: Translator;
  customer: Pick<
    Customer,
    | "id"
    | "telefono"
    | "telefonoSecundario"
    | "tipoCliente"
    | "idiomaPreferencia"
    | "direccionLinea1"
    | "direccionLinea2"
    | "ciudad"
    | "estadoProvincia"
    | "codigoPostal"
    | "allowWeekendBooking"
  >;
  customerName: string;
  customerEmailLabel: string;
  hasCustomerEmail: boolean;
  portalStatusLabel: string;
  portalStatusClass: string;
  inviteAction: CustomerDetailFormAction;
};

const FIELD_LABEL_CLASS =
  "text-xs font-semibold uppercase tracking-[0.2em] text-slate-500";

export default function CustomerProfileSection({
  t,
  customer,
  customerName,
  customerEmailLabel,
  hasCustomerEmail,
  portalStatusLabel,
  portalStatusClass,
  inviteAction,
}: CustomerProfileSectionProps) {
  return (
    <div className="min-w-0">
      <CollapsibleSection
        className="h-full lg:min-h-[360px]"
        title={t("admin.customers.detail.sections.profileTitle")}
        subtitle={t("admin.customers.detail.sections.profileSubtitle")}
        headerExtra={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${portalStatusClass}`}
            >
              {portalStatusLabel}
            </span>
            <CustomerDetailModalTrigger
              modal="edit-customer"
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
            >
              {t("common.actions.edit")}
            </CustomerDetailModalTrigger>
            <ActionForm action={inviteAction}>
              <input type="hidden" name="customerId" value={customer.id} />
              <button
                disabled={!hasCustomerEmail}
                title={
                  hasCustomerEmail
                    ? undefined
                    : t("admin.customers.detail.actions.inviteNeedsEmail")
                }
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  hasCustomerEmail
                    ? "border-slate-200 text-slate-600 hover:border-slate-300"
                    : "border-slate-100 text-slate-300"
                }`}
              >
                {t("admin.customers.detail.actions.sendInvite")}
              </button>
            </ActionForm>
          </div>
        }
      >
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className={FIELD_LABEL_CLASS}>
              {t("admin.customers.detail.profileFields.name")}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{customerName}</dd>
          </div>
          <div>
            <dt className={FIELD_LABEL_CLASS}>{t("common.labels.email")}</dt>
            <dd className="mt-1 text-sm text-slate-700">{customerEmailLabel}</dd>
          </div>
          <div>
            <dt className={FIELD_LABEL_CLASS}>{t("common.labels.phone")}</dt>
            <dd className="mt-1 text-sm text-slate-700">
              {formatUsPhone(customer.telefono) || t("admin.routes.labels.noPhone")}
            </dd>
          </div>
          {customer.telefonoSecundario ? (
            <div>
              <dt className={FIELD_LABEL_CLASS}>{t("common.labels.phoneSecondary")}</dt>
              <dd className="mt-1 text-sm text-slate-700">
                {formatUsPhone(customer.telefonoSecundario)}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className={FIELD_LABEL_CLASS}>{t("admin.customers.new.fields.type")}</dt>
            <dd className="mt-1 text-sm text-slate-700">
              {customer.tipoCliente === "COMMERCIAL"
                ? t("admin.customers.types.commercial")
                : t("admin.customers.types.residential")}
            </dd>
          </div>
          <div>
            <dt className={FIELD_LABEL_CLASS}>{t("common.labels.language")}</dt>
            <dd className="mt-1 text-sm text-slate-700">
              {customer.idiomaPreferencia === "EN"
                ? t("common.language.en")
                : t("common.language.es")}
            </dd>
          </div>
          <div>
            <dt className={FIELD_LABEL_CLASS}>
              {t("admin.customers.detail.profileFields.weekends")}
            </dt>
            <dd className="mt-1 text-sm text-slate-700">
              {customer.allowWeekendBooking
                ? t("admin.customers.new.fields.allowWeekendBooking")
                : t("admin.customers.detail.labels.noWeekends")}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className={FIELD_LABEL_CLASS}>
              {t("admin.customers.detail.sections.addressLabel")}
            </dt>
            <dd className="mt-1 text-sm text-slate-700">
              {customer.direccionLinea1 ? (
                <>
                  <p className="font-semibold text-slate-900">
                    {customer.direccionLinea1}
                  </p>
                  {customer.direccionLinea2 ? <p>{customer.direccionLinea2}</p> : null}
                  <p>
                    {[customer.ciudad, customer.estadoProvincia, customer.codigoPostal]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </>
              ) : (
                <p className="text-slate-500">
                  {t("admin.customers.detail.labels.noAddress")}
                </p>
              )}
            </dd>
          </div>
        </dl>
      </CollapsibleSection>
    </div>
  );
}
