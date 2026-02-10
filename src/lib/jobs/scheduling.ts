export function combineDateAndTime(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}:00`);
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

