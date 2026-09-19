import AppShell from "@/components/layout/AppShell";
import RouteAssistant from "@/components/routes/assistant/RouteAssistant";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { toDateKey } from "@/lib/jobs/capacity";
import { GLOBAL_RECURRING_PLAN_OPTIONS } from "@/lib/jobs/recurring-plan-templates";
import { getRouteAssistantConfig } from "@/lib/site-settings";
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
  const resolvedDate = resolveDate(dateParam);

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
  // Sin plan preseleccionado: la propuesta cubre por defecto la jornada
  // completa (planes recurrentes y trabajos bajo demanda). Elegir un plan
  // sigue acotando el alcance y alineando la fecha con ese día.
  const initialPlanTemplate = null;

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
          originAddress={routeAssistantConfig.originAddress}
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
