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

  let from = rawFrom;
  let to = rawTo;

  if (isTodayRange) {
    from = now;
    to = now;
  } else if (isDayPreset) {
    const start = addBusinessDays(now, -(days - 1)) ?? now;
    from = start;
    to = now;
  } else if (!from || !to) {
    const start = addBusinessDays(now, -29) ?? now;
    from = start;
    to = now;
  }

  const range =
    isTodayRange
      ? "today"
      : isDayPreset
      ? String(days)
      : rawFrom || rawTo
        ? "custom"
        : "30";

  if ((from ?? now) > (to ?? now)) {
    const swap = from;
    from = to;
    to = swap;
  }

  const technicianId = param("technicianId") || undefined;
  const serviceType = param("serviceType") || undefined;
  const priority = param("priority") || undefined;

  return {
    from: startOfDay(from ?? now),
    to: endOfDay(to ?? now),
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
