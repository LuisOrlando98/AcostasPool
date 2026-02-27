export const TECH_DAILY_CAPACITY = 6;
export const SLOT_INTERVAL_MINUTES = 90;
export const SLOT_START_HOUR = 8;
export const MIN_BOOKING_LEAD_DAYS = 2;
export const BUSINESS_TIMEZONE =
  process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE ||
  process.env.BUSINESS_TIMEZONE ||
  "America/New_York";

const MINUTES_PER_DAY = 24 * 60;
const SLOT_START_MINUTES = SLOT_START_HOUR * 60;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
});

export type TimeSlot = {
  value: string;
  minutes: number;
};

export type AvailabilityDay = {
  date: string;
  totalCapacity: number;
  usedCapacity: number;
  remainingCapacity: number;
  slots: Array<{
    value: string;
    remaining: number;
  }>;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

function getTimeParts(value: Date) {
  const parts = timePartsFormatter.formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0"
  );
  return { hour, minute };
}

export function toDateKey(value: Date) {
  const parts = dateKeyFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (year && month && day) {
    return `${year}-${month}-${day}`;
  }
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(
    value.getUTCDate()
  )}`;
}

export function isSunday(value: Date) {
  const parsed = parseDateOnly(toDateKey(value));
  if (!parsed) {
    return value.getUTCDay() === 0;
  }
  return parsed.getUTCDay() === 0;
}

export function parseDateOnly(value: string) {
  const parts = parseDateParts(value);
  if (!parts) {
    return null;
  }
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0));
}

export function getStartOfDay(value: Date) {
  const parsed = parseDateOnly(toDateKey(value));
  if (parsed) {
    return parsed;
  }
  const next = new Date(value);
  next.setUTCHours(12, 0, 0, 0);
  return next;
}

export function getLeadStartDate(now = new Date(), leadDays = MIN_BOOKING_LEAD_DAYS) {
  const start = getStartOfDay(now);
  start.setUTCDate(start.getUTCDate() + Math.max(0, leadDays));
  return start;
}

export function getWeekStartKey(value: Date) {
  const date = getStartOfDay(value);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return toDateKey(date);
}

export function getDailyCapacity(techniciansCount: number) {
  return Math.max(0, techniciansCount) * TECH_DAILY_CAPACITY;
}

export function getTimeSlots() {
  const slots: TimeSlot[] = [];
  for (let index = 0; index < TECH_DAILY_CAPACITY; index += 1) {
    const minutes = SLOT_START_MINUTES + index * SLOT_INTERVAL_MINUTES;
    if (minutes >= 0 && minutes < MINUTES_PER_DAY) {
      slots.push({
        value: minutesToTimeValue(minutes),
        minutes,
      });
    }
  }
  return slots;
}

export function minutesToTimeValue(minutes: number) {
  const safe = Math.max(0, Math.min(minutes, MINUTES_PER_DAY - 1));
  const hours = String(Math.floor(safe / 60)).padStart(2, "0");
  const mins = String(safe % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

export function timeValueToMinutes(value: string) {
  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  const total = hours * 60 + minutes;
  if (total < 0 || total >= MINUTES_PER_DAY) {
    return null;
  }
  return total;
}

function getSlotIndex(minutes: number, slots: TimeSlot[]) {
  return slots.findIndex((slot) => slot.minutes === minutes);
}

export function buildAvailabilityDays({
  startDate,
  days,
  techniciansCount,
  scheduledDates,
  includeSaturday = false,
  includeSunday = false,
}: {
  startDate: Date;
  days: number;
  techniciansCount: number;
  scheduledDates: Date[];
  includeSaturday?: boolean;
  includeSunday?: boolean;
}) {
  const slots = getTimeSlots();
  const slotValues = slots.map((slot) => slot.value);
  const slotCapacity = Math.max(0, techniciansCount);
  const totalCapacity = getDailyCapacity(techniciansCount);
  const safeDays = Math.max(1, days);

  const usedByDay = new Map<string, { total: number; slotUsage: number[]; unslotted: number }>();
  for (const scheduledDate of scheduledDates) {
    const key = toDateKey(scheduledDate);
    const current = usedByDay.get(key) ?? {
      total: 0,
      slotUsage: Array.from({ length: slots.length }, () => 0),
      unslotted: 0,
    };
    current.total += 1;
    const timeParts = getTimeParts(scheduledDate);
    const minutes = timeParts.hour * 60 + timeParts.minute;
    const slotIndex = getSlotIndex(minutes, slots);
    if (slotIndex === -1) {
      current.unslotted += 1;
    } else {
      current.slotUsage[slotIndex] += 1;
    }
    usedByDay.set(key, current);
  }

  const start = getStartOfDay(startDate);
  const availability: AvailabilityDay[] = [];

  for (let offset = 0; offset < safeDays; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    const weekDay = date.getUTCDay();
    if ((weekDay === 6 && !includeSaturday) || (weekDay === 0 && !includeSunday)) {
      continue;
    }

    const key = toDateKey(date);
    const usage = usedByDay.get(key);
    const usedCapacity = usage?.total ?? 0;
    const remainingCapacity = Math.max(0, totalCapacity - usedCapacity);
    const baseSlotRemaining = slotValues.map((_, index) =>
      Math.max(0, slotCapacity - (usage?.slotUsage[index] ?? 0))
    );

    let unslotted = usage?.unslotted ?? 0;
    if (unslotted > 0) {
      for (let index = 0; index < baseSlotRemaining.length && unslotted > 0; index += 1) {
        const canReduce = Math.min(baseSlotRemaining[index], unslotted);
        baseSlotRemaining[index] -= canReduce;
        unslotted -= canReduce;
      }
    }

    const slotsForDay = slotValues.map((value, index) => ({
      value,
      remaining: baseSlotRemaining[index],
    }));

    availability.push({
      date: key,
      totalCapacity,
      usedCapacity,
      remainingCapacity,
      slots: slotsForDay,
    });
  }

  return availability;
}
