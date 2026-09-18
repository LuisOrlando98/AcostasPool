"use client";

import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { useI18n } from "@/i18n/client";
import { formatUsPhone } from "@/lib/phones";
import ActionForm from "./ActionForm";
import CustomerDetailFormModal from "./CustomerDetailFormModal";
import type { CustomerDetailFormAction } from "./action-result";
import type { EditCustomerFields } from "./edit-customer-fields";

type EditCustomerModalProps = {
  customer: EditCustomerFields;
  customerName: string;
  action: CustomerDetailFormAction;
};

export default function EditCustomerModal({
  customer,
  customerName,
  action,
}: EditCustomerModalProps) {
  const { t } = useI18n();

  return (
    <CustomerDetailFormModal
      modal="edit-customer"
      kicker={t("admin.customers.detail.sections.profileTitle")}
      title={t("admin.customers.detail.actions.saveChanges")}
      subtitle={customerName}
    >
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
    </CustomerDetailFormModal>
  );
}
