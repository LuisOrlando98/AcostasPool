import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

export function combineDateAndTime(dateValue: string, timeValue: string) {
  const normalizedTime = /^(\d{1,2}):(\d{2})$/.exec(timeValue);
  if (!normalizedTime) {
    return new Date(Number.NaN);
  }
  const hours = normalizedTime[1].padStart(2, "0");
  const minutes = normalizedTime[2];
  const dateTime = DateTime.fromFormat(
    `${dateValue} ${hours}:${minutes}`,
    "yyyy-MM-dd HH:mm",
    { zone: BUSINESS_TIMEZONE }
  );
  return dateTime.isValid ? dateTime.toJSDate() : new Date(Number.NaN);
}

export function addPlanFrequency(date: Date, frequency: string) {
  const base = DateTime.fromJSDate(date).setZone(BUSINESS_TIMEZONE);
  switch (frequency) {
    case "BIWEEKLY":
      return base.plus({ weeks: 2 }).toUTC().toJSDate();
    case "MONTHLY":
      return base.plus({ months: 1 }).toUTC().toJSDate();
    case "WEEKLY":
    default:
      return base.plus({ weeks: 1 }).toUTC().toJSDate();
  }
}

