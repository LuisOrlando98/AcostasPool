"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import CustomersOverview from "@/components/customers/CustomersOverview";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { useI18n } from "@/i18n/client";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
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
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const modal = useMemo(() => {
    if (!open || !mounted) {
      return null;
    }

    return createPortal(
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/60"
          aria-label={t("common.actions.close")}
          onClick={() => setOpen(false)}
        />
        <div className="relative z-10 w-full max-w-6xl">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
              <div className="flex items-center justify-between gap-3">
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
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300"
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
                          required
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
                          required
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
                          required
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
                </div>

                <FormSubmitButton
                  idleLabel={t("admin.customers.new.actions.create")}
                  pendingLabel={t("admin.customers.new.actions.creating")}
                  className="w-full lg:col-span-2"
                />
              </form>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }, [createCustomer, mounted, open]);

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
