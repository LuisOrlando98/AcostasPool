"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import CustomersOverview from "@/components/customers/CustomersOverview";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { useI18n } from "@/i18n/client";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  propertyNames: string[];
  status: string;
  properties: number;
  jobs: number;
  invoices: number;
};

type CustomersClientProps = {
  rows: CustomerRow[];
  summary: {
    total: number;
    active: number;
    inactive: number;
    properties: number;
    jobs: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    query: string;
    status: string;
    sort: string;
  };
  createCustomer: (formData: FormData) => void | Promise<void>;
};

export default function CustomersClient({
  rows,
  summary,
  pagination,
  filters,
  createCustomer,
}: CustomersClientProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const returnTo = searchParams?.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const unlock = lockBodyScroll();
    return () => {
      unlock();
    };
  }, [open]);

  const modal =
    typeof document !== "undefined" && open
      ? createPortal(
          <div className="app-modal-layer fixed inset-0 z-[1300] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            <button
              type="button"
              className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
              aria-label={t("common.actions.close")}
              onClick={() => setOpen(false)}
            />
            <div className="app-modal-card relative z-10 w-full max-w-6xl border border-slate-200 bg-white shadow-2xl">
              <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                <div className="app-modal-header">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {t("admin.customers.new.kicker")}
                    </p>
                    <h2 className="text-lg font-semibold">
                      {t("admin.customers.new.title")}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 6l12 12M18 6l-12 12"
                      />
                    </svg>
                  </button>
                </div>
                <form
                  action={createCustomer}
                  className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"
                >
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <h3 className="text-sm font-semibold text-slate-800">
                        {t("admin.customers.new.sections.personal.title")}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t("admin.customers.new.sections.personal.subtitle")}
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {t("common.labels.firstName")}
                          </label>
                          <input
                            name="nombre"
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            placeholder={t("admin.customers.new.placeholders.firstName")}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {t("common.labels.lastName")}
                          </label>
                          <input
                            name="apellidos"
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            placeholder={t("admin.customers.new.placeholders.lastName")}
                          />
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {t("common.labels.email")}
                          </label>
                          <input
                            name="email"
                            type="email"
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            placeholder={t("admin.customers.new.placeholders.email")}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {t("common.labels.language")}
                          </label>
                          <select
                            name="idiomaPreferencia"
                            defaultValue="EN"
                            className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                          >
                            <option value="EN">EN</option>
                            <option value="ES">ES</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {t("common.labels.phone")}
                          </label>
                          <input
                            name="telefono"
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            placeholder={t("admin.customers.new.placeholders.phone")}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {t("common.labels.phoneSecondary")}
                          </label>
                          <input
                            name="telefonoSecundario"
                            className="app-input mt-2 w-full px-4 py-3 text-sm"
                            placeholder={t("admin.customers.new.placeholders.phone")}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <h3 className="text-sm font-semibold text-slate-800">
                        {t("admin.customers.new.sections.account.title")}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t("admin.customers.new.sections.account.subtitle")}
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {t("admin.customers.new.fields.status")}
                          </label>
                          <select
                            name="estadoCuenta"
                            defaultValue="ACTIVE"
                            className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
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
                            defaultValue="RESIDENTIAL"
                            className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
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
                      <label className="mt-3 flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                        <input
                          type="checkbox"
                          name="allowWeekendBooking"
                          className="mt-0.5 h-4 w-4"
                        />
                        <span>
                          {t("admin.customers.new.fields.allowWeekendBooking")}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <h3 className="text-sm font-semibold text-slate-800">
                        {t("address.sectionTitle")}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t("address.sectionSubtitle")}
                      </p>
                      <div className="mt-4">
                        <AddressAutocomplete />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("common.labels.notes")}
                      </label>
                      <textarea
                        name="notas"
                        className="app-input mt-2 min-h-[90px] w-full px-4 py-3 text-sm"
                        placeholder={t("admin.customers.new.placeholders.notes")}
                      />
                    </div>

                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        name="enviarInvitacion"
                        className="h-4 w-4"
                      />
                      <span>
                        {t("admin.customers.new.fields.sendInvite")}
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {t("admin.customers.new.fields.inviteHint")}
                    </p>
                  </div>

                  <FormSubmitButton
                    idleLabel={t("admin.customers.new.actions.create")}
                    pendingLabel={t("admin.customers.new.actions.creating")}
                    successLabel={t("common.feedback.created")}
                    className="w-full lg:col-span-2"
                  />
                </form>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <CustomersOverview
        rows={rows}
        summary={summary}
        pagination={pagination}
        filters={filters}
        onCreate={() => setOpen(true)}
      />
      {modal}
    </>
  );
}


