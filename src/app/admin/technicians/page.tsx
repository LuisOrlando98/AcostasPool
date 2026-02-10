import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import TechniciansOverview from "@/components/technicians/TechniciansOverview";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { getTranslations } from "@/i18n/server";

async function createTechnician(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();

  if (!fullName || !email || !password) {
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: "TECH",
      locale: "EN",
      isActive: true,
    },
  });

  await prisma.technician.create({
    data: {
      userId: user.id,
      phone: phone || null,
      notes: notes || null,
      colorHex: colorHex || null,
    },
  });

  revalidatePath("/admin/technicians");
}

export default async function TechniciansPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const [technicians, jobStats, todaysStats, activityStats] = await Promise.all([
    prisma.technician.findMany({
      select: {
        id: true,
        colorHex: true,
        phone: true,
        user: {
          select: {
            fullName: true,
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.job.groupBy({
      by: ["technicianId", "status"],
      where: { technicianId: { not: null } },
      _count: { _all: true },
    }),
    prisma.job.groupBy({
      by: ["technicianId"],
      where: {
        technicianId: { not: null },
        scheduledDate: { gte: startOfDay, lte: endOfDay },
      },
      _count: { _all: true },
    }),
    prisma.job.groupBy({
      by: ["technicianId"],
      where: { technicianId: { not: null } },
      _max: { updatedAt: true },
    }),
  ]);

  const statsByTechnician = new Map<
    string,
    { pending: number; completed: number }
  >();

  for (const stat of jobStats) {
    if (!stat.technicianId) {
      continue;
    }
    const current = statsByTechnician.get(stat.technicianId) ?? {
      pending: 0,
      completed: 0,
    };
    if (stat.status === "COMPLETED") {
      current.completed += stat._count._all;
    }
    if (["PENDING", "ON_THE_WAY", "IN_PROGRESS"].includes(stat.status)) {
      current.pending += stat._count._all;
    }
    statsByTechnician.set(stat.technicianId, current);
  }

  const todayByTechnician = new Map<string, number>();
  for (const stat of todaysStats) {
    if (!stat.technicianId) {
      continue;
    }
    todayByTechnician.set(stat.technicianId, stat._count._all);
  }

  const activityByTechnician = new Map<string, Date>();
  for (const stat of activityStats) {
    if (!stat.technicianId || !stat._max.updatedAt) {
      continue;
    }
    activityByTechnician.set(stat.technicianId, stat._max.updatedAt);
  }

  const rows = technicians.map((tech) => {
    const stats = statsByTechnician.get(tech.id) ?? {
      pending: 0,
      completed: 0,
    };
    return {
      id: tech.id,
      name: tech.user.fullName,
      email: tech.user.email,
      phone: tech.phone,
      isActive: tech.user.isActive,
      colorHex: tech.colorHex,
      pending: stats.pending,
      completed: stats.completed,
      todayCount: todayByTechnician.get(tech.id) ?? 0,
      lastActivity: activityByTechnician.get(tech.id)?.toISOString() ?? null,
    };
  });

  return (
    <AppShell
      title={t("admin.technicians.title")}
      subtitle={t("admin.technicians.subtitle")}
      role="ADMIN"
    >
      <section className="space-y-6">
        <input id="new-tech" type="checkbox" className="peer hidden" />
        <TechniciansOverview rows={rows} />

        <div className="fixed inset-0 z-[90] hidden items-center justify-center p-4 sm:p-6 peer-checked:flex">
          <label
            htmlFor="new-tech"
            className="absolute inset-0 bg-slate-900/60"
          />
          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-contrast">
            <div className="modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {t("admin.technicians.newTech.kicker")}
                  </p>
                  <h2 className="text-lg font-semibold">
                    {t("admin.technicians.newTech.title")}
                  </h2>
                </div>
                <label
                  htmlFor="new-tech"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300"
                  aria-label={t("common.actions.close")}
                  title={t("common.actions.close")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </label>
              </div>
              <form action={createTechnician} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.technicians.newTech.fields.fullName")}
                </label>
                <input
                  name="fullName"
                  className="app-input mt-2 w-full px-4 py-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("common.labels.email")}
                </label>
                <input
                  name="email"
                  type="email"
                  className="app-input mt-2 w-full px-4 py-3 text-sm"
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.phone")}
                  </label>
                  <input
                    name="phone"
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.technicians.newTech.fields.password")}
                  </label>
                  <input
                    name="password"
                    type="password"
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.technicians.newTech.fields.calendarColor")}
                  </label>
                  <input
                    name="colorHex"
                    type="color"
                    defaultValue="#38bdf8"
                    className="mt-2 h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.technicians.newTech.fields.notes")}
                </label>
                <textarea
                  name="notes"
                  className="app-input mt-2 min-h-[90px] w-full px-4 py-3 text-sm"
                />
              </div>
              <button className="app-button-primary w-full px-4 py-3 text-sm font-semibold">
                {t("admin.technicians.newTech.actions.create")}
              </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
