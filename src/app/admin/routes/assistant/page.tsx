import AppShell from "@/components/layout/AppShell";
import RouteAssistant from "@/components/routes/RouteAssistant";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { toDateKey } from "@/lib/jobs/capacity";
import {
  getGlobalRecurringPlanByWeekday,
  GLOBAL_RECURRING_PLAN_OPTIONS,
} from "@/lib/jobs/recurring-plan-templates";
import { getRouteAssistantConfig } from "@/lib/site-settings";
import { getTranslations } from "@/i18n/server";
import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

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
  const resolvedDate = resolveDate(dateParam);
  const routeDateWeekday = DateTime.fromISO(resolvedDate, {
    zone: BUSINESS_TIMEZONE,
  }).weekday;

  const [technicians, routeAssistantConfig] = await Promise.all([
    prisma.technician.findMany({
      where: { user: { isActive: true } },
      orderBy: { user: { fullName: "asc" } },
      select: {
        id: true,
        user: { select: { fullName: true } },
      },
    }),
    getRouteAssistantConfig(),
  ]);
  const initialPlanTemplate =
    getGlobalRecurringPlanByWeekday(routeDateWeekday)?.value ?? null;

  return (
    <AppShell
      title={t("admin.routes.assistant.pageTitle")}
      subtitle={t("admin.routes.assistant.pageSubtitle")}
      role="ADMIN"
      wide
    >
      <div className="space-y-4">
        <RouteAssistant
          initialDate={resolvedDate}
          initialPlanTemplate={initialPlanTemplate}
          autoOptimizeEnabled={routeAssistantConfig.dailyAutoOptimizeEnabled}
          planOptions={GLOBAL_RECURRING_PLAN_OPTIONS.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          technicians={technicians.map((technician) => ({
            id: technician.id,
            name: technician.user.fullName,
          }))}
        />
      </div>
    </AppShell>
  );
}
