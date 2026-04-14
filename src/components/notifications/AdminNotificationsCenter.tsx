"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/client";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";
import {
  getNotificationDetail,
  getNotificationSource,
  getNotificationTitle,
} from "@/lib/notifications/view";
import {
  addBusinessDays,
  endOfBusinessDay,
  formatInBusinessTimeZone,
  parseBusinessDateInput,
  startOfBusinessDay,
} from "@/lib/timezone";

type NotificationRow = {
  id: string;
  eventType: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  status: "QUEUED" | "SENT" | "FAILED";
  createdAt: string;
  readAt: string | null;
  payload: Record<string, unknown> | null;
  customerName: string;
  actorName: string | null;
  actorEmail: string | null;
  link: string;
};

type RangeFilter = "ALL" | "TODAY" | "7D" | "30D" | "CUSTOM";
type ReadFilter = "ALL" | "READ" | "UNREAD";
type SeverityFilter = "ALL" | "INFO" | "WARNING" | "CRITICAL";
type DeliveryFilter = "ALL" | "QUEUED" | "SENT" | "FAILED";

type NotificationsFilters = {
  search: string;
  eventType: string;
  read: ReadFilter;
  severity: SeverityFilter;
  delivery: DeliveryFilter;
  range: RangeFilter;
  from: string;
  to: string;
};

const PAGE_SIZE = 20;

const DEFAULT_FILTERS: NotificationsFilters = {
  search: "",
  eventType: "ALL",
  read: "ALL",
  severity: "ALL",
  delivery: "ALL",
  range: "ALL",
  from: "",
  to: "",
};

function startOfDay(value: Date) {
  return startOfBusinessDay(value) ?? new Date(value);
}

function endOfDay(value: Date) {
  return endOfBusinessDay(value) ?? new Date(value);
}

function parseDateInput(value: string) {
  return parseBusinessDateInput(value);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function resolveNotificationLink(payload: Record<string, unknown> | null) {
  const jobId = asString(payload?.jobId);
  if (jobId) {
    return `/admin/routes?highlight=${jobId}`;
  }
  const invoiceId = asString(payload?.invoiceId);
  if (invoiceId) {
    return `/admin/invoices?highlight=${invoiceId}`;
  }
  const customerId = asString(payload?.customerId);
  if (customerId) {
    return `/admin/customers/${customerId}`;
  }
  return "/admin/notifications";
}

export default function AdminNotificationsCenter({
  rows,
}: {
  rows: NotificationRow[];
}) {
  const { t, locale } = useI18n();
  const [notifications, setNotifications] = useState(rows);
  const [filters, setFilters] = useState<NotificationsFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<NotificationsFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [busyReadId, setBusyReadId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const decorated = useMemo(() => {
    return notifications.map((row) => {
      const payload = asObject(row.payload);
      const title = getNotificationTitle(row.eventType, t);
      const detail = getNotificationDetail(
        {
          eventType: row.eventType,
          createdAt: row.createdAt,
          payload,
          status: row.status,
          customerName: row.customerName,
        },
        locale,
        t
      );
      const source = getNotificationSource(
        {
          eventType: row.eventType,
          createdAt: row.createdAt,
          payload,
          status: row.status,
          customerName: row.customerName,
        },
        t
      );
      const createdAtDate = new Date(row.createdAt);
      return {
        ...row,
        payload,
        title,
        detail,
        source,
        createdAtDate,
      };
    });
  }, [locale, notifications, t]);

  const eventTypeOptions = useMemo(() => {
    const unique = Array.from(new Set(decorated.map((item) => item.eventType)));
    return unique.map((eventType) => ({
      value: eventType,
      label: getNotificationTitle(eventType, t),
    }));
  }, [decorated, t]);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const now = new Date();
    let rangeFrom: Date | null = null;
    let rangeTo: Date | null = null;

    if (filters.range === "TODAY") {
      rangeFrom = startOfDay(now);
      rangeTo = endOfDay(now);
    } else if (filters.range === "7D") {
      rangeTo = endOfDay(now);
      const from = addBusinessDays(now, -6) ?? now;
      rangeFrom = startOfDay(from);
    } else if (filters.range === "30D") {
      rangeTo = endOfDay(now);
      const from = addBusinessDays(now, -29) ?? now;
      rangeFrom = startOfDay(from);
    } else if (filters.range === "CUSTOM") {
      const from = parseDateInput(filters.from);
      const to = parseDateInput(filters.to);
      rangeFrom = from ? startOfDay(from) : null;
      rangeTo = to ? endOfDay(to) : null;
      if (rangeFrom && rangeTo && rangeFrom > rangeTo) {
        const temp = rangeFrom;
        rangeFrom = rangeTo;
        rangeTo = temp;
      }
    }

    return decorated.filter((item) => {
      if (filters.eventType !== "ALL" && item.eventType !== filters.eventType) {
        return false;
      }
      if (filters.read === "READ" && !item.readAt) {
        return false;
      }
      if (filters.read === "UNREAD" && item.readAt) {
        return false;
      }
      if (filters.severity !== "ALL" && item.severity !== filters.severity) {
        return false;
      }
      if (filters.delivery !== "ALL" && item.status !== filters.delivery) {
        return false;
      }
      if (rangeFrom && item.createdAtDate < rangeFrom) {
        return false;
      }
      if (rangeTo && item.createdAtDate > rangeTo) {
        return false;
      }

      if (!query) {
        return true;
      }
      const haystack = [
        item.id,
        item.eventType,
        item.title,
        item.detail,
        item.source,
        item.customerName,
        item.actorName ?? "",
        item.actorEmail ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [decorated, filters]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }
    const unlock = lockBodyScroll();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlock();
    };
  }, [filtersOpen]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [currentPage, filtered]);

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const failedCount = notifications.filter((item) => item.status === "FAILED").length;

  const activeFiltersCount = [
    filters.search.trim().length > 0,
    filters.eventType !== "ALL",
    filters.read !== "ALL",
    filters.severity !== "ALL",
    filters.delivery !== "ALL",
    filters.range !== "ALL",
    filters.from.trim().length > 0,
    filters.to.trim().length > 0,
  ].filter(Boolean).length;

  const openFilters = () => {
    setDraftFilters(filters);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setFiltersOpen(false);
  };

  const markAsRead = async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.readAt || busyReadId) {
      return;
    }

    setBusyReadId(id);
    setActionError(null);
    const response = await fetch(`/api/notifications/${id}/read`, {
      method: "POST",
    });
    setBusyReadId(null);
    if (!response.ok) {
      setActionError(t("notifications.preferences.saveError"));
      return;
    }

    const nowIso = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              readAt: nowIso,
            }
          : item
      )
    );
  };

  const deleteNotification = async (id: string) => {
    if (busyDeleteId || clearing) {
      return;
    }

    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      return;
    }

    setBusyDeleteId(id);
    setPendingDeleteId(null);
    setActionError(null);
    const previous = notifications;
    setNotifications((current) => current.filter((item) => item.id !== id));
    const response = await fetch(`/api/notifications/${id}`, {
      method: "DELETE",
    });
    setBusyDeleteId(null);
    if (!response.ok) {
      setNotifications(previous);
      setActionError(t("notifications.preferences.saveError"));
    }
  };

  const clearAll = async () => {
    if (clearing || notifications.length === 0) {
      return;
    }

    const confirmed = window.confirm(t("admin.notifications.actions.clearConfirm"));
    if (!confirmed) {
      return;
    }

    setClearing(true);
    setPendingDeleteId(null);
    setActionError(null);
    const previous = notifications;
    setNotifications([]);
    const response = await fetch("/api/notifications/clear", {
      method: "POST",
    });
    setClearing(false);
    if (!response.ok) {
      setNotifications(previous);
      setActionError(t("notifications.preferences.saveError"));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <article className="app-card p-3.5 shadow-contrast sm:p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-xs sm:tracking-[0.22em]">
            {t("admin.notifications.stats.total")}
          </p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900 sm:mt-2 sm:text-2xl">
            {notifications.length}
          </p>
        </article>
        <article className="app-card p-3.5 shadow-contrast sm:p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-xs sm:tracking-[0.22em]">
            {t("admin.notifications.stats.unread")}
          </p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900 sm:mt-2 sm:text-2xl">
            {unreadCount}
          </p>
        </article>
        <article className="app-card p-3.5 shadow-contrast sm:p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-xs sm:tracking-[0.22em]">
            {t("admin.notifications.stats.failed")}
          </p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900 sm:mt-2 sm:text-2xl">
            {failedCount}
          </p>
        </article>
        <article className="app-card p-3.5 shadow-contrast sm:p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-xs sm:tracking-[0.22em]">
            {t("admin.notifications.stats.filtered")}
          </p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900 sm:mt-2 sm:text-2xl">
            {filtered.length}
          </p>
        </article>
      </section>

      <section className="ui-panel overflow-hidden p-3 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2.5 sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight text-slate-900">
              {t("admin.notifications.list.title")}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-xs">
              {t("admin.notifications.list.showing", {
                count: pagedRows.length,
                total: filtered.length,
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeFiltersCount > 0 ? (
              <span className="app-chip hidden px-3 py-1 text-xs sm:inline-flex" data-tone="warning">
                {t("admin.notifications.filters.activeCount", {
                  count: activeFiltersCount,
                })}
              </span>
            ) : null}
            <button
              type="button"
              onClick={openFilters}
              className="app-button-ghost relative inline-flex h-9 w-9 items-center justify-center rounded-full p-0"
              aria-label={t("admin.notifications.filters.open")}
              title={t("admin.notifications.filters.open")}
            >
              {activeFiltersCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 sm:hidden" />
              ) : null}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              <span className="sr-only">{t("admin.notifications.filters.open")}</span>
            </button>
            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="app-button-ghost hidden px-3 py-2 text-xs font-semibold sm:inline-flex"
              >
                {t("admin.notifications.filters.reset")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void clearAll()}
              disabled={clearing || notifications.length === 0}
              className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 sm:px-3 sm:py-2 sm:text-xs disabled:opacity-60"
            >
              {clearing
                ? t("common.feedback.saving")
                : t("admin.notifications.actions.clearAll")}
            </button>
          </div>
        </div>

        {actionError ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {actionError}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {pagedRows.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              {notifications.length === 0
                ? t("admin.notifications.list.empty")
                : t("admin.notifications.list.emptyFiltered")}
            </p>
          ) : (
            pagedRows.map((item) => {
              const severityClass =
                item.severity === "CRITICAL"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : item.severity === "WARNING"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-sky-200 bg-sky-50 text-sky-700";
              const statusClass =
                item.status === "FAILED"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : item.status === "SENT"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-600";

              return (
                <article
                  key={item.id}
                  className={`rounded-2xl border px-4 py-4 transition ${
                    item.readAt
                      ? "border-slate-200 bg-white"
                      : "border-sky-200 bg-sky-50/45"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${severityClass}`}>
                          {item.severity}
                        </span>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusClass}`}>
                          {item.status}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            item.readAt
                              ? "bg-slate-100 text-slate-600"
                              : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {item.readAt ? t("notifications.read") : t("notifications.unread")}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800">{item.customerName}</p>
                      <p className="text-xs text-slate-500">{item.detail}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.source} |{" "}
                        {formatInBusinessTimeZone(item.createdAt, locale, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                      {item.actorName ? (
                        <p className="text-[11px] text-slate-400">
                          {`${t("admin.notifications.list.actor")}: ${item.actorName}${
                            item.actorEmail ? ` (${item.actorEmail})` : ""
                          }`}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Link
                        href={item.link || resolveNotificationLink(item.payload)}
                        className="app-button-ghost px-3 py-1.5 text-xs font-semibold"
                      >
                        {t("common.actions.view")}
                      </Link>
                      {!item.readAt ? (
                        <button
                          type="button"
                          onClick={() => void markAsRead(item.id)}
                          disabled={busyReadId === item.id}
                          className="app-button-ghost px-3 py-1.5 text-xs font-semibold"
                        >
                          {busyReadId === item.id
                            ? t("common.feedback.saving")
                            : t("admin.notifications.actions.markRead")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void deleteNotification(item.id)}
                        disabled={busyDeleteId === item.id}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                      >
                        {busyDeleteId === item.id
                          ? t("common.feedback.saving")
                          : pendingDeleteId === item.id
                            ? t("notifications.deleteConfirm")
                            : t("common.actions.delete")}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {filtered.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>
              {`${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(
                currentPage * PAGE_SIZE,
                filtered.length
              )} / ${filtered.length}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage <= 1}
                className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 disabled:opacity-50"
              >
                {t("admin.notifications.list.prev")}
              </button>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 disabled:opacity-50"
              >
                {t("admin.notifications.list.next")}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {filtersOpen && typeof document !== "undefined"
        ? createPortal(
        <div className="app-modal-layer fixed inset-0 z-[2600] flex items-center justify-center bg-slate-900/60 p-3 sm:p-6">
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="absolute inset-0"
            aria-label={t("common.actions.close")}
          />
          <div className="app-modal-card relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="app-modal-scroll modal-scroll max-h-[88vh] overflow-y-auto p-5 sm:p-6">
              <div className="app-modal-header flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {t("admin.notifications.filters.modalTitle")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t("admin.notifications.filters.modalSubtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300"
                  aria-label={t("common.actions.close")}
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
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("common.actions.search")}
                  </label>
                  <input
                    value={draftFilters.search}
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    placeholder={t("admin.notifications.filters.searchPlaceholder")}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.notifications.filters.eventType")}
                  </label>
                  <select
                    value={draftFilters.eventType}
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        eventType: event.target.value,
                      }))
                    }
                    className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                  >
                    <option value="ALL">{t("admin.notifications.filters.allEventTypes")}</option>
                    {eventTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.notifications.filters.read")}
                  </label>
                  <select
                    value={draftFilters.read}
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        read: event.target.value as ReadFilter,
                      }))
                    }
                    className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                  >
                    <option value="ALL">{t("admin.notifications.filters.readAll")}</option>
                    <option value="UNREAD">{t("admin.notifications.filters.readUnread")}</option>
                    <option value="READ">{t("admin.notifications.filters.readRead")}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.notifications.filters.severity")}
                  </label>
                  <select
                    value={draftFilters.severity}
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        severity: event.target.value as SeverityFilter,
                      }))
                    }
                    className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                  >
                    <option value="ALL">{t("admin.notifications.filters.severityAll")}</option>
                    <option value="INFO">{t("admin.notifications.filters.severityInfo")}</option>
                    <option value="WARNING">{t("admin.notifications.filters.severityWarning")}</option>
                    <option value="CRITICAL">{t("admin.notifications.filters.severityCritical")}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("admin.notifications.filters.delivery")}
                  </label>
                  <select
                    value={draftFilters.delivery}
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        delivery: event.target.value as DeliveryFilter,
                      }))
                    }
                    className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                  >
                    <option value="ALL">{t("admin.notifications.filters.deliveryAll")}</option>
                    <option value="QUEUED">{t("admin.notifications.filters.deliveryQueued")}</option>
                    <option value="SENT">{t("admin.notifications.filters.deliverySent")}</option>
                    <option value="FAILED">{t("admin.notifications.filters.deliveryFailed")}</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {t("admin.notifications.filters.range")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: "ALL", label: t("admin.notifications.filters.rangeAll") },
                      { key: "TODAY", label: t("admin.notifications.filters.rangeToday") },
                      { key: "7D", label: t("admin.notifications.filters.range7") },
                      { key: "30D", label: t("admin.notifications.filters.range30") },
                      { key: "CUSTOM", label: t("admin.notifications.filters.rangeCustom") },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          range: option.key,
                        }))
                      }
                      className={`app-chip px-3 py-1.5 text-xs transition ${
                        draftFilters.range === option.key ? "bg-slate-900 text-white" : ""
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {draftFilters.range === "CUSTOM" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t("admin.notifications.filters.from")}
                      </label>
                      <input
                        type="date"
                        value={draftFilters.from}
                        onChange={(event) =>
                          setDraftFilters((current) => ({
                            ...current,
                            from: event.target.value,
                          }))
                        }
                        className="app-input mt-2 w-full px-4 py-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t("admin.notifications.filters.to")}
                      </label>
                      <input
                        type="date"
                        value={draftFilters.to}
                        onChange={(event) =>
                          setDraftFilters((current) => ({
                            ...current,
                            to: event.target.value,
                          }))
                        }
                        className="app-input mt-2 w-full px-4 py-3 text-sm"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="app-button-ghost w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] sm:w-auto"
                >
                  {t("admin.notifications.filters.reset")}
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="app-button-primary w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] sm:w-auto"
                >
                  {t("admin.notifications.filters.apply")}
                </button>
              </div>
            </div>
          </div>
        </div>,
            document.body
          )
        : null}
    </div>
  );
}
