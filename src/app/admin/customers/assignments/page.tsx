import AppShell from "@/components/layout/AppShell";
import CustomersSectionTabs from "@/components/customers/CustomersSectionTabs";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { formatCustomerName } from "@/lib/customers/format";
import {
  buildRecurringRouteGroupId,
  getRecurringPlanLabelKey,
  GLOBAL_RECURRING_PLAN_OPTIONS,
} from "@/lib/jobs/recurring-plan-templates";
import { formatInBusinessTimeZone } from "@/lib/timezone";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { revalidatePath } from "next/cache";

type AssignmentRow = {
  id: string;
  rawPlanName: string;
  localizedPlanName: string;
  routeGroupId: string;
  technicianId: string | null;
  technicianName: string;
  customerName: string;
  propertyLabel: string;
  nextRunAt: string;
  isActive: boolean;
  notes: string | null;
};

export default async function CustomerAssignmentsPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const globalPlanNames = GLOBAL_RECURRING_PLAN_OPTIONS.map((option) => option.name);
  const weekdayOrder = new Map(
    GLOBAL_RECURRING_PLAN_OPTIONS.map((option, index) => [option.name, index])
  );

  async function reassignTechnician(formData: FormData) {
    "use server";
    await requireRole("ADMIN");
    const planId = String(formData.get("planId") ?? "").trim();
    const technicianId = String(formData.get("technicianId") ?? "").trim();
    if (!planId) return;
    await prisma.servicePlan.update({
      where: { id: planId },
      data: { technicianId: technicianId || null },
    });
    revalidatePath("/admin/customers/assignments");
    revalidatePath("/admin/routes");
  }

  const [plans, technicians] = await Promise.all([
    prisma.servicePlan.findMany({
      where: { name: { in: globalPlanNames } },
      orderBy: [{ name: "asc" }, { nextRunAt: "asc" }],
      select: {
        id: true,
        name: true,
        nextRunAt: true,
        isActive: true,
        notes: true,
        customer: { select: { nombre: true, apellidos: true } },
        property: { select: { name: true, address: true } },
        technician: { select: { id: true, user: { select: { fullName: true } } } },
      },
    }),
    prisma.technician.findMany({
      where: { user: { isActive: true } },
      select: { id: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
  ]);

  const assignmentRows: AssignmentRow[] = plans
    .map((plan) => {
      const labelKey = getRecurringPlanLabelKey(plan.name);
      const localizedPlanName = labelKey ? t(labelKey) : plan.name;
      return {
        id: plan.id,
        rawPlanName: plan.name,
        localizedPlanName,
        routeGroupId: buildRecurringRouteGroupId({
          planName: plan.name,
          technicianId: plan.technician?.id ?? null,
        }),
        technicianId: plan.technician?.id ?? null,
        technicianName: plan.technician?.user.fullName ?? t("admin.customers.assignments.unassigned"),
        customerName: formatCustomerName(plan.customer),
        propertyLabel: plan.property.name
          ? `${plan.property.name} - ${plan.property.address}`
          : plan.property.address,
        nextRunAt: formatInBusinessTimeZone(plan.nextRunAt.toISOString(), locale, {
          dateStyle: "medium",
        }),
        isActive: plan.isActive,
        notes: plan.notes,
      };
    })
    .sort((a, b) => {
      const aOrder = weekdayOrder.get(a.rawPlanName);
      const bOrder = weekdayOrder.get(b.rawPlanName);
      return (
        (aOrder ?? 999) - (bOrder ?? 999) ||
        a.technicianName.localeCompare(b.technicianName) ||
        a.customerName.localeCompare(b.customerName)
      );
    });

  const grouped = Array.from(
    assignmentRows.reduce((map, row) => {
      const group = map.get(row.routeGroupId) ?? {
        routeGroupId: row.routeGroupId,
        rawPlanName: row.rawPlanName,
        planName: row.localizedPlanName,
        technicianName: row.technicianName,
        rows: [] as AssignmentRow[],
      };
      group.rows.push(row);
      map.set(row.routeGroupId, group);
      return map;
    }, new Map<string, { routeGroupId: string; rawPlanName: string; planName: string; technicianName: string; rows: AssignmentRow[] }>())
  )
    .map(([, group]) => group)
    .sort(
      (a, b) =>
        (weekdayOrder.get(a.rawPlanName) ?? 999) -
          (weekdayOrder.get(b.rawPlanName) ?? 999) ||
        a.technicianName.localeCompare(b.technicianName)
    );

  const activeAssignments = assignmentRows.filter((row) => row.isActive).length;
  const technicianCount = new Set(
    assignmentRows
      .map((row) => row.technicianName)
      .filter((name) => name !== t("admin.customers.assignments.unassigned"))
  ).size;

  return (
    <AppShell
      title={t("admin.customers.title")}
      subtitle={t("admin.customers.subtitle")}
      role="ADMIN"
    >
      <div className="mb-4 flex justify-end">
        <CustomersSectionTabs />
      </div>

      <section className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                {t("admin.customers.assignments.kicker")}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                {t("admin.customers.assignments.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("admin.customers.assignments.subtitle")}
              </p>
            </div>
            <span className="app-chip px-3 py-1 text-xs" data-tone="info">
              {t("admin.customers.assignments.results", {
                count: assignmentRows.length,
              })}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.customers.assignments.cards.assignments")}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {assignmentRows.length}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                {t("admin.customers.assignments.cards.active")}
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-900">
                {activeAssignments}
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-700">
                {t("admin.customers.assignments.cards.routeGroups")}
              </p>
              <p className="mt-1 text-xl font-semibold text-cyan-900">
                {grouped.length}
              </p>
              <p className="text-xs text-cyan-700">
                {t("admin.customers.assignments.cards.technicians", {
                  count: technicianCount,
                })}
              </p>
            </div>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
            {t("admin.customers.assignments.empty")}
          </div>
        ) : (
          grouped.map((group) => (
            <section
              key={group.routeGroupId}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {group.planName}
                  </p>
                  <h3 className="text-base font-semibold text-slate-900">
                    {group.technicianName}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">
                    {t("admin.customers.assignments.groupCount", {
                      count: group.rows.length,
                    })}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1060px] text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200 bg-white text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">
                        {t("admin.customers.assignments.table.customer")}
                      </th>
                      <th className="px-4 py-3">
                        {t("admin.customers.assignments.table.property")}
                      </th>
                      <th className="px-4 py-3">
                        {t("admin.customers.assignments.table.next")}
                      </th>
                      <th className="px-4 py-3">
                        {t("admin.customers.assignments.table.status")}
                      </th>
                      <th className="px-4 py-3">
                        {t("admin.customers.assignments.table.notes")}
                      </th>
                      <th className="px-4 py-3 text-right">
                        {t("admin.customers.assignments.table.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((row) => (
                      <tr key={row.id} className="bg-white transition hover:bg-sky-50/40">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {row.customerName}
                        </td>
                        <td className="px-4 py-3">{row.propertyLabel}</td>
                        <td className="px-4 py-3">{row.nextRunAt}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                              row.isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {row.isActive
                              ? t("common.status.active")
                              : t("admin.customers.plans.status.paused")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {row.notes || t("common.labels.notAvailable")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <form action={reassignTechnician} className="flex items-center justify-end gap-2">
                            <input type="hidden" name="planId" value={row.id} />
                            <select
                              name="technicianId"
                              defaultValue={row.technicianId ?? ""}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                            >
                              <option value="">{t("admin.customers.assignments.unassigned")}</option>
                              {technicians.map((tech) => (
                                <option key={tech.id} value={tech.id}>
                                  {tech.user.fullName}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                            >
                              {t("admin.customers.assignments.actions.reassign")}
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </section>
    </AppShell>
  );
}
