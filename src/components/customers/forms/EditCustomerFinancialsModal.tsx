"use client";

import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { useI18n } from "@/i18n/client";
import { PAYMENT_METHOD_VALUES } from "@/lib/customers/financial-info";
import { SERVICE_PAYMENT_TYPE_VALUES } from "@/lib/customers/service-payment-info";
import ActionForm from "./ActionForm";
import CustomerDetailFormModal from "./CustomerDetailFormModal";
import type { CustomerDetailFormAction } from "./action-result";
import type { ServiceTierOption } from "./types";

/** Propiedad que factura el autopago (la primera del cliente), ya serializada. */
export type PrimaryPropertyFields = {
  id: string;
  address: string;
  serviceStartDate: string | null;
  paymentDay: number | null;
  servicePrice: number | null;
  paymentType: string | null;
  paymentNotes: string | null;
};

type EditCustomerFinancialsModalProps = {
  customerId: string;
  customerName: string;
  contractedServiceTierId: string | null;
  paymentMethod: string | null;
  tierOptions: ServiceTierOption[];
  primaryProperty: PrimaryPropertyFields | null;
  action: CustomerDetailFormAction;
};

const LABEL_CLASS = "text-xs font-semibold uppercase tracking-wider text-slate-500";
const INPUT_CLASS = "mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm";
const SELECT_CLASS = `${INPUT_CLASS} bg-white`;

export default function EditCustomerFinancialsModal({
  customerId,
  customerName,
  contractedServiceTierId,
  paymentMethod,
  tierOptions,
  primaryProperty,
  action,
}: EditCustomerFinancialsModalProps) {
  const { t } = useI18n();

  return (
    <CustomerDetailFormModal
      modal="edit-customer-financials"
      kicker={t("admin.customers.detail.sections.financialsTitle")}
      title={t("admin.customers.detail.actions.saveChanges")}
      subtitle={customerName}
    >
      <ActionForm action={action} className="mt-5 space-y-5">
        <input type="hidden" name="customerId" value={customerId} />
        <input
          type="hidden"
          name="primaryPropertyId"
          value={primaryProperty?.id ?? ""}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="financials-plan">
              {t("admin.customers.detail.financials.fields.plan")}
            </label>
            <select
              id="financials-plan"
              name="contractedServiceTierId"
              defaultValue={contractedServiceTierId ?? ""}
              className={SELECT_CLASS}
            >
              <option value="">{t("common.labels.notAvailable")}</option>
              {tierOptions.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="financials-payment-method">
              {t("admin.customers.detail.financials.fields.paymentMethod")}
            </label>
            <select
              id="financials-payment-method"
              name="paymentMethod"
              defaultValue={paymentMethod ?? ""}
              className={SELECT_CLASS}
            >
              <option value="">{t("common.labels.notAvailable")}</option>
              {PAYMENT_METHOD_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`admin.customers.detail.financials.paymentMethods.${value}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-sm font-semibold text-slate-800">
            {t("admin.invoices.servicePayment.sectionTitle")}
          </p>
          {primaryProperty ? (
            <>
              <p className="mt-1 text-xs text-slate-500">
                {t("admin.customers.detail.financials.primaryPropertyHint", {
                  address: primaryProperty.address,
                })}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS} htmlFor="financials-start-date">
                    {t("admin.invoices.servicePayment.fields.serviceStartDate")}
                  </label>
                  <input
                    id="financials-start-date"
                    type="date"
                    name="serviceStartDate"
                    defaultValue={primaryProperty.serviceStartDate ?? ""}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS} htmlFor="financials-payment-day">
                    {t("admin.invoices.servicePayment.fields.paymentDay")}
                  </label>
                  <input
                    id="financials-payment-day"
                    type="number"
                    min="1"
                    max="31"
                    name="paymentDay"
                    defaultValue={primaryProperty.paymentDay ?? ""}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS} htmlFor="financials-service-price">
                    {t("admin.invoices.servicePayment.fields.servicePrice")}
                  </label>
                  <input
                    id="financials-service-price"
                    type="number"
                    min="0"
                    step="0.01"
                    name="servicePrice"
                    defaultValue={
                      primaryProperty.servicePrice !== null
                        ? primaryProperty.servicePrice.toFixed(2)
                        : ""
                    }
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS} htmlFor="financials-payment-type">
                    {t("admin.invoices.servicePayment.fields.paymentType")}
                  </label>
                  <select
                    id="financials-payment-type"
                    name="paymentType"
                    defaultValue={primaryProperty.paymentType ?? ""}
                    className={SELECT_CLASS}
                  >
                    <option value="">
                      {t("admin.invoices.servicePayment.placeholders.paymentType")}
                    </option>
                    {SERVICE_PAYMENT_TYPE_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {t(`admin.invoices.servicePayment.paymentTypes.${value}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className={LABEL_CLASS} htmlFor="financials-payment-notes">
                  {t("admin.invoices.servicePayment.fields.paymentNotes")}
                </label>
                <textarea
                  id="financials-payment-notes"
                  name="paymentNotes"
                  defaultValue={primaryProperty.paymentNotes ?? ""}
                  className="mt-2 min-h-[80px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {t("admin.customers.detail.financials.noPropertyHint")}
            </p>
          )}
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
