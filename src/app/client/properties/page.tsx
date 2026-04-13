import AppShell from "@/components/layout/AppShell";
import ClientPropertiesManager, {
  type ClientPropertyItem,
  type ClientPropertyJob,
} from "@/components/customers/ClientPropertiesManager";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { getTranslations } from "@/i18n/server";

export default async function ClientPropertiesPage() {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: {
      properties: {
        orderBy: [{ createdAt: "asc" }],
      },
      jobs: {
        include: { property: true, photos: true },
        orderBy: [{ completedAt: "desc" }, { scheduledDate: "desc" }],
        take: 240,
      },
    },
  });

  if (!customer) {
    return (
      <AppShell
        title={t("client.properties.title")}
        subtitle={t("client.properties.subtitle")}
        role="CUSTOMER"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">{t("client.properties.empty")}</p>
        </section>
      </AppShell>
    );
  }

  const properties: ClientPropertyItem[] = customer.properties.map((property) => ({
    id: property.id,
    name: property.name ?? null,
    address: property.address,
    poolType: property.poolType ?? null,
    sanitizerType: property.sanitizerType ?? null,
    filterType: property.filterType ?? null,
    poolVolumeGallons: property.poolVolumeGallons ?? null,
    hasSpa: property.hasSpa,
    accessInfo: property.accessInfo ?? null,
    locationNotes: property.locationNotes ?? null,
  }));

  const jobs: ClientPropertyJob[] = customer.jobs.map((job) => ({
    id: job.id,
    propertyId: job.propertyId,
    propertyName: job.property.name ?? null,
    propertyAddress: job.property.address,
    status: job.status,
    type: job.type,
    scheduledDate: job.scheduledDate.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    photosCount: job.photos.length,
  }));

  return (
    <AppShell
      title={t("client.properties.title")}
      subtitle={t("client.properties.subtitle")}
      role="CUSTOMER"
    >
      <ClientPropertiesManager initialProperties={properties} initialJobs={jobs} />
    </AppShell>
  );
}
