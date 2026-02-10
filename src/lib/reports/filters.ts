import type { Prisma } from "@prisma/client";

export type ReportFilters = {
  from: Date;
  to: Date;
  range: string;
  technicianId?: string;
  status?: string;
  type?: string;
  serviceType?: string;
  priority?: string;
};

const parseDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  next.setMilliseconds(next.getMilliseconds() - 1);
  return next;
};

export const getReportFilters = (
  searchParams?: Record<string, string | string[] | undefined>
): ReportFilters => {
  const param = (key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const rangeParam = param("range");
  const rawFrom = parseDate(param("from"));
  const rawTo = parseDate(param("to"));
  const days = rangeParam ? Number(rangeParam) : Number.NaN;
  const now = new Date();

  let from = rawFrom;
  let to = rawTo;

  if (!Number.isNaN(days) && days > 0) {
    const start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    from = start;
    to = now;
  } else if (!from || !to) {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    from = start;
    to = now;
  }

  const range =
    !Number.isNaN(days) && days > 0
      ? String(days)
      : rawFrom || rawTo
        ? "custom"
        : "30";

  const technicianId = param("technicianId") || undefined;
  const status = param("status") || undefined;
  const type = param("type") || undefined;
  const serviceType = param("serviceType") || undefined;
  const priority = param("priority") || undefined;

  return {
    from: startOfDay(from ?? now),
    to: endOfDay(to ?? now),
    range,
    technicianId,
    status,
    type,
    serviceType,
    priority,
  };
};

export const formatDateInput = (date: Date) =>
  date.toISOString().slice(0, 10);

export const buildJobWhere = (filters: ReportFilters): Prisma.JobWhereInput => {
  return {
    scheduledDate: { gte: filters.from, lte: filters.to },
    ...(filters.technicianId ? { technicianId: filters.technicianId } : {}),
    ...(filters.status ? { status: filters.status as Prisma.JobWhereInput["status"] } : {}),
    ...(filters.type ? { type: filters.type as Prisma.JobWhereInput["type"] } : {}),
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
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.type) {
    params.set("type", filters.type);
  }
  if (filters.serviceType) {
    params.set("serviceType", filters.serviceType);
  }
  if (filters.priority) {
    params.set("priority", filters.priority);
  }
  return params.toString();
};
