import AppShell from "@/components/layout/AppShell";
import RoutesCalendar from "@/components/routes/RoutesCalendar";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getTranslations } from "@/i18n/server";
import { getServiceTiers } from "@/lib/service-tiers";
import { addPlanFrequency } from "@/lib/jobs/scheduling";
import { CUSTOM_SERVICE_PLAN_NAME } from "@/lib/jobs/recurring-plan-templates";
import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

function toMonthKey(value: Date) {
  return DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE).toFormat("yyyy-MM");
}

function toBusinessDateKey(value: Date) {
  return DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE).toFormat("yyyy-MM-dd");
}

function resolveMonthStart(rawMonth?: string) {
  if (rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth)) {
    const parsed = DateTime.fromFormat(rawMonth, "yyyy-MM", {
      zone: BUSINESS_TIMEZONE,
    }).startOf("month");
    if (parsed.isValid) {
      return parsed.toUTC().toJSDate();
    }
  }
  return DateTime.now().setZone(BUSINESS_TIMEZONE).startOf("month").toUTC().toJSDate();
}

type RoutesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RoutesPage({ searchParams }: RoutesPageProps) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const monthRaw = resolvedSearchParams?.month;
  const monthParam = Array.isArray(monthRaw) ? monthRaw[0] : monthRaw;

  const monthStart = resolveMonthStart(monthParam);
  const monthStartEt = DateTime.fromJSDate(monthStart)
    .setZone(BUSINESS_TIMEZONE)
    .startOf("month");
  const monthEndEt = monthStartEt.endOf("month");
  const nextMonthStartEt = monthStartEt.plus({ months: 1 }).startOf("month");
  const nextMonthEndEt = nextMonthStartEt.endOf("month");
  const startOffset = monthStartEt.weekday % 7;
  const endOffset = 6 - (monthEndEt.weekday % 7);
  const calendarStart = monthStartEt
    .minus({ days: startOffset })
    .startOf("day")
    .toUTC()
    .toJSDate();
  const calendarEnd = monthEndEt
    .plus({ days: endOffset })
    .endOf("day")
    .toUTC()
    .toJSDate();
  const nextMonthStart = nextMonthStartEt.toUTC().toJSDate();
  const nextMonthEnd = nextMonthEndEt.toUTC().toJSDate();

  const [jobs, plans, technicians, customers, serviceTiers, nextMonthJobsCount] =
    await Promise.all([
    prisma.job.findMany({
      where: {
        scheduledDate: {
          gte: calendarStart,
          lte: calendarEnd,
        },
        // Customer requests aren't placed on the calendar until an admin
        // assigns them a real day and technician from /admin/requests - the
        // scheduledDate on an unassigned request is just an internal
        // placeholder, not a confirmed slot.
        NOT: { type: "ON_DEMAND", technicianId: null },
      },
      orderBy: [{ scheduledDate: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        type: true,
        priority: true,
        serviceTierId: true,
        serviceType: true,
        estimatedDurationMinutes: true,
        technicianId: true,
        sortOrder: true,
        planId: true,
        notes: true,
        customerNotes: true,
        checklist: true,
        photos: { select: { id: true, url: true, takenAt: true } },
        plan: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            email: true,
            telefono: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            poolType: true,
            sanitizerType: true,
            poolVolumeGallons: true,
            filterType: true,
            accessInfo: true,
            locationNotes: true,
            hasSpa: true,
          },
        },
        technician: { select: { id: true, user: { select: { fullName: true } } } },
      },
    }),
    prisma.servicePlan.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: calendarEnd,
        },
      },
      orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        customerId: true,
        propertyId: true,
        technicianId: true,
        serviceTierId: true,
        name: true,
        frequency: true,
        serviceType: true,
        priority: true,
        nextRunAt: true,
        preferredTime: true,
        estimatedDurationMinutes: true,
        notes: true,
        customer: {
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            email: true,
            telefono: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            poolType: true,
            sanitizerType: true,
            poolVolumeGallons: true,
            filterType: true,
            accessInfo: true,
            locationNotes: true,
            hasSpa: true,
          },
        },
        technician: { select: { id: true, user: { select: { fullName: true } } } },
      },
    }),
    prisma.technician.findMany({
      select: { id: true, colorHex: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.customer.findMany({
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        properties: { select: { id: true, address: true } },
      },
    }),
    getServiceTiers(),
    prisma.job.count({
      where: {
        scheduledDate: {
          gte: nextMonthStart,
          lte: nextMonthEnd,
        },
      },
    }),
  ]);

  const jobsData = jobs.map((job) => ({
    id: job.id,
    scheduledDate: job.scheduledDate.toISOString(),
    status: job.status,
    type: job.type,
    priority: job.priority,
    serviceTierId: job.serviceTierId,
    serviceType: job.serviceType,
    estimatedDurationMinutes: job.estimatedDurationMinutes,
    technicianId: job.technicianId,
    sortOrder: job.sortOrder,
    planId: job.planId,
    planName: job.plan?.name ?? null,
    entryKind: "job" as const,
    showScheduledTime: job.plan?.name === CUSTOM_SERVICE_PLAN_NAME,
    notes: job.notes,
    customerNotes: job.customerNotes,
    checklist: Array.isArray(job.checklist)
      ? (job.checklist as Array<{ label?: string; completed?: boolean }>)
      : null,
    photos: job.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      takenAt: photo.takenAt.toISOString(),
    })),
    customer: {
      id: job.customer.id,
      name: formatCustomerName(job.customer),
      email: job.customer.email,
      phone: job.customer.telefono,
    },
    property: {
      id: job.property.id,
      name: job.property.name,
      address: job.property.address,
      poolType: job.property.poolType,
      sanitizerType: job.property.sanitizerType,
      poolVolumeGallons: job.property.poolVolumeGallons,
      filterType: job.property.filterType,
      accessInfo: job.property.accessInfo,
      locationNotes: job.property.locationNotes,
      hasSpa: job.property.hasSpa,
    },
    technician: job.technician
      ? { id: job.technician.id, name: job.technician.user.fullName }
      : null,
  }));

  const existingPlannedJobKeys = new Set(
    jobs
      .filter((job) => Boolean(job.planId))
      .map((job) => `${job.planId}:${toBusinessDateKey(job.scheduledDate)}`)
  );
  const calendarStartEt = DateTime.fromJSDate(calendarStart).setZone(BUSINESS_TIMEZONE);
  const calendarEndEt = DateTime.fromJSDate(calendarEnd).setZone(BUSINESS_TIMEZONE);

  const planOccurrencesData = plans.flatMap((plan) => {
    const occurrences: Array<{
      id: string;
      scheduledDate: string;
      entryKind: "plan";
      status: string;
      type: string;
      priority: string;
      serviceTierId: string | null;
      serviceType: string;
      estimatedDurationMinutes: number | null;
      technicianId: string | null;
      sortOrder: number | null;
      planId: string;
      planName: string;
      showScheduledTime: boolean;
      notes: string | null;
      checklist: null;
      photos: [];
      customer: { id: string; name: string; email?: string | null; phone?: string | null };
      property: {
        id: string;
        name?: string | null;
        address: string;
        poolType?: string | null;
        sanitizerType?: string | null;
        poolVolumeGallons?: number | null;
        filterType?: string | null;
        accessInfo?: string | null;
        locationNotes?: string | null;
        hasSpa?: boolean | null;
      };
      technician: { id: string; name: string } | null;
    }> = [];

    let occurrence = DateTime.fromJSDate(plan.nextRunAt).setZone(BUSINESS_TIMEZONE);
    let guard = 0;
    while (occurrence < calendarStartEt && guard < 260) {
      occurrence = DateTime.fromJSDate(
        addPlanFrequency(occurrence.toUTC().toJSDate(), plan.frequency)
      ).setZone(BUSINESS_TIMEZONE);
      guard += 1;
    }

    while (occurrence <= calendarEndEt && guard < 320) {
      const occurrenceDate = occurrence.toUTC().toJSDate();
      const occurrenceKey = `${plan.id}:${toBusinessDateKey(occurrenceDate)}`;
      if (!existingPlannedJobKeys.has(occurrenceKey)) {
        const hour = occurrence.hour ?? 0;
        const minute = occurrence.minute ?? 0;
        occurrences.push({
          id: `plan-${plan.id}-${occurrence.toFormat("yyyy-MM-dd")}`,
          scheduledDate: occurrenceDate.toISOString(),
          entryKind: "plan",
          status: "SCHEDULED",
          type: "ROUTINE",
          priority: plan.priority,
          serviceTierId: plan.serviceTierId,
          serviceType: plan.serviceType,
          estimatedDurationMinutes: plan.estimatedDurationMinutes,
          technicianId: plan.technicianId,
          sortOrder:
            plan.name === CUSTOM_SERVICE_PLAN_NAME
              ? hour * 60 + minute
              : null,
          planId: plan.id,
          planName: plan.name,
          showScheduledTime: plan.name === CUSTOM_SERVICE_PLAN_NAME,
          notes: plan.notes,
          checklist: null,
          photos: [],
          customer: {
            id: plan.customer.id,
            name: formatCustomerName(plan.customer),
            email: plan.customer.email,
            phone: plan.customer.telefono,
          },
          property: {
            id: plan.property.id,
            name: plan.property.name,
            address: plan.property.address,
            poolType: plan.property.poolType,
            sanitizerType: plan.property.sanitizerType,
            poolVolumeGallons: plan.property.poolVolumeGallons,
            filterType: plan.property.filterType,
            accessInfo: plan.property.accessInfo,
            locationNotes: plan.property.locationNotes,
            hasSpa: plan.property.hasSpa,
          },
          technician: plan.technician
            ? { id: plan.technician.id, name: plan.technician.user.fullName }
            : null,
        });
      }

      occurrence = DateTime.fromJSDate(
        addPlanFrequency(occurrenceDate, plan.frequency)
      ).setZone(BUSINESS_TIMEZONE);
      guard += 1;
    }

    return occurrences;
  });

  const techniciansData = technicians.map((tech) => ({
    id: tech.id,
    name: tech.user.fullName,
    colorHex: tech.colorHex,
  }));

  const customersData = customers.map((customer) => ({
    id: customer.id,
    name: formatCustomerName(customer),
    properties: customer.properties.map((property) => ({
      id: property.id,
      address: property.address,
    })),
  }));
  const serviceTiersData = serviceTiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    isActive: tier.isActive,
    checklist: Array.isArray(tier.checklist)
      ? tier.checklist.map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return { label: undefined, completed: false };
          }
          const candidate = item as { label?: unknown; completed?: unknown };
          return {
            label: typeof candidate.label === "string" ? candidate.label : undefined,
            completed: Boolean(candidate.completed),
          };
        })
      : null,
  }));

  return (
    <AppShell
      title={t("admin.routes.title")}
      subtitle={t("admin.routes.subtitle")}
      role="ADMIN"
      wide
    >
      <div className="space-y-4">
        <RoutesCalendar
          jobs={jobsData}
          planOccurrences={planOccurrencesData}
          technicians={techniciansData}
          customers={customersData}
          serviceTiers={serviceTiersData}
          monthKey={toMonthKey(monthStart)}
          nextMonthJobsCount={nextMonthJobsCount}
        />
      </div>
    </AppShell>
  );
}
