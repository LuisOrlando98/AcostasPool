import AppShell from "@/components/layout/AppShell";
import NewRequestForm from "@/components/client/NewRequestForm";
import RequestProgressList from "@/components/client/RequestProgressList";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { getRequestLocale, getTranslations } from "@/i18n/server";

export default async function ClientRequestPage() {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });

  const activeRequests = customer
    ? await prisma.job.findMany({
        where: {
          customerId: customer.id,
          type: "ON_DEMAND",
          status: { not: "COMPLETED" },
        },
        orderBy: { requestedAt: "desc" },
        select: {
          id: true,
          status: true,
          priority: true,
          requestCategory: true,
          requestIssue: true,
          requestedAt: true,
          createdAt: true,
          technician: { select: { user: { select: { fullName: true } } } },
        },
      })
    : [];

  return (
    <AppShell
      title={t("client.request.title")}
      subtitle={t("client.request.subtitle")}
      role="CUSTOMER"
    >
      {activeRequests.length > 0 ? (
        <div className="mb-6">
          <RequestProgressList
            requests={activeRequests.map((request) => ({
              id: request.id,
              status: request.status,
              priority: request.priority,
              requestCategory: request.requestCategory,
              requestIssue: request.requestIssue,
              requestedAt: request.requestedAt?.toISOString() ?? null,
              createdAt: request.createdAt.toISOString(),
              technicianName: request.technician?.user.fullName ?? null,
            }))}
            locale={locale}
            t={t}
          />
        </div>
      ) : null}

      <NewRequestForm />
    </AppShell>
  );
}
