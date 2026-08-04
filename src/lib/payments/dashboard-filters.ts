import {
  addBusinessDays,
  endOfBusinessDay,
  formatBusinessDateInput,
  parseBusinessDateInput,
  startOfBusinessDay,
} from "@/lib/timezone";

export type AccountingFilters = {
  from: Date;
  to: Date;
  range: string;
};

const DEFAULT_RANGE_DAYS = 365;

const parseDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const businessDate = parseBusinessDateInput(value);
  if (businessDate) {
    return businessDate;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date: Date) => startOfBusinessDay(date) ?? date;
const endOfDay = (date: Date) => endOfBusinessDay(date) ?? date;

export function getAccountingFilters(
  searchParams?: Record<string, string | string[] | undefined>
): AccountingFilters {
  const param = (key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const rangeParam = param("range");
  const rawFrom = parseDate(param("from"));
  const rawTo = parseDate(param("to"));
  const days = rangeParam ? Number(rangeParam) : Number.NaN;
  const isDayPreset = !Number.isNaN(days) && days > 0;
  const now = new Date();

  let from = rawFrom;
  let to = rawTo;

  if (isDayPreset) {
    from = addBusinessDays(now, -(days - 1)) ?? now;
    to = now;
  } else if (!from || !to) {
    from = addBusinessDays(now, -(DEFAULT_RANGE_DAYS - 1)) ?? now;
    to = now;
  }

  const range = isDayPreset
    ? String(days)
    : rawFrom || rawTo
      ? "custom"
      : String(DEFAULT_RANGE_DAYS);

  if ((from ?? now) > (to ?? now)) {
    const swap = from;
    from = to;
    to = swap;
  }

  return {
    from: startOfDay(from ?? now),
    to: endOfDay(to ?? now),
    range,
  };
}

export const formatDateInput = (date: Date) => formatBusinessDateInput(date);
