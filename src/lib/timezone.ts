import { DateTime } from "luxon";

export const BUSINESS_TIMEZONE =
  process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE ||
  process.env.BUSINESS_TIMEZONE ||
  "America/New_York";

const businessTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
});

function asDate(value: Date | string | number) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const next = new Date(value);
  if (Number.isNaN(next.getTime())) {
    return null;
  }
  return next;
}

export function formatInBusinessTimeZone(
  value: Date | string | number,
  locale: string,
  options: Intl.DateTimeFormatOptions
) {
  const date = asDate(value);
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: BUSINESS_TIMEZONE,
  }).format(date);
}

export function getBusinessNow() {
  return DateTime.now().setZone(BUSINESS_TIMEZONE);
}

export function startOfBusinessDay(value: Date | string | number) {
  const date = asDate(value);
  if (!date) {
    return null;
  }
  return DateTime.fromJSDate(date)
    .setZone(BUSINESS_TIMEZONE)
    .startOf("day")
    .toUTC()
    .toJSDate();
}

export function endOfBusinessDay(value: Date | string | number) {
  const date = asDate(value);
  if (!date) {
    return null;
  }
  return DateTime.fromJSDate(date)
    .setZone(BUSINESS_TIMEZONE)
    .endOf("day")
    .toUTC()
    .toJSDate();
}

export function addBusinessDays(value: Date | string | number, days: number) {
  const date = asDate(value);
  if (!date) {
    return null;
  }
  return DateTime.fromJSDate(date)
    .setZone(BUSINESS_TIMEZONE)
    .plus({ days })
    .toUTC()
    .toJSDate();
}

export function parseBusinessDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = DateTime.fromFormat(value, "yyyy-MM-dd", {
    zone: BUSINESS_TIMEZONE,
  });
  if (!parsed.isValid) {
    return null;
  }
  return parsed.startOf("day").toUTC().toJSDate();
}

export function parseBusinessDateTimeInput(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return null;
  }
  const normalizedTime = /^\d{2}:\d{2}$/.test(timeValue) ? timeValue : "00:00";
  const parsed = DateTime.fromFormat(
    `${dateValue} ${normalizedTime}`,
    "yyyy-MM-dd HH:mm",
    { zone: BUSINESS_TIMEZONE }
  );
  if (!parsed.isValid) {
    return null;
  }
  return parsed.toUTC().toJSDate();
}

export function formatBusinessDateInput(value: Date | string | number) {
  const date = asDate(value);
  if (!date) {
    return "";
  }
  return DateTime.fromJSDate(date).setZone(BUSINESS_TIMEZONE).toFormat("yyyy-MM-dd");
}

export function getBusinessTimeParts(value: Date | string | number) {
  const date = asDate(value);
  if (!date) {
    return null;
  }
  const parts = businessTimePartsFormatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

export function applyBusinessTime(
  baseDate: Date | string | number,
  timeSource: Date | string | number
) {
  const base = asDate(baseDate);
  const source = asDate(timeSource);
  if (!base || !source) {
    return null;
  }
  const baseDt = DateTime.fromJSDate(base).setZone(BUSINESS_TIMEZONE);
  const sourceDt = DateTime.fromJSDate(source).setZone(BUSINESS_TIMEZONE);
  return baseDt
    .set({
      hour: sourceDt.hour,
      minute: sourceDt.minute,
      second: 0,
      millisecond: 0,
    })
    .toUTC()
    .toJSDate();
}
