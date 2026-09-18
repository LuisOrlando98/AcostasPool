import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const TIME_VALUE_PATTERN = /^(\d{1,2}):(\d{2})$/;

export function combineDateAndTime(dateValue: string, timeValue: string) {
  const normalizedTime = TIME_VALUE_PATTERN.exec(timeValue);
  if (!normalizedTime) {
    return new Date(Number.NaN);
  }
  // Luxon aceptaría "24:00" como medianoche del día siguiente: se valida el rango aquí.
  const hourValue = Number(normalizedTime[1]);
  const minuteValue = Number(normalizedTime[2]);
  if (hourValue >= HOURS_PER_DAY || minuteValue >= MINUTES_PER_HOUR) {
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

