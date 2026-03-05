import AppShell from "@/components/layout/AppShell";
import AdminNotificationsCenter from "@/components/notifications/AdminNotificationsCenter";
import { getTranslations } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getNotificationPreferences } from "@/lib/notifications/preferences";

export default async function NotificationsPage() {
  const session = await requireRole("ADMIN");
  const t = await getTranslations();
  const { allowed, disabled } = await getNotificationPreferences(
    session.sub,
    session.role
  );
  const filtered = allowed.filter((eventType) => !disabled.has(eventType));
  if (filtered.length === 0) {
    return (
      <AppShell
        role="ADMIN"
        title={t("admin.notifications.title")}
        subtitle={t("admin.notifications.subtitle")}
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">
            {t("admin.notifications.emptyEnabled")}
          </p>
        </section>
      </AppShell>
    );
  }

  const notifications = await prisma.notification.findMany({
    where: {
      eventType: { in: filtered },
      recipientRole: "ADMIN",
      OR: [{ actorUserId: null }, { actorUserId: { not: session.sub } }],
    },
    include: {
      customer: true,
      actorUser: { select: { fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 240,
  });
  const asPayloadObject = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  };
  const asString = (value: unknown) => (typeof value === "string" ? value : null);
  const getLink = (payload: Record<string, unknown> | null) => {
    const jobId = asString(payload?.jobId);
    if (jobId) {
      return `/admin/routes?highlight=${jobId}`;
    }
    const invoiceId = asString(payload?.invoiceId);
    if (invoiceId) {
      return `/admin/invoices?highlight=${invoiceId}`;
    }
    const customerId = asString(payload?.customerId);
    if (customerId) {
      return `/admin/customers/${customerId}`;
    }
    return "/admin/notifications";
  };
  const serializedNotifications = notifications.map((item) => {
    const payload = asPayloadObject(item.payload);
    return {
      id: item.id,
      eventType: item.eventType,
      severity: item.severity,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt ? item.readAt.toISOString() : null,
      payload,
      customerName: item.customer ? formatCustomerName(item.customer) : t("userMenu.system"),
      actorName: item.actorUser?.fullName ?? null,
      actorEmail: item.actorUser?.email ?? null,
      link: getLink(payload),
    };
  });

  return (
    <AppShell
      role="ADMIN"
      title={t("admin.notifications.title")}
      subtitle={t("admin.notifications.subtitle")}
    >
      <AdminNotificationsCenter rows={serializedNotifications} />
    </AppShell>
  );
}
