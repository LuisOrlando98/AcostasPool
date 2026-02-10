export const ADMIN_NOTIFICATION_TYPES = [
  "JOB_COMPLETED",
  "CUSTOMER_REQUEST",
] as const;

export const CUSTOMER_NOTIFICATION_TYPES = [
  "SERVICE_SCHEDULED",
  "SERVICE_RESCHEDULED",
  "ROUTE_UPDATED",
  "INVOICE_SENT",
] as const;

export const TECH_NOTIFICATION_TYPES = [] as const;

export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPES)[number];
export type CustomerNotificationType =
  (typeof CUSTOMER_NOTIFICATION_TYPES)[number];
export type TechNotificationType = (typeof TECH_NOTIFICATION_TYPES)[number];

export const ROLE_NOTIFICATION_TYPES = {
  ADMIN: ADMIN_NOTIFICATION_TYPES,
  CUSTOMER: CUSTOMER_NOTIFICATION_TYPES,
  TECH: TECH_NOTIFICATION_TYPES,
} as const;
