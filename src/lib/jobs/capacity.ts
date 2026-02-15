export const TECH_DAILY_CAPACITY = 6;
export const SLOT_INTERVAL_MINUTES = 90;
export const SLOT_START_HOUR = 8;
export const MIN_BOOKING_LEAD_DAYS = 2;

const MINUTES_PER_DAY = 24 * 60;
const SLOT_START_MINUTES = SLOT_START_HOUR * 60;

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

export function toDateKey(value: Date) {
  return value.toLocaleDateString("en-CA");
}

export function isSunday(value: Date) {
  return value.getDay() === 0;
}

export function parseDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function getStartOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function getLeadStartDate(now = new Date(), leadDays = MIN_BOOKING_LEAD_DAYS) {
  const start = getStartOfDay(now);
  start.setDate(start.getDate() + Math.max(0, leadDays));
  return start;
}

export function getWeekStartKey(value: Date) {
  const date = getStartOfDay(value);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
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
}: {
  startDate: Date;
  days: number;
  techniciansCount: number;
  scheduledDates: Date[];
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
    const minutes =
      scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
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
    date.setDate(start.getDate() + offset);
    if (isSunday(date)) {
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
