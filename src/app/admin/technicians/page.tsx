import crypto from "crypto";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import TechniciansOverview from "@/components/technicians/TechniciansOverview";
import TechnicianCreateForm from "@/components/technicians/TechnicianCreateForm";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { getTranslations } from "@/i18n/server";
import { normalizeEmail } from "@/lib/auth/email";
import { normalizeUsPhone } from "@/lib/phones";
import { sendTechnicianInvite } from "@/lib/technicians/invite";

type CreateTechnicianActionState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<"firstName" | "lastName" | "email" | "phone" | "colorHex" | "notes", string>
  >;
};

async function createTechnician(formData: FormData): Promise<CreateTechnicianActionState> {
  "use server";
  await requireRole("ADMIN");

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = normalizeUsPhone(phoneRaw);
  const notes = String(formData.get("notes") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "").trim();

  if (!firstName || !lastName || !email || !phoneRaw || !phone) {
    const phoneError = !phoneRaw ? "Required" : !phone ? "Invalid phone format" : undefined;
    return {
      ok: false,
      error: "Missing required fields",
      fieldErrors: {
        firstName: !firstName ? "Required" : undefined,
        lastName: !lastName ? "Required" : undefined,
        email: !email ? "Required" : undefined,
        phone: phoneError,
      },
    } satisfies CreateTechnicianActionState;
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser) {
    return {
      ok: false,
      error: "Email already in use",
      fieldErrors: {
        email: "Email already in use",
      },
    } satisfies CreateTechnicianActionState;
  }

  const tempPassword = crypto.randomBytes(24).toString("hex");
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: "TECH",
      locale: "EN",
      isActive: false,
    },
  });

  const technician = await prisma.technician.create({
    data: {
      userId: user.id,
      phone,
      notes: notes || null,
      colorHex: colorHex || null,
    },
  });

  try {
    const invite = await sendTechnicianInvite(technician.id);
    if (!invite.ok) {
      return {
        ok: false,
        error:
          "Technician was created, but invitation email could not be sent. Check SMTP settings and resend invite.",
      } satisfies CreateTechnicianActionState;
    }
  } catch (error) {
    console.error("Technician invite failed:", error);
    return {
      ok: false,
      error:
        "Technician was created, but invitation email could not be sent. Check SMTP settings and resend invite.",
    } satisfies CreateTechnicianActionState;
  }

  revalidatePath("/admin/technicians");
  return { ok: true } satisfies CreateTechnicianActionState;
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
              <TechnicianCreateForm createTechnicianAction={createTechnician} />
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
