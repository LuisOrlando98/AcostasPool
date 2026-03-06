import Link from "next/link";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import TechnicianJobsTables from "@/components/technicians/TechnicianJobsTables";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { resolveParams } from "@/lib/utils/params";
import { formatCustomerName } from "@/lib/customers/format";
import { formatUsPhone, normalizeUsPhone } from "@/lib/phones";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { sendTechnicianInvite } from "@/lib/technicians/invite";
import {
  endOfBusinessDay,
  formatInBusinessTimeZone,
  startOfBusinessDay,
} from "@/lib/timezone";

async function updateTechnician(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const technicianId = String(formData.get("technicianId"));
  const userId = String(formData.get("userId"));
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = normalizeUsPhone(phoneRaw) ?? phoneRaw;
  const notes = String(formData.get("notes") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "true") === "true";
  const colorHex = String(formData.get("colorHex") ?? "").trim();

  if (!technicianId || !userId) {
    return;
  }

  await prisma.technician.update({
    where: { id: technicianId },
    data: {
      phone: phone || null,
      notes: notes || null,
      colorHex: colorHex || null,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  revalidatePath(`/admin/technicians/${technicianId}`);
  revalidatePath("/admin/technicians");
}

async function inviteTechnician(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const technicianId = String(formData.get("technicianId") ?? "").trim();
  if (!technicianId) {
    return;
  }

  try {
    const result = await sendTechnicianInvite(technicianId);
    if (!result.ok) {
      console.error("Technician invite failed:", result.error);
    }
  } catch (error) {
    console.error("Technician invite failed:", error);
  }

  revalidatePath(`/admin/technicians/${technicianId}`);
  revalidatePath("/admin/technicians");
}

export default async function TechnicianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const resolvedParams = await resolveParams(params);
  const techId = resolvedParams?.id;

  if (!techId) {
    return (
      <AppShell
        title={t("admin.technicians.detail.notFoundTitle")}
        subtitle={t("admin.technicians.detail.notFoundSubtitle")}
        role="ADMIN"
      >
        <Link href="/admin/technicians" className="text-sm text-slate-600">
          {t("admin.technicians.detail.actions.back")}
        </Link>
      </AppShell>
    );
  }

  const technician = await prisma.technician.findUnique({
    where: { id: techId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
          passwordResetTokens: {
            where: { purpose: "INVITE" },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              createdAt: true,
              expiresAt: true,
              usedAt: true,
            },
          },
        },
      },
      jobs: {
        orderBy: { scheduledDate: "desc" },
        include: {
          customer: true,
          property: true,
          photos: { select: { id: true, url: true, takenAt: true } },
          serviceTier: true,
        },
      },
    },
  });

  if (!technician) {
    return (
      <AppShell
        title={t("admin.technicians.detail.notFoundTitle")}
        subtitle={t("admin.technicians.detail.notFoundMessage")}
        role="ADMIN"
      >
        <Link href="/admin/technicians" className="text-sm text-slate-600">
          {t("admin.technicians.detail.actions.back")}
        </Link>
      </AppShell>
    );
  }

  const now = new Date();
  const inviteTokens = technician.user.passwordResetTokens ?? [];
  const hasPendingInvite = inviteTokens.some(
    (token) => !token.usedAt && token.expiresAt > now
  );
  const hasCompletedInvite = inviteTokens.some((token) => Boolean(token.usedAt));
  const portalStatusLabel = hasPendingInvite
    ? t("admin.technicians.detail.credentials.labels.portalInvitePending")
    : hasCompletedInvite
      ? t("admin.technicians.detail.credentials.labels.portalActive")
      : inviteTokens.length > 0
        ? t("admin.technicians.detail.credentials.labels.portalLinked")
        : t("admin.technicians.detail.credentials.labels.portalNotInvited");
  const portalStatusClass = hasPendingInvite
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : hasCompletedInvite
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : inviteTokens.length > 0
        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
        : "border-slate-200 bg-slate-100 text-slate-700";
  const latestInvite = inviteTokens[0]?.createdAt ?? null;
  const latestInviteLabel = latestInvite
    ? formatInBusinessTimeZone(latestInvite, locale, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const startOfDay = startOfBusinessDay(now) ?? new Date(now);
  const endOfDay = endOfBusinessDay(now) ?? new Date(now);
  const upcoming = technician.jobs.filter(
    (job) => job.scheduledDate >= now && job.status !== "COMPLETED"
  );
  const completed = technician.jobs.filter((job) => job.status === "COMPLETED");
  const pending = technician.jobs.filter((job) =>
    ["PENDING", "ON_THE_WAY", "IN_PROGRESS"].includes(job.status)
  );
  const todayJobs = technician.jobs.filter(
    (job) =>
      job.scheduledDate >= startOfDay && job.scheduledDate <= endOfDay
  );
  const totalJobs = technician.jobs.length;
  const lastActivity = technician.jobs.reduce<Date | null>((latest, job) => {
    const updated = job.updatedAt ?? job.scheduledDate;
    if (!latest || updated > latest) {
      return updated;
    }
    return latest;
  }, null);
  const lastActivityLabel = lastActivity
    ? formatInBusinessTimeZone(lastActivity, locale, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : t("admin.technicians.detail.activity.none");
  const initials = technician.user.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join("")
    .toUpperCase();
  const upcomingRows = upcoming.map((job) => ({
    id: job.id,
    scheduledDate: job.scheduledDate.toISOString(),
    customerName: formatCustomerName(job.customer),
    propertyName: job.property.name ?? "",
    address: job.property.address,
    status: job.status,
    priority: job.priority,
    serviceType: job.serviceType,
    serviceTierName: job.serviceTier?.name ?? null,
    type: job.type,
    photosCount: job.photos?.length ?? 0,
  }));
  const completedRows = completed.map((job) => ({
    id: job.id,
    scheduledDate: job.scheduledDate.toISOString(),
    customerName: formatCustomerName(job.customer),
    propertyName: job.property.name ?? "",
    address: job.property.address,
    status: job.status,
    priority: job.priority,
    serviceType: job.serviceType,
    serviceTierName: job.serviceTier?.name ?? null,
    type: job.type,
    photosCount: job.photos?.length ?? 0,
  }));

  return (
    <AppShell
      title={t("admin.technicians.detail.title", {
        name: technician.user.fullName,
      })}
      subtitle={t("admin.technicians.detail.subtitle")}
      role="ADMIN"
      wide
    >
      <section className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.25),_transparent_45%)]" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/30 text-lg font-semibold text-white"
                  style={{ backgroundColor: technician.colorHex || "#0ea5e9" }}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-100/70">
                    {t("admin.technicians.detail.roleLabel")}
                  </p>
                  <h2 className="text-2xl font-semibold">
                    {technician.user.fullName}
                  </h2>
                  <p className="text-sm text-sky-100/80">
                    {technician.user.email}
                  </p>
                  <p className="text-xs text-sky-100/60">
                    {formatUsPhone(technician.phone) ||
                      t("admin.technicians.detail.noPhone")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    technician.user.isActive
                      ? "border-teal-300 bg-teal-500 text-white"
                      : "border-slate-200 bg-white/10 text-white"
                  }`}
                >
                  {technician.user.isActive
                    ? t("common.status.active")
                    : t("admin.technicians.detail.status.inactive")}
                </span>
                <Link
                  href={`/admin/routes?tech=${technician.id}`}
                  className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
                >
                  {t("admin.technicians.detail.actions.viewRoute")}
                </Link>
                <Link
                  href="/admin/routes"
                  className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
                >
                  {t("admin.technicians.detail.actions.assignJob")}
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {t("admin.technicians.detail.stats.today")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {todayJobs.length}
              </p>
              <p className="text-xs text-slate-500">
                {t("admin.technicians.detail.stats.todayHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-700">
                {t("admin.technicians.detail.stats.pending")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-indigo-900">
                {pending.length}
              </p>
              <p className="text-xs text-indigo-700">
                {t("admin.technicians.detail.stats.pendingHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-700">
                {t("admin.technicians.detail.stats.completed")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-sky-900">
                {completed.length}
              </p>
              <p className="text-xs text-sky-700">
                {t("admin.technicians.detail.stats.completedHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {t("admin.technicians.detail.stats.lastActivity")}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {lastActivityLabel}
              </p>
              <p className="text-xs text-slate-500">
                {t("admin.technicians.detail.stats.lastActivityHint")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {t("admin.technicians.detail.profile.title")}
                </h2>
                <p className="text-xs text-slate-500">
                  {t("admin.technicians.detail.profile.subtitle")}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                {t("admin.technicians.detail.profile.total", {
                  count: totalJobs,
                })}
              </span>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t("admin.technicians.detail.credentials.title")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("admin.technicians.detail.credentials.subtitle")}
                  </p>
                  <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${portalStatusClass}`}>
                    {portalStatusLabel}
                  </span>
                  {latestInviteLabel ? (
                    <p className="mt-2 text-[11px] text-slate-500">
                      {t("admin.technicians.detail.credentials.lastInvite", {
                        date: latestInviteLabel,
                      })}
                    </p>
                  ) : null}
                </div>
                <form action={inviteTechnician}>
                  <input type="hidden" name="technicianId" value={technician.id} />
                  <button className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900">
                    {t("admin.technicians.detail.credentials.sendInvite")}
                  </button>
                </form>
              </div>
            </div>
            <form
              action={updateTechnician}
              className="mt-4 grid gap-3 lg:grid-cols-[2.2fr_1fr_1fr_2.4fr_auto] lg:items-end"
            >
              <input type="hidden" name="technicianId" value={technician.id} />
              <input type="hidden" name="userId" value={technician.user.id} />
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t("admin.technicians.detail.profile.fields.phone")}
                </label>
                <input
                  name="phone"
                  defaultValue={formatUsPhone(technician.phone) ?? ""}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t("admin.technicians.detail.profile.fields.status")}
                </label>
                <select
                  name="isActive"
                  defaultValue={technician.user.isActive ? "true" : "false"}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="true">{t("common.status.active")}</option>
                  <option value="false">
                    {t("admin.technicians.detail.status.inactive")}
                  </option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t("admin.technicians.detail.profile.fields.color")}
                </label>
                <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
                  <input
                    name="colorHex"
                    type="color"
                    defaultValue={technician.colorHex ?? "#38bdf8"}
                    className="h-7 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white"
                  />
                  <span className="text-xs text-slate-500">
                    {t("admin.technicians.detail.profile.fields.calendar")}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t("admin.technicians.detail.profile.fields.notes")}
                </label>
                <textarea
                  name="notes"
                  defaultValue={technician.notes ?? ""}
                  rows={1}
                  className="h-11 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <button className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm">
                {t("admin.technicians.detail.profile.actions.save")}
              </button>
            </form>
          </div>

          <TechnicianJobsTables
            upcoming={upcomingRows}
            completed={completedRows}
          />
        </div>
      </section>
    </AppShell>
  );
}
