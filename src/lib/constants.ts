export const ROLES = ["ADMIN", "TECH", "CUSTOMER"] as const;

export const JOB_STATUSES = [
  "SCHEDULED",
  "PENDING",
  "ON_THE_WAY",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

export const JOB_STATUS_LABELS: Record<
  (typeof JOB_STATUSES)[number],
  string
> = {
  SCHEDULED: "Scheduled",
  PENDING: "Pending",
  ON_THE_WAY: "On the way",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export const JOB_STATUS_KEYS: Record<
  (typeof JOB_STATUSES)[number],
  string
> = {
  SCHEDULED: "jobs.status.scheduled",
  PENDING: "jobs.status.pending",
  ON_THE_WAY: "jobs.status.onTheWay",
  IN_PROGRESS: "jobs.status.inProgress",
  COMPLETED: "jobs.status.completed",
};

export const getJobStatusLabel = (
  status?: string | null,
  t?: (key: string) => string
) => {
  if (!status) {
    return "";
  }
  const key = JOB_STATUS_KEYS[status as keyof typeof JOB_STATUS_KEYS];
  if (t && key) {
    return t(key);
  }
  return JOB_STATUS_LABELS[status as keyof typeof JOB_STATUS_LABELS] ?? status;
};

export const JOB_TYPES = ["ROUTINE", "ON_DEMAND"] as const;

export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
] as const;
