import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import { combineDateAndTime } from "@/lib/jobs/scheduling";

export const DEFAULT_GLOBAL_PLAN_TIME = "09:00";
export const CUSTOM_SERVICE_PLAN_NAME = "Custom Service";

export type GlobalRecurringPlanKey =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY";

type GlobalRecurringPlanOption = {
  value: GlobalRecurringPlanKey;
  name: string;
  weekday: number;
  labelKey: string;
};

export const GLOBAL_RECURRING_PLAN_OPTIONS: GlobalRecurringPlanOption[] = [
  {
    value: "MONDAY",
    name: "Monday Plan",
    weekday: 1,
    labelKey: "admin.customers.detail.plans.globalOptions.monday",
  },
  {
    value: "TUESDAY",
    name: "Tuesday Plan",
    weekday: 2,
    labelKey: "admin.customers.detail.plans.globalOptions.tuesday",
  },
  {
    value: "WEDNESDAY",
    name: "Wednesday Plan",
    weekday: 3,
    labelKey: "admin.customers.detail.plans.globalOptions.wednesday",
  },
  {
    value: "THURSDAY",
    name: "Thursday Plan",
    weekday: 4,
    labelKey: "admin.customers.detail.plans.globalOptions.thursday",
  },
  {
    value: "FRIDAY",
    name: "Friday Plan",
    weekday: 5,
    labelKey: "admin.customers.detail.plans.globalOptions.friday",
  },
  {
    value: "SATURDAY",
    name: "Saturday Plan",
    weekday: 6,
    labelKey: "admin.customers.detail.plans.globalOptions.saturday",
  },
];

const globalRecurringPlanLabelsByName = new Map(
  GLOBAL_RECURRING_PLAN_OPTIONS.map((option) => [option.name, option.labelKey])
);

const globalRecurringPlanKeysByName = new Map(
  GLOBAL_RECURRING_PLAN_OPTIONS.map((option) => [option.name, option.value])
);

export function getGlobalRecurringPlan(
  value: string
): GlobalRecurringPlanOption | null {
  return (
    GLOBAL_RECURRING_PLAN_OPTIONS.find((option) => option.value === value) ?? null
  );
}

export function getRecurringPlanLabelKey(name: string) {
  return globalRecurringPlanLabelsByName.get(name) ?? null;
}

export function getGlobalRecurringPlanKeyByName(name: string) {
  return globalRecurringPlanKeysByName.get(name) ?? null;
}

export function isGlobalRecurringPlanName(name: string) {
  return globalRecurringPlanKeysByName.has(name);
}

export function buildRecurringRouteGroupId(input: {
  planName: string;
  technicianId?: string | null;
}) {
  const planKey = getGlobalRecurringPlanKeyByName(input.planName);
  const normalizedPlanKey =
    planKey ??
    input.planName
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase() ||
    "PLAN";
  const technicianKey = input.technicianId?.trim() || "UNASSIGNED";
  return `${normalizedPlanKey}::${technicianKey}`;
}

export function buildRecurringRouteGroupLabel(input: {
  planName: string;
  technicianName?: string | null;
}) {
  return input.technicianName?.trim()
    ? `${input.planName} :: ${input.technicianName.trim()}`
    : `${input.planName} :: Unassigned`;
}

export function resolveGlobalPlanStartDate(
  startDate: string,
  planKey: string,
  timeValue = DEFAULT_GLOBAL_PLAN_TIME
) {
  const option = getGlobalRecurringPlan(planKey);
  const date = combineDateAndTime(startDate, timeValue);
  if (!option || Number.isNaN(date.getTime())) {
    return date;
  }

  const base = DateTime.fromJSDate(date).setZone(BUSINESS_TIMEZONE);
  const daysToAdd = (option.weekday - base.weekday + 7) % 7;
  return base.plus({ days: daysToAdd }).toUTC().toJSDate();
}
