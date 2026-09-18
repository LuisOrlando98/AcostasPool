import type { Prisma } from "@prisma/client";
import {
  addBusinessDays,
  endOfBusinessDay,
  formatBusinessDateInput,
  parseBusinessDateInput,
  startOfBusinessDay,
} from "@/lib/timezone";

export type ReportFilters = {
  from: Date;
  to: Date;
  range: string;
  technicianId?: string;
  serviceType?: string;
  priority?: string;
};

const parseDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const businessDate = parseBusinessDateInput(value);
  if (businessDate) {
    return businessDate;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const startOfDay = (date: Date) => startOfBusinessDay(date) ?? date;

const endOfDay = (date: Date) => endOfBusinessDay(date) ?? date;

const DEFAULT_RANGE_DAYS = 30;

type DateWindow = { from: Date; to: Date };

/** Ventana de `days` días (ambos inclusive) que termina en `end`. */
const windowEndingAt = (end: Date, days: number): DateWindow => ({
  from: addBusinessDays(end, -(days - 1)) ?? end,
  to: end,
});

/**
 * Con un solo extremo explícito se respeta la fecha dada y el otro se completa de
 * forma coherente con la ventana por defecto: solo `from` llega hasta hoy y solo `to`
 * abre una ventana de DEFAULT_RANGE_DAYS días que termina en esa fecha.
 */
const resolveDateWindow = (input: {
  now: Date;
  rawFrom: Date | null;
  rawTo: Date | null;
  isTodayRange: boolean;
  presetDays: number | null;
}): DateWindow => {
  const { now, rawFrom, rawTo, isTodayRange, presetDays } = input;
  if (isTodayRange) {
    return { from: now, to: now };
  }
  if (presetDays !== null) {
    return windowEndingAt(now, presetDays);
  }
  if (rawFrom && rawTo) {
    return { from: rawFrom, to: rawTo };
  }
  if (rawFrom) {
    return { from: rawFrom, to: now };
  }
  if (rawTo) {
    return windowEndingAt(rawTo, DEFAULT_RANGE_DAYS);
  }
  return windowEndingAt(now, DEFAULT_RANGE_DAYS);
};

const orderWindow = (window: DateWindow): DateWindow =>
  window.from > window.to ? { from: window.to, to: window.from } : window;

export const getReportFilters = (
  searchParams?: Record<string, string | string[] | undefined>
): ReportFilters => {
  const param = (key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const rangeParam = param("range");
  const normalizedRange = (rangeParam ?? "").toLowerCase();
  const rawFrom = parseDate(param("from"));
  const rawTo = parseDate(param("to"));
  const days = rangeParam ? Number(rangeParam) : Number.NaN;
  const isTodayRange = normalizedRange === "today";
  const isDayPreset = !Number.isNaN(days) && days > 0;
  const now = new Date();

  const window = orderWindow(
    resolveDateWindow({
      now,
      rawFrom,
      rawTo,
      isTodayRange,
      presetDays: isDayPreset ? days : null,
    })
  );

  const range =
    isTodayRange
      ? "today"
      : isDayPreset
      ? String(days)
      : rawFrom || rawTo
        ? "custom"
        : String(DEFAULT_RANGE_DAYS);

  const technicianId = param("technicianId") || undefined;
  const serviceType = param("serviceType") || undefined;
  const priority = param("priority") || undefined;

  return {
    from: startOfDay(window.from),
    to: endOfDay(window.to),
    range,
    technicianId,
    serviceType,
    priority,
  };
};

export const formatDateInput = (date: Date) => formatBusinessDateInput(date);

export const buildJobWhere = (filters: ReportFilters): Prisma.JobWhereInput => {
  return {
    scheduledDate: { gte: filters.from, lte: filters.to },
    ...(filters.technicianId ? { technicianId: filters.technicianId } : {}),
    ...(filters.serviceType
      ? { serviceType: filters.serviceType as Prisma.JobWhereInput["serviceType"] }
      : {}),
    ...(filters.priority
      ? { priority: filters.priority as Prisma.JobWhereInput["priority"] }
      : {}),
  };
};

export const buildInvoiceWhere = (
  filters: ReportFilters
): Prisma.InvoiceWhereInput => {
  return {
    createdAt: { gte: filters.from, lte: filters.to },
  };
};

export const buildQueryParams = (filters: ReportFilters) => {
  const params = new URLSearchParams();
  params.set("from", formatDateInput(filters.from));
  params.set("to", formatDateInput(filters.to));
  if (filters.range && filters.range !== "custom") {
    params.set("range", filters.range);
  }
  if (filters.technicianId) {
    params.set("technicianId", filters.technicianId);
  }
  if (filters.serviceType) {
    params.set("serviceType", filters.serviceType);
  }
  if (filters.priority) {
    params.set("priority", filters.priority);
  }
  return params.toString();
};
