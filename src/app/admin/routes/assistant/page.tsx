import AppShell from "@/components/layout/AppShell";
import RouteAssistant from "@/components/routes/RouteAssistant";
import RoutesSectionTabs from "@/components/routes/RoutesSectionTabs";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { toDateKey } from "@/lib/jobs/capacity";
import { getTranslations } from "@/i18n/server";

type RouteAssistantPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveDate(rawValue?: string) {
  if (rawValue && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }
  return toDateKey(new Date());
}

export default async function RouteAssistantPage({
  searchParams,
}: RouteAssistantPageProps) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const dateRaw = resolvedSearchParams?.date;
  const dateParam = Array.isArray(dateRaw) ? dateRaw[0] : dateRaw;

  const technicians = await prisma.technician.findMany({
    where: { user: { isActive: true } },
    orderBy: { user: { fullName: "asc" } },
    select: {
      id: true,
      user: { select: { fullName: true } },
    },
  });

  return (
    <AppShell
      title={t("admin.routes.assistant.pageTitle")}
      subtitle={t("admin.routes.assistant.pageSubtitle")}
      role="ADMIN"
      wide
    >
      <div className="space-y-4">
        <RoutesSectionTabs />
        <RouteAssistant
          initialDate={resolveDate(dateParam)}
          technicians={technicians.map((technician) => ({
            id: technician.id,
            name: technician.user.fullName,
          }))}
        />
      </div>
    </AppShell>
  );
}
