import AppShell from "@/components/layout/AppShell";
import RoutesCalendar from "@/components/routes/RoutesCalendar";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { formatCustomerName } from "@/lib/customers/format";
import { getTranslations } from "@/i18n/server";
import { getServiceTiers } from "@/lib/service-tiers";

export default async function RoutesPage() {
  await requireRole("ADMIN");
  const t = await getTranslations();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const calendarStart = new Date(monthStart);
  const startDay = calendarStart.getDay();
  calendarStart.setDate(
    calendarStart.getDate() + (startDay === 0 ? 1 : 1 - startDay)
  );
  calendarStart.setHours(0, 0, 0, 0);
  const calendarEnd = new Date(monthEnd);
  const endDay = calendarEnd.getDay();
  calendarEnd.setDate(
    calendarEnd.getDate() + (endDay === 0 ? -1 : 6 - endDay)
  );
  calendarEnd.setHours(23, 59, 59, 999);

  const [jobs, technicians, customers, serviceTiers] = await Promise.all([
    prisma.job.findMany({
      where: {
        scheduledDate: {
          gte: calendarStart,
          lte: calendarEnd,
        },
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
        notes: true,
        checklist: true,
        photos: { select: { id: true, url: true, takenAt: true } },
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
            waterType: true,
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
    notes: job.notes,
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
      waterType: job.property.waterType,
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
    >
      <RoutesCalendar
        jobs={jobsData}
        technicians={techniciansData}
        customers={customersData}
        serviceTiers={serviceTiersData}
      />
    </AppShell>
  );
}
