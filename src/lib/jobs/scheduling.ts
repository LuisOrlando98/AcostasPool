import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/lib/jobs/capacity";

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
  const next = new Date(date);
  switch (frequency) {
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "WEEKLY":
    default:
      next.setDate(next.getDate() + 7);
      break;
  }
  return next;
}

