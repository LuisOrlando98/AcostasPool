import type { Customer } from "@prisma/client";
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
      <div className="customers-panel ui-panel h-full p-4 sm:p-6 lg:min-h-[360px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {t("admin.customers.detail.sections.profileTitle")}
            </h2>
            <p className="text-xs text-slate-500">
              {t("admin.customers.detail.sections.profileSubtitle")}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${portalStatusClass}`}
            >
              {portalStatusLabel}
            </span>
          </div>
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

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t("admin.customers.detail.sections.profileLabel")}
              </p>
              <CustomerDetailModalTrigger
                modal="edit-customer"
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
              >
                {t("common.actions.edit")}
              </CustomerDetailModalTrigger>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">{customerName}</p>
            <p className="mt-1 text-xs text-slate-600">{customerEmailLabel}</p>
            <p className="text-xs text-slate-600">
              {formatUsPhone(customer.telefono) || t("admin.routes.labels.noPhone")}
            </p>
            {customer.telefonoSecundario ? (
              <p className="text-xs text-slate-500">
                {t("admin.customers.detail.labels.altPhone")}:{" "}
                {formatUsPhone(customer.telefonoSecundario)}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              {customer.tipoCliente === "COMMERCIAL"
                ? t("admin.customers.types.commercial")
                : t("admin.customers.types.residential")}
              {" | "}
              {customer.idiomaPreferencia === "EN"
                ? t("common.language.en")
                : t("common.language.es")}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {t("admin.customers.detail.sections.addressLabel")}
              </p>
              <CustomerDetailModalTrigger
                modal="edit-customer"
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
              >
                {t("common.actions.edit")}
              </CustomerDetailModalTrigger>
            </div>
            {customer.direccionLinea1 ? (
              <>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {customer.direccionLinea1}
                </p>
                {customer.direccionLinea2 ? (
                  <p className="text-sm text-slate-700">{customer.direccionLinea2}</p>
                ) : null}
                <p className="text-sm text-slate-700">
                  {[customer.ciudad, customer.estadoProvincia, customer.codigoPostal]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">{t("admin.customers.detail.labels.noAddress")}</p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {customer.allowWeekendBooking
                ? t("admin.customers.new.fields.allowWeekendBooking")
                : t("admin.customers.detail.labels.noWeekends")}
            </p>
          </article>

        </div>
      </div>
    </div>
  );
}
