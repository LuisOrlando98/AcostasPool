import type { Customer } from "@prisma/client";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { formatUsPhone } from "@/lib/phones";
import ActionForm from "./ActionForm";
import type { CustomerDetailFormAction } from "./action-result";
import type { Translator } from "./types";

type EditCustomerModalProps = {
  t: Translator;
  customer: Customer;
  customerName: string;
  action: CustomerDetailFormAction;
};

export default function EditCustomerModal({
  t,
  customer,
  customerName,
  action,
}: EditCustomerModalProps) {
  return (
    <>
      <input id="edit-customer" type="checkbox" className="peer/profile hidden" />
      <div className="app-modal-layer fixed inset-0 z-[2200] hidden items-center justify-center overflow-y-auto p-3 sm:p-6 peer-checked/profile:flex">
        <label
          htmlFor="edit-customer"
          className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
        />
        <div className="app-modal-card relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.customers.detail.sections.profileTitle")}
                </p>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.actions.saveChanges")}
                </h2>
                <p className="text-sm text-slate-500">{customerName}</p>
              </div>
              <label
                htmlFor="edit-customer"
                className="app-modal-close"
                aria-label={t("common.actions.close")}
                title={t("common.actions.close")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </label>
            </div>
            <ActionForm action={action} className="mt-5 space-y-5">
              <input type="hidden" name="customerId" value={customer.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.firstName")}
                  </label>
                  <input
                    name="nombre"
                    defaultValue={customer.nombre}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.lastName")}
                  </label>
                  <input
                    name="apellidos"
                    defaultValue={customer.apellidos ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.email")}
                  </label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={customer.email ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.language")}
                  </label>
                  <select
                    name="idiomaPreferencia"
                    defaultValue={customer.idiomaPreferencia}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="ES">{t("common.language.es")}</option>
                    <option value="EN">{t("common.language.en")}</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.phone")}
                  </label>
                  <input
                    name="telefono"
                    defaultValue={formatUsPhone(customer.telefono) ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.phoneSecondary")}
                  </label>
                  <input
                    name="telefonoSecundario"
                    defaultValue={formatUsPhone(customer.telefonoSecundario) ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.customers.new.fields.status")}
                  </label>
                  <select
                    name="estadoCuenta"
                    defaultValue={customer.estadoCuenta}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="ACTIVE">{t("common.status.active")}</option>
                    <option value="INACTIVE">{t("common.status.inactive")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.customers.new.fields.type")}
                  </label>
                  <select
                    name="tipoCliente"
                    defaultValue={customer.tipoCliente}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="RESIDENTIAL">
                      {t("admin.customers.types.residential")}
                    </option>
                    <option value="COMMERCIAL">
                      {t("admin.customers.types.commercial")}
                    </option>
                  </select>
                </div>
              </div>

              <label className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                <input
                  type="checkbox"
                  name="allowWeekendBooking"
                  defaultChecked={Boolean(customer.allowWeekendBooking)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>{t("admin.customers.new.fields.allowWeekendBooking")}</span>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  {t("address.sectionTitle")}
                </h3>
                <div className="mt-4">
                  <AddressAutocomplete
                    defaultValue={{
                      line1: customer.direccionLinea1,
                      line2: customer.direccionLinea2,
                      city: customer.ciudad,
                      state: customer.estadoProvincia,
                      postalCode: customer.codigoPostal,
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("common.labels.notes")}
                </label>
                <textarea
                  name="notas"
                  defaultValue={customer.notas ?? ""}
                  className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                <FormSubmitButton
                  idleLabel={t("admin.customers.detail.actions.saveChanges")}
                  pendingLabel={t("admin.customers.detail.actions.saving")}
                  successLabel={t("common.feedback.saved")}
                />
              </div>
            </ActionForm>
          </div>
        </div>
      </div>
    </>
  );
}
