import AppShell from "@/components/layout/AppShell";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import {
  getNotificationDetail,
  getNotificationTitle,
} from "@/lib/notifications/view";
import { getNotificationPreferences } from "@/lib/notifications/preferences";

export default async function NotificationsPage() {
  const session = await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();
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
          <p className="text-sm text-slate-500">No notifications enabled.</p>
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
    take: 120,
  });

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const failedCount = notifications.filter((item) => item.status === "FAILED").length;

  return (
    <AppShell
      role="ADMIN"
      title={t("admin.notifications.title")}
      subtitle={t("admin.notifications.subtitle")}
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Total
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {notifications.length}
          </p>
        </article>
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Unread
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {unreadCount}
          </p>
        </article>
        <article className="app-card p-5 shadow-contrast">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Failed
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {failedCount}
          </p>
        </article>
      </section>

      <section className="app-card p-6 shadow-contrast">
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications yet.</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((item) => {
              const payload =
                item.payload && typeof item.payload === "object"
                  ? (item.payload as Record<string, unknown>)
                  : null;
              const customerName = item.customer
                ? formatCustomerName(item.customer)
                : t("userMenu.system");
              const title = getNotificationTitle(item.eventType, t);
              const detail = getNotificationDetail(
                {
                  eventType: item.eventType,
                  createdAt: item.createdAt.toISOString(),
                  payload: payload ?? null,
                  status: item.status,
                },
                locale,
                t
              );
              const jobId =
                payload && typeof payload.jobId === "string"
                  ? payload.jobId
                  : null;
              const link = jobId ? `/admin/routes?highlight=${jobId}` : null;

              return (
                <a
                  key={item.id}
                  href={link ?? "/admin/notifications"}
                  className={`block rounded-2xl border px-4 py-4 transition ${
                    item.readAt
                      ? "border-slate-200 bg-white hover:border-slate-300"
                      : "border-sky-200 bg-sky-50/50 hover:border-sky-300"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {title}
                    </p>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span
                        className={`rounded-full px-2 py-1 font-semibold uppercase tracking-[0.16em] ${
                          item.status === "FAILED"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.status}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 font-semibold uppercase tracking-[0.16em] ${
                          item.readAt
                            ? "bg-slate-100 text-slate-600"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {item.readAt ? t("notifications.read") : t("notifications.unread")}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {customerName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{detail}</p>
                  {item.actorUser ? (
                    <p className="mt-2 text-[11px] text-slate-400">
                      Actor: {item.actorUser.fullName} ({item.actorUser.email})
                    </p>
                  ) : null}
                </a>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
