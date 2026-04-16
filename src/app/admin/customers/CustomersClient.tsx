"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  portalStatus: "ACTIVE" | "INACTIVE";
  status: string;
  properties: number;
  jobs: number;
  invoices: number;
};

type BulkInviteTarget = {
  id: string;
  name: string;
  email: string;
};

type BulkInviteState =
  | {
      phase: "loading";
      total: number;
      completed: number;
      successCount: number;
      failedCount: number;
      skippedCount: number;
      currentCustomerName: string;
      message: string;
    }
  | {
      phase: "sending" | "finished" | "error";
      total: number;
      completed: number;
      successCount: number;
      failedCount: number;
      skippedCount: number;
      currentCustomerName: string;
      message: string;
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
    portal: string;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [bulkInviteState, setBulkInviteState] = useState<BulkInviteState | null>(
    null
  );
  const returnTo = searchParams?.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;
  const isBulkInviteOpen = Boolean(bulkInviteState);
  const isBulkInviting =
    bulkInviteState?.phase === "loading" || bulkInviteState?.phase === "sending";
  const showInviteAllInactive = filters.portal === "INACTIVE";

  useEffect(() => {
    if (!open && !isBulkInviteOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBulkInviting) {
        setOpen(false);
        setBulkInviteState(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isBulkInviteOpen, isBulkInviting, open]);

  useEffect(() => {
    if (!open && !isBulkInviteOpen) {
      return;
    }
    const unlock = lockBodyScroll();
    return () => {
      unlock();
    };
  }, [isBulkInviteOpen, open]);

  const closeBulkInviteModal = () => {
    if (isBulkInviting) {
      return;
    }
    setBulkInviteState(null);
  };

  const sendBulkInvites = async () => {
    setBulkInviteState({
      phase: "loading",
      total: 0,
      completed: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      currentCustomerName: "",
      message: t("admin.customers.overview.bulkInvite.loadingTargets"),
    });

    try {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const targetsResponse = await fetch(
        `/api/admin/customers/portal-invite-targets?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const targetsPayload = (await targetsResponse.json().catch(() => null)) as
        | {
            targets?: BulkInviteTarget[];
            eligibleCount?: number;
            skippedCount?: number;
            error?: string;
          }
        | null;

      if (!targetsResponse.ok) {
        throw new Error(
          targetsPayload?.error ??
            t("admin.customers.overview.bulkInvite.prepareError")
        );
      }

      const targets = Array.isArray(targetsPayload?.targets)
        ? targetsPayload.targets
        : [];
      const skippedCount =
        typeof targetsPayload?.skippedCount === "number"
          ? targetsPayload.skippedCount
          : 0;

      if (targets.length === 0) {
        setBulkInviteState({
          phase: "finished",
          total: 0,
          completed: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount,
          currentCustomerName: "",
          message: t("admin.customers.overview.bulkInvite.noEligible"),
        });
        router.refresh();
        return;
      }

      let successCount = 0;
      let failedCount = 0;

      setBulkInviteState({
        phase: "sending",
        total: targets.length,
        completed: 0,
        successCount,
        failedCount,
        skippedCount,
        currentCustomerName: targets[0]?.name ?? "",
        message: t("admin.customers.overview.bulkInvite.sending"),
      });

      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];

        setBulkInviteState({
          phase: "sending",
          total: targets.length,
          completed: index,
          successCount,
          failedCount,
          skippedCount,
          currentCustomerName: target.name,
          message: t("admin.customers.overview.bulkInvite.sending"),
        });

        const inviteResponse = await fetch(
          `/api/admin/customers/${target.id}/invite`,
          {
            method: "POST",
          }
        );

        if (inviteResponse.ok) {
          successCount += 1;
        } else {
          failedCount += 1;
        }

        setBulkInviteState({
          phase: "sending",
          total: targets.length,
          completed: index + 1,
          successCount,
          failedCount,
          skippedCount,
          currentCustomerName: index + 1 < targets.length ? targets[index + 1].name : "",
          message: t("admin.customers.overview.bulkInvite.sending"),
        });
      }

      router.refresh();

      setBulkInviteState({
        phase: "finished",
        total: targets.length,
        completed: targets.length,
        successCount,
        failedCount,
        skippedCount,
        currentCustomerName: "",
        message:
          failedCount > 0
            ? t("admin.customers.overview.bulkInvite.finishedWithFailures")
            : t("admin.customers.overview.bulkInvite.finished"),
      });
    } catch (error) {
      setBulkInviteState({
        phase: "error",
        total: 0,
        completed: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        currentCustomerName: "",
        message:
          error instanceof Error
            ? error.message
            : t("admin.customers.overview.bulkInvite.prepareError"),
      });
    }
  };

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

  const bulkInviteModal =
    typeof document !== "undefined" && bulkInviteState
      ? createPortal(
          <div className="app-modal-layer fixed inset-0 z-[1400] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            <button
              type="button"
              className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
              aria-label={t("common.actions.close")}
              onClick={closeBulkInviteModal}
              disabled={isBulkInviting}
            />
            <div className="app-modal-card relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                <div className="app-modal-header">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {t("admin.customers.overview.bulkInvite.kicker")}
                    </p>
                    <h2 className="text-lg font-semibold">
                      {t("admin.customers.overview.bulkInvite.title")}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {t("admin.customers.overview.bulkInvite.subtitle")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeBulkInviteModal}
                    className="app-modal-close"
                    aria-label={t("common.actions.close")}
                    title={t("common.actions.close")}
                    disabled={isBulkInviting}
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

                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <p className="font-semibold text-slate-800">
                        {bulkInviteState.message}
                      </p>
                      <p className="text-slate-500">
                        {bulkInviteState.total > 0
                          ? t("admin.customers.overview.bulkInvite.progressCount", {
                              completed: bulkInviteState.completed,
                              total: bulkInviteState.total,
                            })
                          : t("admin.customers.overview.bulkInvite.preparingCount")}
                      </p>
                    </div>

                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          bulkInviteState.phase === "error"
                            ? "bg-rose-500"
                            : bulkInviteState.phase === "finished"
                              ? "bg-emerald-500"
                              : "bg-sky-500"
                        }`}
                        style={{
                          width:
                            bulkInviteState.total > 0
                              ? `${Math.max(
                                  6,
                                  Math.round(
                                    (bulkInviteState.completed / bulkInviteState.total) * 100
                                  )
                                )}%`
                              : bulkInviteState.phase === "loading"
                                ? "20%"
                                : "100%",
                        }}
                      />
                    </div>

                    {bulkInviteState.currentCustomerName ? (
                      <p className="mt-3 text-sm text-slate-600">
                        {t("admin.customers.overview.bulkInvite.currentCustomer", {
                          name: bulkInviteState.currentCustomerName,
                        })}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                        {t("admin.customers.overview.bulkInvite.sent")}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-900">
                        {bulkInviteState.successCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700">
                        {t("admin.customers.overview.bulkInvite.failed")}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-rose-900">
                        {bulkInviteState.failedCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                        {t("admin.customers.overview.bulkInvite.skipped")}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-amber-900">
                        {bulkInviteState.skippedCount}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={closeBulkInviteModal}
                    disabled={isBulkInviting}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                      isBulkInviting
                        ? "cursor-wait border border-slate-200 bg-slate-100 text-slate-400"
                        : "border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300"
                    }`}
                  >
                    {t("common.actions.close")}
                  </button>
                </div>
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
        showInviteAllInactive={showInviteAllInactive}
        isBulkInviting={isBulkInviting}
        onInviteAllInactive={sendBulkInvites}
      />
      {modal}
      {bulkInviteModal}
    </>
  );
}


