type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

type NotificationItem = {
  eventType: string;
  createdAt: string;
  status?: string;
  customerName?: string | null;
  payload?: Record<string, unknown> | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function word(locale: string, en: string, es: string) {
  return locale.toLowerCase().startsWith("es") ? es : en;
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatChangeType(changeType: string | null, locale: string) {
  if (!changeType) {
    return null;
  }
  const map: Record<string, [string, string]> = {
    ASSIGNED: ["Assigned", "Asignado"],
    UNASSIGNED: ["Unassigned", "Desasignado"],
    RESCHEDULED: ["Rescheduled", "Reprogramado"],
    REORDERED: ["Reordered", "Reordenado"],
  };
  const pair = map[changeType];
  if (!pair) {
    return changeType;
  }
  return locale.toLowerCase().startsWith("es") ? pair[1] : pair[0];
}

export function getNotificationTitle(eventType: string, t: TranslateFn) {
  const titleMap: Record<string, string> = {
    JOB_COMPLETED: t("notifications.jobCompleted"),
    CUSTOMER_REQUEST: t("notifications.customerRequest"),
    SERVICE_SCHEDULED: t("notifications.serviceScheduled"),
    SERVICE_RESCHEDULED: t("notifications.serviceRescheduled"),
    ROUTE_UPDATED: t("notifications.routeUpdated"),
    INVOICE_SENT: t("notifications.invoiceSent"),
  };
  return titleMap[eventType] ?? eventType.replaceAll("_", " ");
}

export function getNotificationDetail(
  item: NotificationItem,
  locale: string,
  t: TranslateFn
) {
  const payload =
    item.payload && typeof item.payload === "object"
      ? (item.payload as Record<string, unknown>)
      : {};

  const createdAt = formatDateTime(item.createdAt, locale);
  const scheduledDate = formatDateTime(
    asString(payload.scheduledDate),
    locale
  );
  const completedAt = formatDateTime(asString(payload.completedAt), locale);
  const preferredDate = formatDateTime(asString(payload.preferredDate), locale);
  const requestedAt = formatDateTime(asString(payload.requestedAt), locale);
  const count = asNumber(payload.count);
  const reason = asString(payload.reason);
  const email = asString(payload.email);
  const invoiceNumber =
    asString(payload.invoiceNumber) ??
    asString(payload.number) ??
    asString(payload.invoiceNo);
  const technicianName = asString(payload.technicianName);
  const changeType = formatChangeType(asString(payload.changeType), locale);
  const reviewRequired = asBoolean(payload.reviewRequired);
  const partial = asBoolean(payload.partial);

  if (item.eventType === "JOB_COMPLETED") {
    const parts = [
      technicianName ?? t("notifications.source.team"),
      completedAt ?? createdAt,
    ].filter(Boolean);
    return parts.join(" - ");
  }

  if (item.eventType === "CUSTOMER_REQUEST") {
    const parts = [
      requestedAt ?? createdAt,
      reason ?? t("notifications.requested"),
      count ? `${count} ${word(locale, "visit(s)", "visita(s)")}` : null,
      reviewRequired ? word(locale, "manual review", "revision manual") : null,
      partial ? word(locale, "partial schedule", "agenda parcial") : null,
      preferredDate
        ? `${word(locale, "preferred", "preferida")}: ${preferredDate}`
        : null,
    ].filter(Boolean);
    return parts.join(" - ");
  }

  if (item.eventType === "SERVICE_SCHEDULED") {
    const parts = [
      scheduledDate ?? createdAt,
      count ? `${count} ${word(locale, "visit(s)", "visita(s)")}` : null,
      reviewRequired ? word(locale, "manual review", "revision manual") : null,
      partial ? word(locale, "partial schedule", "agenda parcial") : null,
    ].filter(Boolean);
    return parts.join(" - ");
  }

  if (item.eventType === "SERVICE_RESCHEDULED") {
    return scheduledDate ?? createdAt ?? "";
  }

  if (item.eventType === "ROUTE_UPDATED") {
    const parts = [changeType, scheduledDate ?? createdAt].filter(Boolean);
    return parts.join(" - ");
  }

  if (item.eventType === "INVOICE_SENT") {
    const delivery =
      item.status === "FAILED"
        ? word(locale, "delivery failed", "envio fallido")
        : word(locale, "sent by email", "enviada por correo");
    const invoiceLabel = invoiceNumber
      ? `${word(locale, "Invoice", "Factura")} ${invoiceNumber}`
      : null;
    const emailLabel = email ? `${word(locale, "to", "a")} ${email}` : null;
    const parts = [
      invoiceLabel,
      delivery,
      emailLabel,
    ].filter(Boolean);
    return parts.join(" - ");
  }

  return createdAt ?? "";
}

export function getNotificationSource(
  item: NotificationItem,
  t: TranslateFn
) {
  const payload =
    item.payload && typeof item.payload === "object"
      ? (item.payload as Record<string, unknown>)
      : {};

  const explicitName =
    item.customerName ??
    asString(payload.technicianName) ??
    asString(payload.actorName) ??
    asString(payload.requestedByName) ??
    asString(payload.customerName);

  if (explicitName) {
    return explicitName;
  }

  if (item.eventType === "INVOICE_SENT") {
    return t("notifications.source.billing");
  }

  if (item.eventType === "ROUTE_UPDATED") {
    return t("notifications.source.operations");
  }

  return t("notifications.source.team");
}
