import Link from "next/link";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import AddressAutocompleteSingle from "@/components/ui/AddressAutocompleteSingle";
import CustomerJobsTable from "@/components/customers/CustomerJobsTable";
import CustomerPlansTable from "@/components/customers/CustomerPlansTable";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { resolveParams } from "@/lib/utils/params";
import { addPlanFrequency, combineDateAndTime } from "@/lib/jobs/scheduling";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import {
  getDefaultServiceTierId,
  getServiceTierChecklist,
  getServiceTiers,
} from "@/lib/service-tiers";
import { getJobStatusLabel } from "@/lib/constants";
import { getRouteDayRange, queueTechDigestItem } from "@/lib/notifications/techDigest";
import { formatCustomerName } from "@/lib/customers/format";
import { sendCustomerInvite } from "@/lib/customers/invite";
import { formatUsPhone, normalizeUsPhone } from "@/lib/phones";
import { getAssetUrl } from "@/lib/assets";
import { getRequestLocale, getTranslations } from "@/i18n/server";

async function createProperty(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const poolType = String(formData.get("poolType") ?? "").trim();
  const waterType = String(formData.get("waterType") ?? "").trim();
  const volume = String(formData.get("poolVolumeGallons") ?? "").trim();
  const hasSpa = String(formData.get("hasSpa") ?? "no") === "yes";
  const sanitizerType = String(formData.get("sanitizerType") ?? "").trim();
  const filterType = String(formData.get("filterType") ?? "").trim();
  const accessInfo = String(formData.get("accessInfo") ?? "").trim();
  const locationNotes = String(formData.get("locationNotes") ?? "").trim();

  if (!customerId || !address || !poolType || !sanitizerType || !filterType || !volume || !accessInfo) {
    return;
  }

  await prisma.property.create({
    data: {
      customerId,
      name: name || null,
      address,
      poolType: poolType || null,
      waterType: waterType || null,
      sanitizerType: sanitizerType || null,
      filterType: filterType || null,
      poolVolumeGallons: volume ? Number(volume) : null,
      hasSpa,
      accessInfo: accessInfo || null,
      locationNotes: locationNotes || null,
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

async function updateCustomer(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellidos = String(formData.get("apellidos") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const telefonoRaw = String(formData.get("telefono") ?? "").trim();
  const telefonoSecundarioRaw = String(
    formData.get("telefonoSecundario") ?? ""
  ).trim();
  const estadoCuenta = String(formData.get("estadoCuenta") ?? "ACTIVE");
  const idiomaPreferencia = String(formData.get("idiomaPreferencia") ?? "EN");
  const tipoCliente = String(formData.get("tipoCliente") ?? "RESIDENTIAL");
  const direccionLinea1 = String(
    formData.get("direccionLinea1") ?? ""
  ).trim();
  const direccionLinea2 = String(
    formData.get("direccionLinea2") ?? ""
  ).trim();
  const ciudad = String(formData.get("ciudad") ?? "").trim();
  const estadoProvincia = String(
    formData.get("estadoProvincia") ?? ""
  ).trim();
  const codigoPostal = String(formData.get("codigoPostal") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();

  const telefono = normalizeUsPhone(telefonoRaw);
  const telefonoSecundario = telefonoSecundarioRaw
    ? normalizeUsPhone(telefonoSecundarioRaw)
    : null;

  if (!customerId || !nombre || !apellidos || !email || !telefono) {
    return;
  }
  if (telefonoSecundarioRaw && !telefonoSecundario) {
    return;
  }

  const hasAddress =
    direccionLinea1 || ciudad || estadoProvincia || codigoPostal;
  if (hasAddress && (!direccionLinea1 || !ciudad || !estadoProvincia || !codigoPostal)) {
    return;
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      nombre,
      apellidos,
      email,
      telefono,
      telefonoSecundario,
      estadoCuenta: estadoCuenta === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      idiomaPreferencia: idiomaPreferencia === "EN" ? "EN" : "ES",
      tipoCliente: tipoCliente === "COMMERCIAL" ? "COMMERCIAL" : "RESIDENTIAL",
      direccionLinea1: direccionLinea1 || null,
      direccionLinea2: direccionLinea2 || null,
      ciudad: ciudad || null,
      estadoProvincia: estadoProvincia || null,
      codigoPostal: codigoPostal || null,
      notas: notas || null,
    },
  });

  if (customer.userId) {
    const fullName = formatCustomerName(customer);
    await prisma.user.update({
      where: { id: customer.userId },
      data: {
        fullName,
        locale: customer.idiomaPreferencia,
        isActive: customer.estadoCuenta === "ACTIVE",
      },
    });
  }

  revalidatePath(`/admin/customers/${customerId}`);
}

async function inviteCustomer(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  if (!customerId) {
    return;
  }

  try {
    const result = await sendCustomerInvite(customerId);
    if (!result.ok) {
      console.error("Invite failed:", result.error);
    }
  } catch (error) {
    console.error("Invite failed:", error);
  }

  revalidatePath(`/admin/customers/${customerId}`);
}

async function deleteProperty(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const propertyId = String(formData.get("propertyId"));
  const customerId = String(formData.get("customerId"));

  if (!propertyId || !customerId) {
    return;
  }

  const jobsCount = await prisma.job.count({
    where: { propertyId },
  });

  if (jobsCount > 0) {
    return;
  }

  await prisma.property.delete({
    where: { id: propertyId },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

async function updateProperty(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const propertyId = String(formData.get("propertyId"));
  const customerId = String(formData.get("customerId"));
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const poolType = String(formData.get("poolType") ?? "").trim();
  const waterType = String(formData.get("waterType") ?? "").trim();
  const volume = String(formData.get("poolVolumeGallons") ?? "").trim();
  const hasSpa = String(formData.get("hasSpa") ?? "no") === "yes";
  const sanitizerType = String(formData.get("sanitizerType") ?? "").trim();
  const filterType = String(formData.get("filterType") ?? "").trim();
  const accessInfo = String(formData.get("accessInfo") ?? "").trim();
  const locationNotes = String(formData.get("locationNotes") ?? "").trim();

  if (!propertyId || !customerId || !address) {
    return;
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      name: name || null,
      address,
      poolType: poolType || null,
      waterType: waterType || null,
      sanitizerType: sanitizerType || null,
      filterType: filterType || null,
      poolVolumeGallons: volume ? Number(volume) : null,
      hasSpa,
      accessInfo: accessInfo || null,
      locationNotes: locationNotes || null,
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

async function deleteJob(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const jobId = String(formData.get("jobId"));
  const customerId = String(formData.get("customerId"));

  if (!jobId || !customerId) {
    return;
  }

  await prisma.invoice.updateMany({
    where: { jobId },
    data: { jobId: null },
  });

  await prisma.jobPhoto.deleteMany({
    where: { jobId },
  });

  await prisma.job.delete({
    where: { id: jobId },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

async function createJob(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  const propertyId = String(formData.get("propertyId"));
  const technicianId = String(formData.get("technicianId") ?? "");
  const type = String(formData.get("type") ?? "ROUTINE");
  const priority = String(formData.get("priority") ?? "NORMAL");
  const serviceType = String(formData.get("serviceType") ?? "WEEKLY_CLEANING");
  const serviceTierId = String(formData.get("serviceTierId") ?? "").trim();
  const estimatedDurationRaw = String(
    formData.get("estimatedDuration") ?? ""
  );
  const notes = String(formData.get("notes") ?? "").trim();
  const scheduledDateRaw = String(formData.get("scheduledDate") ?? "");
  const scheduledTime = String(formData.get("scheduledTime") ?? "09:00");

  if (!customerId || !propertyId || !scheduledDateRaw) {
    return;
  }

  const scheduledDate = combineDateAndTime(
    scheduledDateRaw,
    scheduledTime || "09:00"
  );
  const sortOrder =
    scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const status = scheduledDate > endOfToday ? "SCHEDULED" : "PENDING";
  const estimatedDurationMinutes = estimatedDurationRaw
    ? Number(estimatedDurationRaw)
    : null;
  const resolvedServiceTierId =
    serviceTierId || (await getDefaultServiceTierId());
  const checklist = await getServiceTierChecklist(resolvedServiceTierId);

  const job = await prisma.job.create({
    data: {
      customerId,
      propertyId,
      technicianId: technicianId || null,
      scheduledDate,
      sortOrder,
      status,
      type: type === "ON_DEMAND" ? "ON_DEMAND" : "ROUTINE",
      priority: priority === "URGENT" ? "URGENT" : "NORMAL",
      serviceTierId: resolvedServiceTierId,
      serviceType:
        serviceType === "FILTER_CHECK" ||
        serviceType === "CHEM_BALANCE" ||
        serviceType === "EQUIPMENT_CHECK"
          ? serviceType
          : "WEEKLY_CLEANING",
      estimatedDurationMinutes,
      checklist,
      notes: notes || null,
    },
    include: { customer: true, property: true },
  });

  if (job.technicianId) {
    const { start, end } = getRouteDayRange(job.scheduledDate);
    const existingCount = await prisma.job.count({
      where: {
        technicianId: job.technicianId,
        scheduledDate: { gte: start, lte: end },
        NOT: { id: job.id },
      },
    });
    await queueTechDigestItem({
      technicianId: job.technicianId,
      jobId: job.id,
      routeDate: job.scheduledDate,
      changeType: existingCount === 0 ? "ROUTE_ASSIGNED" : "JOB_ASSIGNED",
      payload: {
        scheduledDate: job.scheduledDate.toISOString(),
        customerName: formatCustomerName(job.customer),
        address: job.property.address,
      },
    });
  }

  await prisma.notification.create({
    data: {
      customerId,
      channel: "EMAIL",
      eventType: "SERVICE_SCHEDULED",
      status: "QUEUED",
      payload: {
        jobId: job.id,
        technicianId: job.technicianId,
        scheduledDate: job.scheduledDate,
      },
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

async function createServicePlan(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  const propertyId = String(formData.get("propertyId"));
  const technicianId = String(formData.get("technicianId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const frequencyRaw = String(formData.get("frequency") ?? "WEEKLY");
  const serviceType = String(formData.get("serviceType") ?? "WEEKLY_CLEANING");
  const serviceTierId = String(formData.get("serviceTierId") ?? "").trim();
  const priority = String(formData.get("priority") ?? "NORMAL");
  const nextDateRaw = String(formData.get("nextDate") ?? "");
  const nextTime = String(formData.get("nextTime") ?? "09:00");
  const estimatedDurationRaw = String(
    formData.get("estimatedDuration") ?? ""
  );
  const notes = String(formData.get("notes") ?? "").trim();

  if (!customerId || !propertyId || !name || !nextDateRaw) {
    return;
  }

  const frequency =
    frequencyRaw === "BIWEEKLY"
      ? "BIWEEKLY"
      : frequencyRaw === "MONTHLY"
        ? "MONTHLY"
        : "WEEKLY";

  const nextRunAt = combineDateAndTime(nextDateRaw, nextTime || "09:00");
  const estimatedDurationMinutes = estimatedDurationRaw
    ? Number(estimatedDurationRaw)
    : null;

  const resolvedPlanTierId =
    serviceTierId || (await getDefaultServiceTierId());

  await prisma.servicePlan.create({
    data: {
      customerId,
      propertyId,
      technicianId: technicianId || null,
      name,
      frequency,
      serviceTierId: resolvedPlanTierId,
      serviceType:
        serviceType === "FILTER_CHECK" ||
        serviceType === "CHEM_BALANCE" ||
        serviceType === "EQUIPMENT_CHECK"
          ? serviceType
        : "WEEKLY_CLEANING",
      priority: priority === "URGENT" ? "URGENT" : "NORMAL",
      nextRunAt,
      preferredTime: nextTime || null,
      estimatedDurationMinutes,
      checklist: await getServiceTierChecklist(resolvedPlanTierId),
      notes: notes || null,
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

async function toggleServicePlan(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const planId = String(formData.get("planId"));
  const customerId = String(formData.get("customerId"));
  const isActive = String(formData.get("isActive") ?? "false") === "true";

  if (!planId || !customerId) {
    return;
  }

  await prisma.servicePlan.update({
    where: { id: planId },
    data: { isActive },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

async function createJobFromPlan(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const planId = String(formData.get("planId"));
  const scheduledDateRaw = String(formData.get("scheduledDate") ?? "");
  const scheduledTime = String(formData.get("scheduledTime") ?? "");

  if (!planId) {
    return;
  }

  const plan = await prisma.servicePlan.findUnique({
    where: { id: planId },
  });

  if (!plan || !plan.isActive) {
    return;
  }

  const scheduledDate = scheduledDateRaw
    ? combineDateAndTime(
        scheduledDateRaw,
        scheduledTime || plan.preferredTime || "09:00"
      )
    : plan.nextRunAt;
  const sortOrderPlan =
    scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const status = scheduledDate > endOfToday ? "SCHEDULED" : "PENDING";

  const planTierId =
    plan.serviceTierId || (await getDefaultServiceTierId());
  const planChecklist = await getServiceTierChecklist(planTierId);

  const job = await prisma.job.create({
    data: {
      customerId: plan.customerId,
      propertyId: plan.propertyId,
      technicianId: plan.technicianId,
      scheduledDate,
      sortOrder: sortOrderPlan,
      status,
      type: "ROUTINE",
      priority: plan.priority,
      serviceTierId: planTierId,
      serviceType: plan.serviceType,
      estimatedDurationMinutes: plan.estimatedDurationMinutes,
      checklist: planChecklist,
      planId: plan.id,
    },
    include: { customer: true, property: true },
  });

  if (job.technicianId) {
    const { start, end } = getRouteDayRange(job.scheduledDate);
    const existingCount = await prisma.job.count({
      where: {
        technicianId: job.technicianId,
        scheduledDate: { gte: start, lte: end },
        NOT: { id: job.id },
      },
    });
    await queueTechDigestItem({
      technicianId: job.technicianId,
      jobId: job.id,
      routeDate: job.scheduledDate,
      changeType: existingCount === 0 ? "ROUTE_ASSIGNED" : "JOB_ASSIGNED",
      payload: {
        scheduledDate: job.scheduledDate.toISOString(),
        customerName: formatCustomerName(job.customer),
        address: job.property.address,
      },
    });
  }

  await prisma.notification.create({
    data: {
      customerId: plan.customerId,
      channel: "EMAIL",
      eventType: "SERVICE_SCHEDULED",
      status: "QUEUED",
      payload: {
        jobId: job.id,
        technicianId: job.technicianId,
        scheduledDate: job.scheduledDate,
      },
    },
  });

  await prisma.servicePlan.update({
    where: { id: plan.id },
    data: { nextRunAt: addPlanFrequency(scheduledDate, plan.frequency) },
  });

  revalidatePath(`/admin/customers/${plan.customerId}`);
  revalidatePath("/admin/routes");
}

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const resolvedParams = await resolveParams(params);
  const customerId = resolvedParams?.id;
  if (!customerId) {
    return (
      <AppShell
        title={t("admin.customers.detail.notFoundTitle")}
        subtitle={t("admin.customers.detail.notFoundSubtitle")}
        role="ADMIN"
      >
        <Link href="/admin/customers" className="text-sm text-slate-600">
          {t("admin.customers.detail.actions.back")}
        </Link>
      </AppShell>
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      properties: true,
      jobs: {
        orderBy: { scheduledDate: "desc" },
        include: {
          property: true,
          technician: { include: { user: true } },
          photos: true,
        },
      },
      servicePlans: {
        orderBy: { nextRunAt: "asc" },
        include: {
          property: true,
          technician: { include: { user: true } },
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: {
          job: {
            include: {
              technician: { include: { user: true } },
            },
          },
        },
      },
    },
  });

  if (!customer) {
    return (
      <AppShell
        title={t("admin.customers.detail.notFoundTitle")}
        subtitle={t("admin.customers.detail.notFoundMessage")}
        role="ADMIN"
      >
        <Link href="/admin/customers" className="text-sm text-slate-600">
          {t("admin.customers.detail.actions.back")}
        </Link>
      </AppShell>
    );
  }

  const customerName = formatCustomerName(customer);
  const technicians = await prisma.technician.findMany({
    include: { user: true },
    orderBy: { user: { fullName: "asc" } },
  });
  const serviceTiers = await getServiceTiers();
  const activeServiceTiers = serviceTiers.filter((tier) => tier.isActive);
  const tierOptions =
    activeServiceTiers.length > 0 ? activeServiceTiers : serviceTiers;
  const serviceTierMap = new Map(
    serviceTiers.map((tier) => [tier.id, tier.name])
  );

  const formatDateInput = (value: Date) =>
    value.toLocaleDateString("en-CA");
  const formatTimeInput = (value: Date) => value.toTimeString().slice(0, 5);
  const jobsRows = customer.jobs.map((job) => ({
    id: job.id,
    scheduledDate: job.scheduledDate.toISOString(),
    status: job.status,
    priority: job.priority,
    serviceType: job.serviceType,
    serviceTierName: job.serviceTierId
      ? serviceTierMap.get(job.serviceTierId) ?? null
      : null,
    type: job.type,
    propertyName: job.property.name ?? "",
    address: job.property.address,
    technicianName: job.technician?.user.fullName ?? "",
    photosCount: job.photos.length,
  }));
  const plansRows = customer.servicePlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    propertyAddress: plan.property.address,
    frequency: plan.frequency,
    serviceType: plan.serviceType,
    serviceTierName: plan.serviceTierId
      ? serviceTierMap.get(plan.serviceTierId) ?? null
      : null,
    priority: plan.priority,
    nextRunAt: plan.nextRunAt.toISOString(),
    preferredTime: plan.preferredTime,
    technicianName: plan.technician?.user.fullName ?? "",
    isActive: plan.isActive,
    notes: plan.notes,
    customerId: customer.id,
  }));

  return (
    <AppShell
      title={t("admin.customers.detail.title", { name: customerName })}
      subtitle={t("admin.customers.detail.subtitle")}
      role="ADMIN"
      wide
    >
      <input id="new-plan" type="checkbox" className="peer/plan hidden" />
      <input id="new-property" type="checkbox" className="peer/property hidden" />
      <input id="new-job" type="checkbox" className="peer/job hidden" />
      <section className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.25),_transparent_45%)]" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sky-100/70">
                  {t("admin.customers.detail.kicker")}
                </p>
                <h2 className="text-2xl font-semibold">{customerName}</h2>
                <p className="text-sm text-sky-100/80">{customer.email}</p>
                <p className="text-xs text-sky-100/60">
                  {formatUsPhone(customer.telefono) ||
                    t("admin.routes.labels.noPhone")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    customer.estadoCuenta === "ACTIVE"
                      ? "border-teal-300 bg-teal-500 text-white"
                      : "border-white/30 bg-white/10 text-white"
                  }`}
                >
                  {customer.estadoCuenta === "ACTIVE"
                    ? t("common.status.active")
                    : t("common.status.inactive")}
                </span>
                <label
                  htmlFor="new-property"
                  className="cursor-pointer rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
                >
                  {t("admin.customers.detail.actions.addProperty")}
                </label>
                <label
                  htmlFor="new-job"
                  className="cursor-pointer rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
                >
                  {t("admin.customers.detail.actions.scheduleJob")}
                </label>
                <label
                  htmlFor="new-plan"
                  className="cursor-pointer rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
                >
                  {t("admin.customers.detail.actions.newPlan")}
                </label>
              </div>
            </div>
          </div>
          <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {t("admin.customers.detail.cards.properties")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {customer.properties.length}
              </p>
              <p className="text-xs text-slate-500">
                {t("admin.customers.detail.cards.propertiesHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-700">
                {t("admin.customers.detail.cards.jobs")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-sky-900">
                {customer.jobs.length}
              </p>
              <p className="text-xs text-sky-700">
                {t("admin.customers.detail.cards.jobsHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-700">
                {t("admin.customers.detail.cards.plans")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-indigo-900">
                {customer.servicePlans.length}
              </p>
              <p className="text-xs text-indigo-700">
                {t("admin.customers.detail.cards.plansHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {t("admin.customers.detail.cards.invoices")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {customer.invoices.length}
              </p>
              <p className="text-xs text-slate-500">
                {t("admin.customers.detail.cards.invoicesHint")}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t("admin.customers.detail.sections.profileTitle")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {t("admin.customers.detail.sections.profileSubtitle")}
                  </p>
                </div>
                <form action={inviteCustomer}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300">
                    {t("admin.customers.detail.actions.sendInvite")}
                  </button>
                </form>
              </div>

              <form action={updateCustomer} className="mt-5 space-y-5">
                <input type="hidden" name="customerId" value={customer.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.firstName")}
                    </label>
                    <input
                      name="nombre"
                      defaultValue={customer.nombre}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.lastName")}
                    </label>
                    <input
                      name="apellidos"
                      defaultValue={customer.apellidos ?? ""}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.email")}
                    </label>
                    <input
                      name="email"
                      type="email"
                      defaultValue={customer.email}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.language")}
                    </label>
                    <select
                      name="idiomaPreferencia"
                      defaultValue={customer.idiomaPreferencia}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <option value="ES">{t("common.language.es")}</option>
                      <option value="EN">{t("common.language.en")}</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.phone")}
                    </label>
                    <input
                      name="telefono"
                      defaultValue={formatUsPhone(customer.telefono) ?? ""}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("common.labels.phoneSecondary")}
                    </label>
                    <input
                      name="telefonoSecundario"
                      defaultValue={formatUsPhone(customer.telefonoSecundario) ?? ""}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.customers.new.fields.status")}
                    </label>
                    <select
                      name="estadoCuenta"
                      defaultValue={customer.estadoCuenta}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <option value="ACTIVE">
                        {t("common.status.active")}
                      </option>
                      <option value="INACTIVE">
                        {t("common.status.inactive")}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {t("admin.customers.new.fields.type")}
                    </label>
                    <select
                      name="tipoCliente"
                      defaultValue={customer.tipoCliente}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <option value="RESIDENTIAL">
                        {t("admin.customers.types.residential")}
                      </option>
                      <option value="COMMERCIAL">
                        {t("admin.customers.types.commercial")}
                      </option>
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {t("address.sectionTitle")}
                  </h3>
                  <div className="mt-4">
                    <AddressAutocomplete
                      defaultValue={{
                        line1: customer.direccionLinea1,
                        line2: customer.direccionLinea2,
                        city: customer.ciudad,
                        state: customer.estadoProvincia,
                        postalCode: customer.codigoPostal,
                      }}
                    />
                  </div>
                </div>

                <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.notes")}
                  </label>
                  <textarea
                    name="notas"
                    defaultValue={customer.notas ?? ""}
                    className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>

                <div className="flex justify-end">
                  <FormSubmitButton
                    idleLabel={t("admin.customers.detail.actions.saveChanges")}
                    pendingLabel={t("admin.customers.detail.actions.saving")}
                  />
                </div>
              </form>
            </div>
          </div>
          <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.sections.propertiesTitle")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.sections.propertiesSubtitle")}
                </p>
              </div>
              <label
                htmlFor="new-property"
                className="cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              >
                {t("admin.customers.detail.actions.addProperty")}
              </label>
            </div>
            <div className="mt-4 space-y-3">
              {customer.properties.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.properties.empty")}
                </p>
              ) : (
                customer.properties.map((property) => (
                  <div
                    key={property.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {property.name || t("admin.customers.detail.properties.nameFallback")}
                      </p>
                      <p className="text-xs text-slate-500">
                        {property.address}
                      </p>
                      <p className="text-xs text-slate-400">
                        {property.poolType ||
                          t("admin.customers.detail.properties.poolFallback")}
                        {" · "}
                        {property.sanitizerType ||
                          t("admin.customers.detail.properties.systemFallback")}
                        {" · "}
                        {property.poolVolumeGallons
                          ? `${property.poolVolumeGallons} gal`
                          : t(
                              "admin.customers.detail.properties.volumeFallback"
                            )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <details className="text-xs text-slate-500">
                        <summary className="cursor-pointer rounded-full border border-slate-200 px-3 py-1">
                          {t("common.actions.edit")}
                        </summary>
                        <form
                          action={updateProperty}
                          className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <input
                            type="hidden"
                            name="propertyId"
                            value={property.id}
                          />
                          <input
                            type="hidden"
                            name="customerId"
                            value={customer.id}
                          />
                          <input
                            name="name"
                            defaultValue={property.name ?? ""}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                            placeholder={t(
                              "admin.customers.detail.properties.placeholders.name"
                            )}
                          />
                          <AddressAutocompleteSingle
                            name="address"
                            defaultValue={property.address}
                            placeholder={t("admin.routes.labels.address")}
                            required
                            size="compact"
                            showHelper={false}
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              name="poolType"
                              defaultValue={property.poolType ?? ""}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                              placeholder={t(
                                "admin.customers.detail.properties.placeholders.poolType"
                              )}
                            />
                            <input
                              name="waterType"
                              defaultValue={property.waterType ?? ""}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                              placeholder={t(
                                "admin.customers.detail.properties.placeholders.waterType"
                              )}
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              name="poolVolumeGallons"
                              type="number"
                              defaultValue={property.poolVolumeGallons ?? ""}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                              placeholder={t(
                                "admin.customers.detail.properties.placeholders.volume"
                              )}
                            />
                            <input
                              name="filterType"
                              defaultValue={property.filterType ?? ""}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                              placeholder={t(
                                "admin.customers.detail.properties.placeholders.filterType"
                              )}
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              name="sanitizerType"
                              defaultValue={property.sanitizerType ?? ""}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                              placeholder={t(
                                "admin.customers.detail.properties.placeholders.sanitizerType"
                              )}
                            />
                            <select
                              name="hasSpa"
                              defaultValue={property.hasSpa ? "yes" : "no"}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                            >
                              <option value="no">
                                {t("admin.customers.detail.properties.spaNo")}
                              </option>
                              <option value="yes">
                                {t("admin.customers.detail.properties.spaYes")}
                              </option>
                            </select>
                          </div>
                          <textarea
                            name="accessInfo"
                            defaultValue={property.accessInfo ?? ""}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                            placeholder={t(
                              "admin.customers.detail.properties.placeholders.accessInfo"
                            )}
                          />
                          <textarea
                            name="locationNotes"
                            defaultValue={property.locationNotes ?? ""}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                            placeholder={t(
                              "admin.customers.detail.properties.placeholders.locationNotes"
                            )}
                          />
                          <FormSubmitButton
                            idleLabel={t("admin.customers.detail.actions.saveChanges")}
                            pendingLabel={t("admin.customers.detail.actions.saving")}
                            className="w-full px-4 py-2 text-xs sm:col-span-2"
                          />
                        </form>
                      </details>
                      <form action={deleteProperty}>
                        <input
                          type="hidden"
                          name="propertyId"
                          value={property.id}
                        />
                        <input
                          type="hidden"
                          name="customerId"
                          value={customer.id}
                        />
                        <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                          {t("common.actions.delete")}
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.sections.plansTitle")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.sections.plansSubtitle")}
                </p>
              </div>
              <label
                htmlFor="new-plan"
                className="cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              >
                {t("admin.customers.detail.actions.newPlan")}
              </label>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {customer.servicePlans.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.plans.empty")}
                </p>
              ) : (
                customer.servicePlans.map((plan) => {
                  const serviceOption = serviceTypeOptions.find(
                    (option) => option.value === plan.serviceType
                  );
                  const serviceLabel =
                    serviceOption?.labelKey
                      ? t(serviceOption.labelKey)
                      : serviceOption?.label ?? plan.serviceType;
                  const nextDate = formatDateInput(plan.nextRunAt);
                  const nextTime = plan.preferredTime || formatTimeInput(plan.nextRunAt);
                  return (
                    <div
                      key={plan.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {plan.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {plan.property.address}{" · "}{serviceLabel}
                          </p>
                          <p className="text-xs text-slate-500">
                            {t("admin.customers.detail.plans.nextRun")} {" "}
                            {plan.nextRunAt.toLocaleDateString(locale)} {" · "}
                            {nextTime}
                          </p>
                        </div>
                        <Badge
                          label={plan.isActive ? t("common.status.active") : t("admin.customers.detail.plans.paused")}
                          tone={plan.isActive ? "success" : "warning"}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge
                          label={
                            plan.frequency === "BIWEEKLY"
                              ? t("plans.frequency.biweekly")
                              : plan.frequency === "MONTHLY"
                                ? t("plans.frequency.monthly")
                                : t("plans.frequency.weekly")
                          }
                          tone="info"
                        />
                        <Badge
                          label={plan.priority === "URGENT" ? t("jobs.priority.urgent") : t("jobs.priority.normal")}
                          tone={plan.priority === "URGENT" ? "warning" : "neutral"}
                        />
                        <Badge
                          label={
                            plan.technician?.user.fullName ?? t("jobs.detail.noTech")
                          }
                          tone="neutral"
                        />
                      </div>
                      {plan.notes ? (
                        <p className="mt-3 text-xs text-slate-500">
                          {plan.notes}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <form action={createJobFromPlan} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="planId" value={plan.id} />
                          <input
                            name="scheduledDate"
                            type="date"
                            defaultValue={nextDate}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                          />
                          <input
                            name="scheduledTime"
                            type="time"
                            defaultValue={nextTime}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                          />
                          <button className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                            {t("admin.customers.detail.actions.createJob")}
                          </button>
                        </form>
                        <form action={toggleServicePlan}>
                          <input type="hidden" name="planId" value={plan.id} />
                          <input type="hidden" name="customerId" value={customer.id} />
                          <input
                            type="hidden"
                            name="isActive"
                            value={plan.isActive ? "false" : "true"}
                          />
                          <button className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600">
                            {plan.isActive ? t("admin.customers.detail.actions.pause") : t("admin.customers.detail.actions.activate")}
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("admin.customers.detail.sections.jobsTitle")}
              </h2>
              <span className="text-xs text-slate-400">
                {t("admin.customers.detail.labels.total", {
                  count: customer.jobs.length,
                })}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {customer.jobs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.jobs.empty")}
                </p>
              ) : (
                customer.jobs.map((job) => {
                  const jobServiceOption = serviceTypeOptions.find(
                    (option) => option.value === job.serviceType
                  );
                  const jobServiceLabel = jobServiceOption?.labelKey
                    ? t(jobServiceOption.labelKey)
                    : jobServiceOption?.label ?? job.serviceType;
                  return (
                    <div
                      key={job.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <Link href={`/admin/routes/${job.id}`}>
                        <div>
                          <p className="font-medium text-slate-900">
                            {job.property.address}
                          </p>
                          <p className="text-xs text-slate-500">
                            {job.scheduledDate.toLocaleDateString(locale)} |{" "}
                            {getJobStatusLabel(job.status, t)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {jobServiceLabel} |{" "}
                            {job.estimatedDurationMinutes
                              ? `${job.estimatedDurationMinutes} min`
                              : t("jobs.detail.durationEmpty")}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-3">
                        <Badge
                          label={
                            job.priority === "URGENT"
                              ? t("jobs.priority.urgent")
                              : t("jobs.priority.normal")
                          }
                          tone={
                            job.priority === "URGENT" ? "warning" : "neutral"
                          }
                        />
                        <span className="text-xs text-slate-400">
                          {job.technician?.user.fullName ??
                            t("jobs.detail.noTech")}
                        </span>
                        <form action={deleteJob}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <input
                            type="hidden"
                            name="customerId"
                            value={customer.id}
                          />
                          <button className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                            {t("common.actions.delete")}
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("admin.invoices.title")}
              </h2>
              <span className="text-xs text-slate-400">
                {t("admin.invoices.list.total", {
                  count: customer.invoices.length,
                })}
              </span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {customer.invoices.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t("admin.invoices.list.empty")}
                </p>
              ) : (
                customer.invoices.map((invoice) => {
                  const themeLabel =
                    invoice.theme === "SPECIAL"
                      ? t("admin.invoices.theme.special")
                      : invoice.theme === "ESTIMATE"
                        ? t("admin.invoices.theme.estimate")
                        : t("admin.invoices.theme.standard");
                  const statusLabel = t(
                    `admin.invoices.status.${invoice.status.toLowerCase()}`
                  );
                  return (
                    <div
                      key={invoice.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {invoice.number}
                        </p>
                        <p className="text-xs text-slate-500">
                          {invoice.createdAt.toLocaleDateString(locale)} -{" "}
                          {statusLabel}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge
                            label={`${t("admin.invoices.list.theme")}: ${themeLabel}`}
                            tone="info"
                          />
                        </div>
                        {invoice.job ? (
                          <p className="text-xs text-slate-500">
                            {t("admin.invoices.list.job")}:{" "}
                            {invoice.job.scheduledDate.toLocaleDateString(locale)} -{" "}
                            {invoice.job.technician?.user.fullName ??
                              t("admin.invoices.list.noTech")}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400">
                            {t("admin.invoices.list.noJob")}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          ${invoice.total.toFixed(2)}
                        </p>
                        {invoice.pdfUrl ? (
                          <a
                            href={getAssetUrl(invoice.pdfUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-slate-600 underline"
                          >
                            {t("admin.invoices.list.viewPdf")}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          </div>
        </div>

        
      </section>

      <CustomerJobsTable
        rows={jobsRows}
        actionTargetId="new-job"
        onDeleteJob={deleteJob}
        customerId={customer.id}
      />

      <CustomerPlansTable
        rows={plansRows}
        onToggle={toggleServicePlan}
        onCreateJob={createJobFromPlan}
        actionTargetId="new-plan"
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("admin.invoices.title")}
          </h2>
          <span className="text-xs text-slate-400">
            {t("admin.invoices.list.total", {
              count: customer.invoices.length,
            })}
          </span>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          {customer.invoices.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("admin.invoices.list.empty")}
            </p>
          ) : (
            customer.invoices.map((invoice) => {
              const themeLabel =
                invoice.theme === "SPECIAL"
                  ? t("admin.invoices.theme.special")
                  : invoice.theme === "ESTIMATE"
                    ? t("admin.invoices.theme.estimate")
                    : t("admin.invoices.theme.standard");
              const statusLabel = t(
                `admin.invoices.status.${invoice.status.toLowerCase()}`
              );
              return (
                <div
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">{invoice.code}</p>
                    <p className="text-xs text-slate-500">
                      {invoice.createdAt.toLocaleDateString(locale)} - {statusLabel}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge
                        label={`${t("admin.invoices.list.theme")}: ${themeLabel}`}
                        tone="info"
                      />
                    </div>
                    {invoice.job ? (
                      <p className="text-xs text-slate-500">
                        {t("admin.invoices.list.job")}:{" "}
                        {invoice.job.scheduledDate.toLocaleDateString(locale)}{" "}
                        -{" "}
                        {invoice.job.technician?.user.fullName ??
                          t("admin.invoices.list.noTech")}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        {t("admin.invoices.list.noJob")}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      ${invoice.total.toFixed(2)}
                    </p>
                    {invoice.pdfUrl ? (
                      <a
                        href={getAssetUrl(invoice.pdfUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-600 underline"
                      >
                        {t("admin.invoices.list.viewPdf")}
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="fixed inset-0 z-[90] hidden items-center justify-center p-4 sm:p-6 peer-checked/property:flex">
        <label
          htmlFor="new-property"
          className="absolute inset-0 bg-slate-900/60"
        />
        <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.customers.detail.properties.modalKicker")}
                </p>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.properties.modalTitle")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.properties.modalSubtitle")}
                </p>
              </div>
              <label
                htmlFor="new-property"
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
            <form action={createProperty} className="mt-5 space-y-4">
            <input type="hidden" name="customerId" value={customer.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.properties.fields.name")}
                </label>
                <input
                  name="name"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder={t(
                    "admin.customers.detail.properties.placeholders.nameExample"
                  )}
                />
              </div>
              <AddressAutocompleteSingle
                name="address"
                label={t("admin.routes.labels.address")}
                placeholder={t(
                  "admin.customers.detail.properties.placeholders.address"
                )}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.poolType")}
                </label>
                <select
                  name="poolType"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  required
                >
                  <option value="">
                    {t("admin.customers.detail.properties.options.select")}
                  </option>
                  <option value="Concreto">
                    {t("admin.customers.detail.properties.options.concrete")}
                  </option>
                  <option value="Fibra">
                    {t("admin.customers.detail.properties.options.fiberglass")}
                  </option>
                  <option value="Vinilo">
                    {t("admin.customers.detail.properties.options.vinyl")}
                  </option>
                  <option value="Material alternativo">
                    {t("admin.customers.detail.properties.options.altMaterial")}
                  </option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.properties.fields.sanitizerType")}
                </label>
                <select
                  name="sanitizerType"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  required
                >
                  <option value="">
                    {t("admin.customers.detail.properties.options.select")}
                  </option>
                  <option value="Sal">
                    {t("admin.customers.detail.properties.options.salt")}
                  </option>
                  <option value="Cloro">
                    {t("admin.customers.detail.properties.options.chlorine")}
                  </option>
                  <option value="Otro">
                    {t("admin.customers.detail.properties.options.other")}
                  </option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.waterType")}
                </label>
                <input
                  name="waterType"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder={t(
                    "admin.customers.detail.properties.placeholders.waterType"
                  )}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.filterType")}
                </label>
                <input
                  name="filterType"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.poolVolume")}
                </label>
                <input
                  name="poolVolumeGallons"
                  type="number"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.properties.fields.spa")}
                </label>
                <select
                  name="hasSpa"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="no">{t("common.labels.no")}</option>
                  <option value="yes">{t("common.labels.yes")}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.customers.detail.properties.fields.accessInfo")}
              </label>
              <textarea
                name="accessInfo"
                className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.customers.detail.properties.fields.locationNotes")}
              </label>
              <textarea
                name="locationNotes"
                className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
            <FormSubmitButton
              idleLabel={t("admin.customers.detail.actions.saveProperty")}
              pendingLabel={t("admin.customers.detail.actions.saving")}
              className="w-full"
            />
            </form>
          </div>
        </div>
      </div>

      <div className="fixed inset-0 z-[90] hidden items-center justify-center p-4 sm:p-6 peer-checked/job:flex">
        <label
          htmlFor="new-job"
          className="absolute inset-0 bg-slate-900/60"
        />
        <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.customers.detail.jobs.modalKicker")}
                </p>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.jobs.modalTitle")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.jobs.modalSubtitle")}
                </p>
              </div>
              <label
                htmlFor="new-job"
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
            <form action={createJob} className="mt-5 space-y-4">
            <input type="hidden" name="customerId" value={customer.id} />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.routes.labels.property")}
              </label>
              <select
                name="propertyId"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                required
              >
                {customer.properties.length === 0 ? (
                  <option value="">{t("admin.routes.labels.noProperties")}</option>
                ) : (
                  customer.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name
                        ? `${property.name} · ${property.address}`
                        : property.address}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.date")}
                </label>
                <input
                  name="scheduledDate"
                  type="date"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.time")}
                </label>
                <input
                  name="scheduledTime"
                  type="time"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.serviceTier")}
                </label>
                <select
                  name="serviceTierId"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  {tierOptions.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.serviceType")}
                </label>
                <select
                  name="serviceType"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  {serviceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.labelKey ? t(option.labelKey) : option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.priority")}
                </label>
                <select
                  name="priority"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="NORMAL">{t("jobs.priority.normal")}</option>
                  <option value="URGENT">{t("jobs.priority.urgent")}</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.durationMinutes")}
                </label>
                <input
                  name="estimatedDuration"
                  type="number"
                  min="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder="60"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.tech")}
                </label>
                <select
                  name="technicianId"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="">{t("admin.routes.labels.unassigned")}</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.user.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("jobs.detail.fields.jobType")}
              </label>
              <select
                name="type"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <option value="ROUTINE">{t("jobs.type.routine")}</option>
                <option value="ON_DEMAND">{t("jobs.type.onDemand")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("common.labels.notes")}
              </label>
              <textarea
                name="notes"
                className="mt-2 min-h-[80px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
            <FormSubmitButton
              idleLabel={t("admin.customers.detail.actions.createJob")}
              pendingLabel={t("admin.customers.detail.actions.saving")}
              className="w-full"
            />
            </form>
          </div>
        </div>
      </div>

      <div className="fixed inset-0 z-[90] hidden items-center justify-center p-4 sm:p-6 peer-checked/plan:flex">
        <label
          htmlFor="new-plan"
          className="absolute inset-0 bg-slate-900/60"
        />
        <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.customers.detail.plans.modalKicker")}
                </p>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.plans.modalTitle")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.plans.modalSubtitle")}
                </p>
              </div>
              <label
                htmlFor="new-plan"
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
            <form action={createServicePlan} className="mt-5 space-y-4">
            <input type="hidden" name="customerId" value={customer.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.plans.fields.name")}
                </label>
                <input
                  name="name"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder={t("admin.customers.detail.plans.placeholders.name")}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.property")}
                </label>
                <select
                  name="propertyId"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  required
                >
                  {customer.properties.length === 0 ? (
                    <option value="">{t("admin.routes.labels.noProperties")}</option>
                  ) : (
                    customer.properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name
                          ? `${property.name} · ${property.address}`
                          : property.address}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.plans.fields.frequency")}
                </label>
                <select
                  name="frequency"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="WEEKLY">{t("plans.frequency.weekly")}</option>
                  <option value="BIWEEKLY">{t("plans.frequency.biweekly")}</option>
                  <option value="MONTHLY">{t("plans.frequency.monthly")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.serviceTier")}
                </label>
                <select
                  name="serviceTierId"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  {tierOptions.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.serviceType")}
                </label>
                <select
                  name="serviceType"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  {serviceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.labelKey ? t(option.labelKey) : option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.priority")}
                </label>
                <select
                  name="priority"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="NORMAL">{t("jobs.priority.normal")}</option>
                  <option value="URGENT">{t("jobs.priority.urgent")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.tech")}
                </label>
                <select
                  name="technicianId"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="">{t("admin.routes.labels.unassigned")}</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.user.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.plans.fields.nextDate")}
                </label>
                <input
                  name="nextDate"
                  type="date"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.time")}
                </label>
                <input
                  name="nextTime"
                  type="time"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.duration")}
                </label>
                <input
                  name="estimatedDuration"
                  type="number"
                  min="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder="60"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.customers.detail.plans.fields.notes")}
              </label>
              <textarea
                name="notes"
                className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
            <FormSubmitButton
              idleLabel={t("admin.customers.detail.actions.createPlan")}
              pendingLabel={t("admin.customers.detail.actions.saving")}
              className="w-full"
            />
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

